import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reflectionSchema } from "@/lib/validation";
import { toDistanceDelta } from "@/lib/utils";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const json = await request.json();
    const input = reflectionSchema.parse(json);
    const userId = await getCurrentUserIdFromRequest(request);
    const existing = await prisma.reflection.findFirst({
      where: {
        id,
        question: {
          wish: { userId },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "その振り返りは見つかりませんでした" }, { status: 404 });
    }

    const reflection = await prisma.reflection.update({
      where: { id },
      data: {
        questionId: input.question_id,
        reflectionDate: input.reflection_date,
        learned: input.learned || null,
        unknown: input.unknown || null,
        nextStepText: input.next_step_text || null,
        selfProgressSignal: input.self_progress_signal,
        distanceDelta: toDistanceDelta(input.self_progress_signal),
      },
    });

    return NextResponse.json({ reflection });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "振り返りを更新できませんでした" }, { status: 400 });
  }
}
