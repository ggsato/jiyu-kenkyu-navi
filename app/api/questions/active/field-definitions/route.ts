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
  isPrimaryMetric?: boolean;
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
    isPrimaryMetric: Boolean(field.isPrimaryMetric),
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
      isPrimaryMetric: field.is_primary_metric ?? false,
      derivedFromKey: field.derived_from_key || null,
    }));
    const selectedFieldKeys = fieldDefinitionInputs.filter((field) => field.isSelected !== false).map((field) => field.key);
    const selectedCompareFields = fieldDefinitionInputs.filter((field) => field.isSelected !== false && field.role === "compare");
    const selectedPrimaryMetricFields = fieldDefinitionInputs.filter((field) => field.isSelected !== false && field.isPrimaryMetric);

    if (activeQuestion.purposeFocus === "compare") {
      if (selectedCompareFields.length !== 1) {
        return NextResponse.json({ error: "『試す』の問いでは、『試し分けに使う』項目を1つだけ選んでください" }, { status: 400 });
      }

      const primaryCompareField = selectedCompareFields[0]!;

      if (primaryCompareField.type !== "select" || (primaryCompareField.options || []).length < 2) {
        return NextResponse.json({ error: "『今回試すこと』は、選択肢を2つ以上持つ『選ぶ』項目にしてください" }, { status: 400 });
      }

      if (selectedPrimaryMetricFields.length !== 1) {
        return NextResponse.json({ error: "『試す』の問いでは、『今回見る項目』を1つだけ選んでください" }, { status: 400 });
      }

      const primaryMetricField = selectedPrimaryMetricFields[0]!;

      if (primaryMetricField.type !== "number" && primaryMetricField.type !== "boolean") {
        return NextResponse.json({ error: "『今回見る項目』は、数で入れる項目か、はい/いいえの項目にしてください" }, { status: 400 });
      }
    }

    const payload = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const definitions = await upsertObservationFieldDefinitions(tx, activeQuestion.wishId, fieldDefinitionInputs);
      await syncQuestionObservationFocuses(
        tx,
        activeQuestion.id,
        definitions.map((field) => ({
          id: field.id,
          key: field.key,
          isPrimaryMetric: fieldDefinitionInputs.find((item) => item.key === field.key)?.isPrimaryMetric || false,
        })),
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
            isPrimaryMetric: currentFocuses.find((focus) => focus.fieldDefinitionId === field.id)?.isPrimaryMetric || false,
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
              isPrimaryMetric: focus.isPrimaryMetric,
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
