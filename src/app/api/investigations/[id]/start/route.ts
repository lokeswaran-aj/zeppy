import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getInvestigationSnapshot, persistEvent } from "@/lib/events/log";
import { runInvestigation } from "@/lib/calls/orchestrator";
import { investigationParamsSchema } from "@/lib/validation/common";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const body = await request.json().catch(() => null);
  const rawAgentName = typeof body?.agentName === "string" ? body.agentName.trim() : "";
  const agentName = rawAgentName || "assistant";
  const parsedParams = investigationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    logger.warn("api.investigation.start.invalidId");
    return NextResponse.json({ error: "Invalid investigation id." }, { status: 400 });
  }
  const { id } = parsedParams.data;
  logger.info("api.investigation.start.requested", { investigationId: id });

  const investigation = await db.investigation.findUnique({
    where: {
      id,
    },
  });

  if (!investigation) {
    logger.warn("api.investigation.start.notFound", { investigationId: id });
    return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
  }

  if (investigation.status === "RUNNING") {
    logger.info("api.investigation.start.alreadyRunning", { investigationId: id });
    return NextResponse.json({ investigationId: id, status: "running", accepted: true });
  }

  if (investigation.status === "COMPLETED") {
    logger.info("api.investigation.start.alreadyCompleted", { investigationId: id });
    return NextResponse.json({ investigationId: id, status: "completed", accepted: false });
  }

  await db.investigation.update({
    where: { id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
    },
  });

  const snapshot = await getInvestigationSnapshot(id);
  if (snapshot) {
    await persistEvent({
      investigationId: id,
      payload: {
        ...snapshot,
        status: "running",
      },
    });
  }

  // Run asynchronously so API returns immediately and SSE can stream progress.
  void runInvestigation(id, { agentName }).catch(async (error) => {
    const reason = error instanceof Error ? error.message : "Investigation failed unexpectedly.";
    logger.error("api.investigation.start.backgroundFailed", {
      investigationId: id,
      reason,
    });

    await db.investigation.update({
      where: { id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });

    await persistEvent({
      investigationId: id,
      payload: {
        type: "investigation.failed",
        investigationId: id,
        reason,
      },
    });
  });

  return NextResponse.json(
    {
      investigationId: id,
      status: "running",
      accepted: true,
    },
    { status: 202 },
  );
}
