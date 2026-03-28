import { NextRequest, NextResponse } from "next/server";
import { createQuestionSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logging";
import { buildFieldDefinitionInputs, createQuestionFieldDefinitions } from "@/lib/question-field-definitions";
import { Prisma } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import { normalizePurposeFocus } from "@/lib/purpose-focus";
import { ensureFamilyUsers, getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = createQuestionSchema.parse(json);
    const currentUserId = await getCurrentUserIdFromRequest(request);
    await ensureFamilyUsers();
    const user = await prisma.user.findUnique({ where: { id: currentUserId } });

    if (!user) {
      return NextResponse.json({ error: "ユーザーが見つかりませんでした" }, { status: 404 });
    }

    const normalizedPurposeFocus = normalizePurposeFocus(input.purpose_focus);
    const fieldDefinitionInputs = await buildFieldDefinitionInputs(input.question_text, normalizedPurposeFocus, {
      wish_text: input.wish_text,
      reason: input.reason,
      current_state: input.current_state,
      not_yet: input.not_yet,
      desired_state: input.desired_state,
    });

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.question.updateMany({
        where: {
          status: "active",
          wish: { userId: user.id },
        },
        data: { status: "archived" },
      });

      const wish = await tx.wish.create({
        data: {
          userId: user.id,
          text: input.wish_text,
          reason: input.reason,
          currentState: input.current_state,
          notYet: input.not_yet,
          desiredState: input.desired_state,
        },
      });

      const question = await tx.question.create({
        data: {
          wishId: wish.id,
          text: input.question_text,
          purposeFocus: normalizedPurposeFocus,
          status: "active",
        },
      });

      const fieldDefinitions = await createQuestionFieldDefinitions(tx, question.id, fieldDefinitionInputs);

      return { wish, question, fieldDefinitions };
    });

    await logEvent("wish_created", { wishId: result.wish.id });
    await logEvent("question_selected", {
      questionId: result.question.id,
      purposeFocus: result.question.purposeFocus,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "問いを保存できませんでした") }, { status: 400 });
  }
}
