import { Prisma, RecordFieldType } from "@prisma/client";
import { generateRecordFieldSuggestions } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

type FieldDefinitionInput = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  unit?: string | null;
  options?: string[];
};

type FieldContext = {
  wish_text?: string;
  reason?: string;
  current_state?: string;
  not_yet?: string;
  desired_state?: string;
};

const fallbackFieldDefinitions: FieldDefinitionInput[] = [
  { key: "result", label: "どうだった", type: "select", unit: null, options: ["できた", "もう少し", "むずかしい"] },
  { key: "target", label: "何を見た", type: "select", unit: null, options: ["相手", "場面", "動き"] },
  { key: "noticed", label: "気づきがあった", type: "boolean", unit: null, options: [] },
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
    text.includes("回数帯") ||
    text.includes("成功回数帯") ||
    text.includes("全成功") ||
    text.includes("達成") ||
    text.includes("100%")
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

    deduped.push(field);
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

  return filtered.slice(0, 3);
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
