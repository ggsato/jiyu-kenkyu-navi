import { NextRequest, NextResponse } from "next/server";
import { createQuestionSchema } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logging";
import {
  buildWishObservationFieldCandidates,
  createQuestionObservationFocuses,
  upsertObservationFieldDefinitions,
} from "@/lib/question-field-definitions";
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

    if (input.wish_id) {
      const existingWish = await prisma.wish.findFirst({
        where: {
          id: input.wish_id,
          userId: user.id,
        },
      });

      if (!existingWish) {
        return NextResponse.json({ error: "続きの願いが見つかりませんでした" }, { status: 404 });
      }
    }

    const normalizedPurposeFocus = normalizePurposeFocus(input.purpose_focus);
    const fieldDefinitionInputs = input.field_definitions.length > 0
      ? input.field_definitions.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          unit: field.unit || null,
          options: field.options || [],
          role: field.role,
          why: field.why || null,
          howToUse: field.how_to_use || null,
          isDefault: field.is_default || false,
          isSelected: field.is_selected ?? true,
          derivedFromKey: field.derived_from_key || null,
        }))
      : (await buildWishObservationFieldCandidates(input.wish_id, input.question_text, normalizedPurposeFocus, {
          wish_text: input.wish_text,
          reason: input.reason,
          current_state: input.current_state,
          not_yet: input.not_yet,
          desired_state: input.desired_state,
        })).fields;

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.question.updateMany({
        where: {
          status: "active",
          wish: { userId: user.id },
        },
        data: { status: "archived" },
      });

      const wish = input.wish_id
        ? await tx.wish.update({
            where: { id: input.wish_id },
            data: {
              text: input.wish_text,
              reason: input.reason,
              currentState: input.current_state,
              notYet: input.not_yet,
              desiredState: input.desired_state,
            },
          })
        : await tx.wish.create({
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

      const fieldDefinitions = await upsertObservationFieldDefinitions(tx, wish.id, fieldDefinitionInputs);
      const selectedFieldKeys = fieldDefinitionInputs.filter((field) => field.isSelected !== false).map((field) => field.key);
      const observationFocuses = await createQuestionObservationFocuses(tx, question.id, fieldDefinitions, selectedFieldKeys);

      return { wish, question, fieldDefinitions, observationFocuses };
    });

    await logEvent(input.wish_id ? "wish_updated" : "wish_created", { wishId: result.wish.id });
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
