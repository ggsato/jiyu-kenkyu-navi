import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reflectionSchema } from "@/lib/validation";
import { toDistanceDelta } from "@/lib/utils";
import { logEvent } from "@/lib/logging";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = reflectionSchema.parse(json);
    const userId = await getCurrentUserIdFromRequest(request);
    const question = await prisma.question.findFirst({
      where: {
        id: input.question_id,
        wish: { userId },
      },
    });

    if (!question) {
      return NextResponse.json({ error: "その問いの振り返りは保存できません" }, { status: 404 });
    }

    const reflection = await prisma.reflection.upsert({
      where: {
        questionId_reflectionDate: {
          questionId: input.question_id,
          reflectionDate: input.reflection_date,
        },
      },
      update: {
        learned: input.learned || null,
        unknown: input.unknown || null,
        nextStepText: input.next_step_text || null,
        selfProgressSignal: input.self_progress_signal,
        distanceDelta: toDistanceDelta(input.self_progress_signal),
      },
      create: {
        questionId: input.question_id,
        reflectionDate: input.reflection_date,
        learned: input.learned || null,
        unknown: input.unknown || null,
        nextStepText: input.next_step_text || null,
        selfProgressSignal: input.self_progress_signal,
        distanceDelta: toDistanceDelta(input.self_progress_signal),
      },
    });

    await logEvent("reflection_created", {
      reflectionId: reflection.id,
      questionId: reflection.questionId,
      reflectionDate: reflection.reflectionDate,
    });

    return NextResponse.json({ reflection }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "振り返りを保存できませんでした") }, { status: 400 });
  }
}
