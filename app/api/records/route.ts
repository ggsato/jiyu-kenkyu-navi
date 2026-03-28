import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createRecordSchema } from "@/lib/validation";
import { logEvent } from "@/lib/logging";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId");
  const userId = await getCurrentUserIdFromRequest(request);

  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const records = await prisma.record.findMany({
    where: {
      questionId,
      question: {
        wish: { userId },
      },
    },
    orderBy: { recordedAt: "desc" },
    include: { attachments: true },
  });

  return NextResponse.json({ records });
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = createRecordSchema.parse(json);
    const userId = await getCurrentUserIdFromRequest(request);
    const question = await prisma.question.findFirst({
      where: {
        id: input.question_id,
        wish: { userId },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "その問いには記録できません" }, { status: 404 });
    }

    const record = await prisma.record.create({
      data: {
        questionId: input.question_id,
        recordedAt: input.recorded_at ? new Date(input.recorded_at) : new Date(),
        body: input.body,
        memo: input.memo || null,
        kvFields: input.kv_fields,
        tags: input.tags,
      },
      include: { attachments: true },
    });

    await logEvent("record_created", { recordId: record.id, questionId: record.questionId, source: input.source || null });

    if (input.source === "next_step") {
      await logEvent("next_step_accepted", {
        questionId: input.question_id,
        recordId: record.id,
      });
    }

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "記録を保存できませんでした") }, { status: 400 });
  }
}
