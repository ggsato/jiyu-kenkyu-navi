import { Prisma, RecordFieldType } from "@prisma/client";
import { generateRecordFieldSuggestions } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export type FieldDefinitionInput = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit?: string | null;
  options?: string[];
  role?: "core" | "compare" | "optional";
  why?: string | null;
  howToUse?: string | null;
  isDefault?: boolean;
  isSelected?: boolean;
  isPrimaryMetric?: boolean;
  derivedFromFieldId?: string | null;
  derivedFromKey?: string | null;
};

type FieldContext = {
  wish_text?: string;
  reason?: string;
  current_state?: string;
  not_yet?: string;
  desired_state?: string;
  record_insight_summary?: string;
};

export type ExistingFieldLike = FieldDefinitionInput & {
  id: string;
  sortOrder: number;
  selectedCount?: number;
  presentedCount?: number;
  lastSelectedAt?: string | null;
  isCurrentlySelected?: boolean;
};

export type ObservationFieldCandidateResult = {
  fields: FieldDefinitionInput[];
  selectedExistingKeys: string[];
  splitExistingKeys: string[];
};

const fallbackFieldDefinitions: FieldDefinitionInput[] = [
  {
    key: "scene",
    label: "場面",
    type: "select",
    unit: null,
    options: ["はじめ", "途中", "おわり"],
    role: "core",
    why: "どこで違いが出るかを見るため",
    howToUse: "同じ場面どうしで見比べるために使う",
    isDefault: true,
  },
  {
    key: "what_happened",
    label: "何が起きた",
    type: "text",
    unit: null,
    options: [],
    role: "core",
    why: "その回のようすを短く残すため",
    howToUse: "あとで違いが出た回を読み返すときに使う",
    isDefault: true,
  },
  {
    key: "difference_hint",
    label: "気になる違い",
    type: "boolean",
    unit: null,
    options: [],
    role: "compare",
    why: "あとで見比べたい回を見つけるため",
    howToUse: "気になる回に印を付けて、あとで集めて見る",
    isDefault: false,
  },
];

function isCountLikeField(field: FieldDefinitionInput) {
  const text = `${field.key} ${field.label}`.toLowerCase();
  return (
    text.includes("count") ||
    text.includes("times") ||
    text.includes("回数") ||
    text.includes("何回") ||
    text.includes("成功数") ||
    text.includes("成功回数")
  );
}

function isDerivedSummaryField(field: FieldDefinitionInput) {
  const text = `${field.key} ${field.label}`.toLowerCase();
  return (
    text.includes("band") ||
    text.includes("range") ||
    text.includes("all_success") ||
    text.includes("full_success") ||
    text.includes("average") ||
    text.includes("avg") ||
    text.includes("sum") ||
    text.includes("total") ||
    text.includes("score") ||
    text.includes("ratio") ||
    text.includes("percent") ||
    text.includes("回数帯") ||
    text.includes("成功回数帯") ||
    text.includes("全成功") ||
    text.includes("達成") ||
    text.includes("100%") ||
    text.includes("平均") ||
    text.includes("合計") ||
    text.includes("合算") ||
    text.includes("割合") ||
    text.includes("比率") ||
    text.includes("率") ||
    text.includes("スコア") ||
    text.includes("評価") ||
    text.includes("差")
  );
}

function isSubjectiveField(field: FieldDefinitionInput) {
  const text = `${field.key} ${field.label}`.toLowerCase();
  return (
    text.includes("feel") ||
    text.includes("feeling") ||
    text.includes("sense") ||
    text.includes("体感") ||
    text.includes("気分") ||
    text.includes("感覚") ||
    text.includes("印象") ||
    text.includes("なんとなく") ||
    text.includes("しやすさ") ||
    text.includes("やすい") ||
    text.includes("にくい")
  );
}

function isEvaluativeField(field: FieldDefinitionInput) {
  const text = `${field.key} ${field.label}`.toLowerCase();
  return (
    text.includes("good") ||
    text.includes("bad") ||
    text.includes("high") ||
    text.includes("low") ||
    text.includes("better") ||
    text.includes("worse") ||
    text.includes("rate") ||
    text.includes("率") ||
    text.includes("高い") ||
    text.includes("低い") ||
    text.includes("良い") ||
    text.includes("悪い") ||
    text.includes("うまくいった") ||
    text.includes("成功しやすい") ||
    text.includes("命中率")
  );
}

function normalizeLabel(label: string) {
  return label
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .trim();
}

function isNearDuplicate(a: FieldDefinitionInput, b: FieldDefinitionInput) {
  const aLabel = normalizeLabel(a.label);
  const bLabel = normalizeLabel(b.label);

  return (
    a.key === b.key ||
    aLabel === bLabel ||
    aLabel.includes(bLabel) ||
    bLabel.includes(aLabel)
  );
}

function sanitizeFieldDefinitions(fields: FieldDefinitionInput[], existingFields: FieldDefinitionInput[] = []) {
  const deduped: FieldDefinitionInput[] = [];

  for (const field of fields) {
    if (isSubjectiveField(field) || isEvaluativeField(field)) {
      continue;
    }

    if (existingFields.some((existing) => isNearDuplicate(existing, field))) {
      continue;
    }

    if (deduped.some((existing) => isNearDuplicate(existing, field))) {
      continue;
    }

    deduped.push({
      ...field,
      role: field.role || "core",
      why: field.why || null,
      howToUse: field.howToUse || null,
      isDefault: Boolean(field.isDefault),
      isSelected: field.isSelected ?? true,
      derivedFromFieldId: field.derivedFromFieldId || null,
      derivedFromKey: field.derivedFromKey || null,
    });
  }

  const hasCountField = deduped.some(isCountLikeField);

  const filtered = deduped.filter((field) => {
    if (!hasCountField) {
      return true;
    }

    return !isDerivedSummaryField(field);
  });

  const sorted = filtered.sort((a, b) => {
    const roleOrder = { core: 0, compare: 1, optional: 2 } as const;
    return roleOrder[a.role || "core"] - roleOrder[b.role || "core"];
  });

  let defaultCoreCount = 0;

  return sorted.slice(0, 10).map((field) => {
    const isCore = (field.role || "core") === "core";
    const isDefault = isCore && defaultCoreCount < 3 && (field.isDefault || defaultCoreCount < 2);

    if (isDefault) {
      defaultCoreCount += 1;
    }

    return {
      ...field,
      isDefault,
    };
  });
}

function toFieldInput(field: ExistingFieldLike | FieldDefinitionInput) {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    unit: field.unit || null,
    options: field.options || [],
    role: field.role || "core",
    why: field.why || null,
    howToUse: field.howToUse || null,
    isDefault: Boolean(field.isDefault),
    isSelected: field.isSelected ?? true,
    derivedFromFieldId: field.derivedFromFieldId || null,
    derivedFromKey: field.derivedFromKey || null,
  } satisfies FieldDefinitionInput;
}

function prioritizeExistingFieldKeys(fields: ExistingFieldLike[]) {
  return [...fields]
    .sort((a, b) => {
      const scoreA = (a.isCurrentlySelected ? 40 : 0) + (a.selectedCount || 0) * 10 + (a.presentedCount || 0);
      const scoreB = (b.isCurrentlySelected ? 40 : 0) + (b.selectedCount || 0) * 10 + (b.presentedCount || 0);

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      return a.sortOrder - b.sortOrder;
    })
    .map((field) => field.key);
}

async function listWishObservationFieldDefinitions(wishId: string): Promise<ExistingFieldLike[]> {
  const [fields, focuses, activeQuestion] = await Promise.all([
    prisma.observationFieldDefinition.findMany({
      where: { wishId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.questionObservationFocus.findMany({
      where: {
        question: {
          wishId,
        },
      },
      include: {
        question: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { question: { createdAt: "desc" } },
        { sortOrder: "asc" },
      ],
    }),
    prisma.question.findFirst({
      where: { wishId, status: "active" },
      select: { id: true },
    }),
  ]);

  const statsByFieldId = new Map<string, {
    selectedCount: number;
    presentedCount: number;
    lastSelectedAt: string | null;
    isCurrentlySelected: boolean;
  }>();

  for (const focus of focuses) {
    const current = statsByFieldId.get(focus.fieldDefinitionId) || {
      selectedCount: 0,
      presentedCount: 0,
      lastSelectedAt: null,
      isCurrentlySelected: false,
    };

    current.presentedCount += 1;

    if (focus.isSelected) {
      current.selectedCount += 1;

      if (!current.lastSelectedAt) {
        current.lastSelectedAt = focus.question.createdAt.toISOString();
      }

      if (activeQuestion && focus.questionId === activeQuestion.id) {
        current.isCurrentlySelected = true;
      }
    }

    statsByFieldId.set(focus.fieldDefinitionId, current);
  }

  return fields.map((field) => ({
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
    sortOrder: field.sortOrder,
    derivedFromFieldId: field.derivedFromFieldId,
    selectedCount: statsByFieldId.get(field.id)?.selectedCount || 0,
    presentedCount: statsByFieldId.get(field.id)?.presentedCount || 0,
    lastSelectedAt: statsByFieldId.get(field.id)?.lastSelectedAt || null,
    isCurrentlySelected: statsByFieldId.get(field.id)?.isCurrentlySelected || false,
  }));
}

export async function buildObservationFieldInputs(
  questionText: string,
  purposeFocus: string,
  context: FieldContext = {},
  existingFields: ExistingFieldLike[] = [],
): Promise<ObservationFieldCandidateResult> {
  const result = await generateRecordFieldSuggestions({
    question_text: questionText,
    purpose_focus: purposeFocus,
    wish_text: context.wish_text || "",
    reason: context.reason || "",
    current_state: context.current_state || "",
    not_yet: context.not_yet || "",
    desired_state: context.desired_state || "",
    record_insight_summary: context.record_insight_summary || "",
    existing_kv_keys: existingFields.map((field) => field.key),
    existing_fields: existingFields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      unit: field.unit || null,
      options: field.options || [],
      role: field.role || "core",
      why: field.why || "",
      how_to_use: field.howToUse || "",
      selected_count: field.selectedCount || 0,
      presented_count: field.presentedCount || 0,
      is_currently_selected: Boolean(field.isCurrentlySelected),
      last_selected_at: field.lastSelectedAt || null,
    })),
  });

  const existingInputs = existingFields.map(toFieldInput);
  const suggestedInputs = result.suggested_fields.length > 0
    ? sanitizeFieldDefinitions(result.suggested_fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type as FieldDefinitionInput["type"],
        unit: field.unit || null,
        options: field.options || [],
        role: field.role as FieldDefinitionInput["role"],
        why: field.why || null,
        howToUse: field.how_to_use || null,
        isDefault: field.is_default || false,
        derivedFromKey: field.derived_from_key || null,
      })), existingInputs)
    : [];

  if (existingInputs.length > 0 || suggestedInputs.length > 0) {
    const prioritizedKeys = prioritizeExistingFieldKeys(existingFields);
    const selectedExistingKeys = Array.from(
      new Set([
        ...result.selected_existing_keys.filter((key) => prioritizedKeys.includes(key)),
        ...prioritizedKeys,
      ]),
    ).slice(0, 6);

    return {
      fields: [...existingInputs, ...suggestedInputs],
      selectedExistingKeys,
      splitExistingKeys: result.split_existing_keys || [],
    };
  }

  return {
    fields: fallbackFieldDefinitions,
    selectedExistingKeys: [],
    splitExistingKeys: [],
  };
}

export async function buildWishObservationFieldCandidates(
  wishId: string | undefined,
  questionText: string,
  purposeFocus: string,
  context: FieldContext = {},
) {
  const existingFields = wishId ? await listWishObservationFieldDefinitions(wishId) : [];
  return buildObservationFieldInputs(questionText, purposeFocus, context, existingFields);
}

export async function upsertObservationFieldDefinitions(
  tx: Prisma.TransactionClient,
  wishId: string,
  fields: FieldDefinitionInput[],
) {
  const existing = await tx.observationFieldDefinition.findMany({
    where: { wishId },
  });
  const existingByKey = new Map(existing.map((field) => [field.key, field]));
  const result = [];

  for (const [index, field] of fields.entries()) {
    const existingField = existingByKey.get(field.key);

    if (existingField) {
      const updated = await tx.observationFieldDefinition.update({
        where: { id: existingField.id },
        data: {
          label: field.label,
          type: field.type as RecordFieldType,
          unit: field.unit || null,
          options: field.options || [],
          role: field.role || "core",
          why: field.why || null,
          howToUse: field.howToUse || null,
          isDefault: Boolean(field.isDefault),
          sortOrder: index,
          derivedFromFieldId:
            field.derivedFromFieldId ||
            (field.derivedFromKey ? existingByKey.get(field.derivedFromKey)?.id || null : null) ||
            existingField.derivedFromFieldId ||
            null,
        },
      });

      result.push(updated);
      continue;
    }

    const created = await tx.observationFieldDefinition.create({
      data: {
        wishId,
        key: field.key,
        label: field.label,
        type: field.type as RecordFieldType,
        unit: field.unit || null,
        options: field.options || [],
        role: field.role || "core",
        why: field.why || null,
        howToUse: field.howToUse || null,
        isDefault: Boolean(field.isDefault),
        sortOrder: index,
        derivedFromFieldId: field.derivedFromFieldId || (field.derivedFromKey ? existingByKey.get(field.derivedFromKey)?.id || null : null),
      },
    });

    result.push(created);
  }

  return result;
}

export async function pruneNeverSelectedObservationFields(
  tx: Prisma.TransactionClient,
  wishId: string,
  keepKeys: string[] = [],
) {
  const definitions = await tx.observationFieldDefinition.findMany({
    where: { wishId },
    select: {
      id: true,
      key: true,
      derivedFromFieldId: true,
      questionFocuses: {
        select: {
          isSelected: true,
        },
      },
    },
  });

  const keepKeySet = new Set(keepKeys);
  const removableIds = new Set(
    definitions
      .filter((field) => !keepKeySet.has(field.key))
      .filter((field) => field.questionFocuses.every((focus) => !focus.isSelected))
      .map((field) => field.id),
  );

  if (removableIds.size === 0) {
    return;
  }

  await tx.observationFieldDefinition.deleteMany({
    where: {
      id: {
        in: Array.from(removableIds),
      },
    },
  });
}

export async function createQuestionObservationFocuses(
  tx: Prisma.TransactionClient,
  questionId: string,
  fields: Array<{ id: string; key?: string; isPrimaryMetric?: boolean }>,
  selectedKeys?: string[],
) {
  return Promise.all(
    fields.map((field, index) =>
      tx.questionObservationFocus.create({
        data: {
          questionId,
          fieldDefinitionId: field.id,
          isSelected: selectedKeys ? selectedKeys.includes(field.key || "") : true,
          isPrimaryMetric: Boolean(field.isPrimaryMetric),
          sortOrder: index,
        },
      }),
    ),
  );
}

export async function syncQuestionObservationFocuses(
  tx: Prisma.TransactionClient,
  questionId: string,
  fields: Array<{ id: string; key: string; isPrimaryMetric?: boolean }>,
  selectedKeys: string[],
) {
  const selectedKeySet = new Set(selectedKeys);

  return Promise.all(
    fields.map((field, index) =>
      tx.questionObservationFocus.upsert({
        where: {
          questionId_fieldDefinitionId: {
            questionId,
            fieldDefinitionId: field.id,
          },
        },
        update: {
          isSelected: selectedKeySet.has(field.key),
          isPrimaryMetric: Boolean(field.isPrimaryMetric),
          sortOrder: index,
        },
        create: {
          questionId,
          fieldDefinitionId: field.id,
          isSelected: selectedKeySet.has(field.key),
          isPrimaryMetric: Boolean(field.isPrimaryMetric),
          sortOrder: index,
        },
      }),
    ),
  );
}

export async function ensureQuestionFieldDefinitions(questionId: string) {
  const existing = await prisma.questionObservationFocus.findMany({
    where: { questionId, isSelected: true },
    orderBy: { sortOrder: "asc" },
    include: { fieldDefinition: { include: { derivedFromField: true } } },
  });

  if (existing.length > 0) {
    return existing.map((focus) => focus.fieldDefinition);
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      wish: {
        include: {
          observationFields: {
            orderBy: { sortOrder: "asc" },
            include: { derivedFromField: true },
          },
        },
      },
    },
  });

  if (!question) {
    return [];
  }

  if (question.wish.observationFields.length > 0) {
    await prisma.$transaction((tx) => createQuestionObservationFocuses(tx, question.id, question.wish.observationFields));
    return question.wish.observationFields;
  }

  const result = await buildObservationFieldInputs(question.text, question.purposeFocus, {
    wish_text: question.wish.text,
    reason: question.wish.reason || "",
    current_state: question.wish.currentState || "",
    not_yet: question.wish.notYet || "",
    desired_state: question.wish.desiredState || "",
  });

  return prisma.$transaction(async (tx) => {
    const observationFields = await upsertObservationFieldDefinitions(tx, question.wishId, result.fields);
    await createQuestionObservationFocuses(tx, question.id, observationFields);
    return prisma.observationFieldDefinition.findMany({
      where: { wishId: question.wishId },
      orderBy: { sortOrder: "asc" },
      include: { derivedFromField: true },
    });
  });
}
