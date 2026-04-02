import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";
import { getErrorMessage } from "@/lib/errors";
import { updateActiveQuestionFieldDefinitionsSchema } from "@/lib/validation";
import {
  pruneNeverSelectedObservationFields,
  syncQuestionObservationFocuses,
  upsertObservationFieldDefinitions,
} from "@/lib/question-field-definitions";

function serializeField(field: {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit: string | null;
  options: string[];
  role: "core" | "compare" | "optional";
  why: string | null;
  howToUse: string | null;
  isDefault: boolean;
  derivedFromField: { key: string; label: string } | null;
  isSelected?: boolean;
}) {
  return {
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    unit: field.unit,
    options: field.options,
    role: field.role,
    why: field.why,
    howToUse: field.howToUse,
    isDefault: field.isDefault,
    derivedFromKey: field.derivedFromField?.key || null,
    derivedFromLabel: field.derivedFromField?.label || null,
    isSelected: Boolean(field.isSelected),
  };
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    const json = await request.json();
    const input = updateActiveQuestionFieldDefinitionsSchema.parse(json);

    const activeQuestion = await prisma.question.findFirst({
      where: {
        status: "active",
        wish: { userId },
      },
      include: {
        wish: true,
      },
    });

    if (!activeQuestion) {
      return NextResponse.json({ error: "編集中の問いが見つかりませんでした" }, { status: 404 });
    }

    const fieldDefinitionInputs = input.field_definitions.map((field) => ({
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
    }));
    const selectedFieldKeys = fieldDefinitionInputs.filter((field) => field.isSelected !== false).map((field) => field.key);

    const payload = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const definitions = await upsertObservationFieldDefinitions(tx, activeQuestion.wishId, fieldDefinitionInputs);
      await syncQuestionObservationFocuses(
        tx,
        activeQuestion.id,
        definitions.map((field) => ({ id: field.id, key: field.key })),
        selectedFieldKeys,
      );
      await pruneNeverSelectedObservationFields(tx, activeQuestion.wishId, selectedFieldKeys);

      const [allFields, currentFocuses] = await Promise.all([
        tx.observationFieldDefinition.findMany({
          where: { wishId: activeQuestion.wishId },
          orderBy: { sortOrder: "asc" },
          include: {
            derivedFromField: {
              select: {
                key: true,
                label: true,
              },
            },
          },
        }),
        tx.questionObservationFocus.findMany({
          where: { questionId: activeQuestion.id },
          orderBy: { sortOrder: "asc" },
          include: {
            fieldDefinition: {
              include: {
                derivedFromField: {
                  select: {
                    key: true,
                    label: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      const selectedIds = new Set(
        currentFocuses.filter((focus) => focus.isSelected).map((focus) => focus.fieldDefinitionId),
      );

      return {
        all_fields: allFields.map((field) =>
          serializeField({
            ...field,
            type: field.type,
            role: field.role,
            isSelected: selectedIds.has(field.id),
          }),
        ),
        current_fields: currentFocuses
          .filter((focus) => focus.isSelected)
          .map((focus) =>
            serializeField({
              ...focus.fieldDefinition,
              type: focus.fieldDefinition.type,
              role: focus.fieldDefinition.role,
              isSelected: true,
            }),
          ),
      };
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "記録項目を更新できませんでした") }, { status: 400 });
  }
}
