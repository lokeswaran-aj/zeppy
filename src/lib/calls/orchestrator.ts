import pLimit from "p-limit";

import { db } from "@/lib/db";
import { persistEvent } from "@/lib/events/log";
import { fromDbLanguage } from "@/lib/mappers";
import { buildActionItems } from "@/lib/analysis/action-items";
import { buildRecommendationSummary, buildRecommendations } from "@/lib/analysis/recommend";
import { logger, maskPhone } from "@/lib/logger";

import { executeInvestigationCall } from "./runner";
import { appendTranscript, publishCallRecording, saveExtractedFinding, updateCallStatus } from "./state";

export async function runInvestigation(investigationId: string) {
  const investigation = await db.investigation.findUnique({
    where: { id: investigationId },
    include: {
      calls: {
        include: {
          contact: true,
        },
      },
    },
  });

  if (!investigation) {
    throw new Error("Investigation not found.");
  }

  const callLimit = pLimit(Math.max(1, Math.min(3, investigation.concurrency || 3)));
  logger.info("investigation.orchestrator.start", {
    investigationId,
    contacts: investigation.calls.length,
    concurrency: Math.max(1, Math.min(3, investigation.concurrency || 3)),
  });

  const jobs = investigation.calls.map((call) =>
    callLimit(async () => {
      logger.info("investigation.call.start", {
        investigationId,
        callId: call.id,
        contactName: call.contact.name,
        to: maskPhone(call.contact.phone),
      });
      await updateCallStatus({ callId: call.id, status: "dialing" });

      try {
        let callOutput: Awaited<ReturnType<typeof executeInvestigationCall>> | null = null;
        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          logger.info("investigation.call.attempt", {
            investigationId,
            callId: call.id,
            attempt,
            maxAttempts,
          });
          try {
            if (attempt > 1) {
              await updateCallStatus({
                callId: call.id,
                status: "dialing",
                failureReason: null,
              });
              await appendTranscript({
                callId: call.id,
                speaker: "system",
                text: `Retry attempt ${attempt}/${maxAttempts} after transient error.`,
              });
            }

            callOutput = await executeInvestigationCall({
              investigationId,
              callId: call.id,
              requirement: investigation.requirement,
              contact: {
                name: call.contact.name,
                phone: call.contact.phone,
                language: fromDbLanguage(call.contact.language),
              },
              onStatus: async (status, details) => {
                await updateCallStatus({
                  callId: call.id,
                  status,
                  livekitRoomName: details?.livekitRoomName,
                  livekitParticipant: details?.livekitParticipant,
                  livekitSipCallId: details?.livekitSipCallId,
                });
              },
              onTranscript: async (speaker, text) => {
                await appendTranscript({
                  callId: call.id,
                  speaker,
                  text,
                });
              },
              onRecordingReady: async (recordingUrl) => {
                await publishCallRecording({
                  callId: call.id,
                  recordingUrl,
                });
              },
            });
            break;
          } catch (error) {
            logger.warn("investigation.call.attempt.failed", {
              investigationId,
              callId: call.id,
              attempt,
              error: error instanceof Error ? error.message : String(error),
            });
            if (attempt < maxAttempts && isRetryableError(error)) {
              const delayMs = 1000 * 2 ** (attempt - 1);
              logger.info("investigation.call.retry.scheduled", {
                investigationId,
                callId: call.id,
                attempt,
                delayMs,
              });
              await sleep(delayMs);
              continue;
            }
            throw error;
          }
        }

        if (!callOutput) {
          throw new Error("Call execution returned no output.");
        }

        await updateCallStatus({ callId: call.id, status: "analyzing" });

        await saveExtractedFinding({
          callId: call.id,
          transcriptText: callOutput.transcriptText,
          extracted: callOutput.extracted,
        });

        await updateCallStatus({
          callId: call.id,
          status: "completed",
          score: callOutput.extracted.score,
        });
        logger.info("investigation.call.completed", {
          investigationId,
          callId: call.id,
          score: callOutput.extracted.score,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Call execution failed.";
        logger.error("investigation.call.failed", {
          investigationId,
          callId: call.id,
          reason,
        });
        await updateCallStatus({
          callId: call.id,
          status: "failed",
          failureReason: reason,
        });
      }
    }),
  );

  await Promise.all(jobs);

  const latest = await db.investigation.findUnique({
    where: { id: investigationId },
    include: {
      calls: {
        include: {
          contact: true,
          extractedFinding: true,
        },
      },
    },
  });

  if (!latest) {
    throw new Error("Investigation disappeared before analysis.");
  }

  const ranked = buildRecommendations({
    requirement: latest.requirement,
    candidates: latest.calls,
  });
  const summary = buildRecommendationSummary(latest.requirement, ranked);
  const actionItems = buildActionItems({
    requirement: latest.requirement,
    ranked,
  });

  await db.$transaction(async (tx) => {
    await tx.recommendation.deleteMany({
      where: { investigationId },
    });
    await tx.actionItem.deleteMany({
      where: { investigationId },
    });

    for (let index = 0; index < ranked.length; index += 1) {
      const item = ranked[index];
      await tx.recommendation.create({
        data: {
          investigationId,
          callId: item.callId,
          rank: index + 1,
          score: item.score,
          summary: item.summary,
          reasoning: item.reasoning,
          monthlyPrice: item.monthlyPrice,
          availability: item.availability,
          locationFit: item.locationFit,
          isBest: index === 0,
        },
      });
    }

    for (const item of actionItems) {
      await tx.actionItem.create({
        data: {
          investigationId,
          priority: item.priority.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
          title: item.title,
          detail: item.detail,
        },
      });
    }
  });

  await db.investigation.update({
    where: { id: investigationId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      bestCallId: ranked[0]?.callId ?? null,
      recommendationSummary: summary,
    },
  });

  await persistEvent({
    investigationId,
    payload: {
      type: "investigation.completed",
      investigationId,
    },
  });
  logger.info("investigation.orchestrator.completed", {
    investigationId,
    recommendations: ranked.length,
    bestCallId: ranked[0]?.callId ?? null,
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /timeout|temporar|rate limit|network|econn|socket|503|502|429/i.test(message);
}
