import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { persistEvent } from "@/lib/events/log";
import { mapCallToProgressItem, toDbLanguage } from "@/lib/mappers";
import { createInvestigationSchema } from "@/lib/validation/investigation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createInvestigationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;

  const created = await db.$transaction(async (tx) => {
    const investigation = await tx.investigation.create({
      data: {
        requirement: input.requirement.trim(),
        status: "DRAFT",
        concurrency: 3,
      },
    });

    const calls = [];
    for (const contact of input.contacts) {
      const savedContact = await tx.contact.create({
        data: {
          investigationId: investigation.id,
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          language: toDbLanguage(contact.language),
        },
      });

      const call = await tx.call.create({
        data: {
          investigationId: investigation.id,
          contactId: savedContact.id,
          status: "QUEUED",
        },
        include: {
          contact: true,
        },
      });

      calls.push(call);
    }

    return {
      investigation,
      calls,
    };
  });

  const snapshotPayload = {
    type: "investigation.snapshot" as const,
    investigationId: created.investigation.id,
    status: "draft" as const,
    requirement: created.investigation.requirement,
    calls: created.calls.map(mapCallToProgressItem),
    transcripts: [],
  };

  await persistEvent({
    investigationId: created.investigation.id,
    payload: snapshotPayload,
  });

  for (const call of created.calls) {
    await persistEvent({
      investigationId: created.investigation.id,
      callId: call.id,
      payload: {
        type: "call.status",
        investigationId: created.investigation.id,
        call: mapCallToProgressItem(call),
      },
    });
  }

  return NextResponse.json(
    {
      investigationId: created.investigation.id,
    },
    { status: 201 },
  );
}
