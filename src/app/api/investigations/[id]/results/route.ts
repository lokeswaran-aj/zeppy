import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { fromDbInvestigationStatus } from "@/lib/mappers";
import type { InvestigationResultsResponse } from "@/lib/events";
import { investigationParamsSchema } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteContext) {
  const parsedParams = investigationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid investigation id." }, { status: 400 });
  }
  const { id } = parsedParams.data;

  const investigation = await db.investigation.findUnique({
    where: { id },
    include: {
      recommendations: {
        orderBy: {
          rank: "asc",
        },
        include: {
          call: {
            include: {
              contact: true,
              extractedFinding: true,
            },
          },
        },
      },
      actionItems: {
        orderBy: [
          {
            priority: "asc",
          },
          {
            createdAt: "asc",
          },
        ],
      },
    },
  });

  if (!investigation) {
    return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
  }

  const payload: InvestigationResultsResponse = {
    investigationId: investigation.id,
    requirement: investigation.requirement,
    status: fromDbInvestigationStatus(investigation.status),
    bestCallId: investigation.bestCallId,
    recommendationSummary:
      investigation.recommendationSummary ??
      "Calls are still running. Recommendation will appear once analysis is complete.",
    ranked: investigation.recommendations.map((item) => ({
      callId: item.callId,
      contactName: item.call.contact.name,
      phone: item.call.contact.phone,
      score: Math.round(item.score),
      summary: item.summary,
      findings: extractFindings(item.call.extractedFinding?.raw),
      monthlyPrice: item.monthlyPrice,
      availability: item.availability,
      locationFit: item.locationFit,
    })),
    actionItems: investigation.actionItems.map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      priority: item.priority.toLowerCase() as "high" | "medium" | "low",
    })),
  };

  return NextResponse.json(payload);
}

function extractFindings(raw: unknown) {
  const extraction = extractExtractionPayload(raw);
  const keyFacts = getStringArray(extraction?.keyFacts);
  const rules = getStringArray(extraction?.rules).map((rule) => `Constraint: ${rule}`);

  return uniqueNonEmpty([...keyFacts, ...rules]).slice(0, 8);
}

function extractExtractionPayload(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const nested = raw.extraction;
  if (isRecord(nested)) {
    return nested;
  }

  return raw;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
