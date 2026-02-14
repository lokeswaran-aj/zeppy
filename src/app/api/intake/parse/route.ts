import { NextResponse } from "next/server";

import { parseInvestigationInputText } from "@/lib/intake/parse";
import { createInvestigationFreeformSchema } from "@/lib/validation/investigation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createInvestigationFreeformSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await parseInvestigationInputText(parsed.data.inputText);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not parse input text.",
      },
      { status: 400 },
    );
  }
}
