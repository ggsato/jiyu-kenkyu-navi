import { Prisma, RecordFieldType } from "@prisma/client";
import { generateRecordFieldSuggestions } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

type FieldDefinitionInput = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit?: string | null;
  options?: string[];
  role?: "core" | "compare" | "optional";
  why?: string | null;
  howToUse?: string | null;
  isDefault?: boolean;
};

type FieldContext = {
  wish_text?: string;
  reason?: string;
  current_state?: string;
  not_yet?: string;
  desired_state?: string;
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

function sanitizeFieldDefinitions(fields: FieldDefinitionInput[]) {
  const deduped: FieldDefinitionInput[] = [];

  for (const field of fields) {
    if (isSubjectiveField(field) || isEvaluativeField(field)) {
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
    });
  }

  const hasCountField = deduped.some(isCountLikeField);

  const filtered = deduped.filter((field) => {
    if (!hasCountField) {
      return true;
    }

    if (isDerivedSummaryField(field)) {
      return false;
    }

    return true;
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

export async function buildFieldDefinitionInputs(
  questionText: string,
  purposeFocus: string,
  context: FieldContext = {},
): Promise<FieldDefinitionInput[]> {
  const result = await generateRecordFieldSuggestions({
    question_text: questionText,
    purpose_focus: purposeFocus,
    wish_text: context.wish_text || "",
    reason: context.reason || "",
    current_state: context.current_state || "",
    not_yet: context.not_yet || "",
    desired_state: context.desired_state || "",
    existing_kv_keys: [],
  });

  if (result.suggested_fields.length > 0) {
    return sanitizeFieldDefinitions(result.suggested_fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type as FieldDefinitionInput["type"],
      unit: field.unit || null,
      options: field.options || [],
      role: field.role as FieldDefinitionInput["role"],
      why: field.why || null,
      howToUse: field.how_to_use || null,
      isDefault: field.is_default || false,
    })));
  }

  return fallbackFieldDefinitions;
}

export async function createQuestionFieldDefinitions(
  tx: Prisma.TransactionClient,
  questionId: string,
  fields: FieldDefinitionInput[],
) {
  return Promise.all(
    fields.map((field, index) =>
      tx.questionFieldDefinition.create({
        data: {
          questionId,
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
        },
      }),
    ),
  );
}

export async function ensureQuestionFieldDefinitions(questionId: string) {
  const existing = await prisma.questionFieldDefinition.findMany({
    where: { questionId },
    orderBy: { sortOrder: "asc" },
  });

  if (existing.length > 0) {
    return existing;
  }

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { wish: true },
  });

  if (!question) {
    return [];
  }

  const fields = await buildFieldDefinitionInputs(question.text, question.purposeFocus, {
    wish_text: question.wish.text,
    reason: question.wish.reason || "",
    current_state: question.wish.currentState || "",
    not_yet: question.wish.notYet || "",
    desired_state: question.wish.desiredState || "",
  });

  return prisma.$transaction((tx) => createQuestionFieldDefinitions(tx, question.id, fields));
}
