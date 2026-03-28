import { NextRequest, NextResponse } from "next/server";
import { uiLogSchema } from "@/lib/validation";
import { logEvent } from "@/lib/logging";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = uiLogSchema.parse(json);

    await logEvent(input.event, {
      questionId: input.question_id || null,
      ...input.metadata,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "log failed" }, { status: 400 });
  }
}
