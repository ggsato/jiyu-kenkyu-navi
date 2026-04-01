import { QuestionFieldRole, RecordFieldType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ObservationNode = {
  id: string;
  key: string;
  label: string;
  type: RecordFieldType;
  role: QuestionFieldRole;
  why: string | null;
  howToUse: string | null;
  isDefault: boolean;
  isCurrent: boolean;
  selectedCount: number;
  presentedCount: number;
  skippedCount: number;
  childCount: number;
  lastSelectedAt: string | null;
  lastSelectedQuestionText: string | null;
  children: ObservationNode[];
};

export type ObservationStructurePayload =
  | {
      hasActiveWish: false;
    }
  | {
      hasActiveWish: true;
      wishId: string;
      wishText: string;
      activeQuestionId: string;
      activeQuestionText: string;
      stats: {
        total: number;
        roots: number;
        split: number;
        current: number;
      };
      tree: ObservationNode[];
      recentAdded: string[];
      resting: string[];
    };

export async function buildObservationStructurePayload(userId: string): Promise<ObservationStructurePayload> {
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
    return { hasActiveWish: false };
  }

  const [fields, focuses] = await Promise.all([
    prisma.observationFieldDefinition.findMany({
      where: { wishId: activeQuestion.wishId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.questionObservationFocus.findMany({
      where: {
        question: {
          wishId: activeQuestion.wishId,
        },
      },
      include: {
        question: {
          select: {
            id: true,
            text: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        { question: { createdAt: "desc" } },
        { sortOrder: "asc" },
      ],
    }),
  ]);

  const focusStatsByFieldId = new Map<
    string,
    {
      selectedCount: number;
      presentedCount: number;
      lastSelectedAt: string | null;
      lastSelectedQuestionText: string | null;
    }
  >();

  for (const focus of focuses) {
    const current = focusStatsByFieldId.get(focus.fieldDefinitionId) || {
      selectedCount: 0,
      presentedCount: 0,
      lastSelectedAt: null,
      lastSelectedQuestionText: null,
    };

    current.presentedCount += 1;

    if (focus.isSelected) {
      current.selectedCount += 1;

      if (!current.lastSelectedAt) {
        current.lastSelectedAt = focus.question.createdAt.toISOString();
        current.lastSelectedQuestionText = focus.question.text;
      }
    }

    focusStatsByFieldId.set(focus.fieldDefinitionId, current);
  }

  const currentFieldIds = new Set(
    focuses
      .filter((focus) => focus.questionId === activeQuestion.id && focus.isSelected)
      .map((focus) => focus.fieldDefinitionId),
  );

  const childIdsByParent = new Map<string, string[]>();

  for (const field of fields) {
    if (!field.derivedFromFieldId) {
      continue;
    }

    const currentChildren = childIdsByParent.get(field.derivedFromFieldId) || [];
    currentChildren.push(field.id);
    childIdsByParent.set(field.derivedFromFieldId, currentChildren);
  }

  const fieldNodeById = new Map<string, ObservationNode>();

  for (const field of fields) {
    const stats = focusStatsByFieldId.get(field.id) || {
      selectedCount: 0,
      presentedCount: 0,
      lastSelectedAt: null,
      lastSelectedQuestionText: null,
    };

    fieldNodeById.set(field.id, {
      id: field.id,
      key: field.key,
      label: field.label,
      type: field.type,
      role: field.role,
      why: field.why,
      howToUse: field.howToUse,
      isDefault: field.isDefault,
      isCurrent: currentFieldIds.has(field.id),
      selectedCount: stats.selectedCount,
      presentedCount: stats.presentedCount,
      skippedCount: Math.max(stats.presentedCount - stats.selectedCount, 0),
      childCount: childIdsByParent.get(field.id)?.length || 0,
      lastSelectedAt: stats.lastSelectedAt,
      lastSelectedQuestionText: stats.lastSelectedQuestionText,
      children: [],
    });
  }

  const roots: ObservationNode[] = [];

  for (const field of fields) {
    const node = fieldNodeById.get(field.id);

    if (!node) {
      continue;
    }

    if (field.derivedFromFieldId) {
      const parent = fieldNodeById.get(field.derivedFromFieldId);

      if (parent) {
        parent.children.push(node);
        continue;
      }
    }

    roots.push(node);
  }

  const recentAdded = [...fields]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((field) => field.label)
    .slice(0, 5);

  const resting = fields
    .filter((field) => !currentFieldIds.has(field.id) && (focusStatsByFieldId.get(field.id)?.selectedCount || 0) > 0)
    .map((field) => field.label)
    .slice(0, 5);

  return {
    hasActiveWish: true,
    wishId: activeQuestion.wishId,
    wishText: activeQuestion.wish.text,
    activeQuestionId: activeQuestion.id,
    activeQuestionText: activeQuestion.text,
    stats: {
      total: fields.length,
      roots: fields.filter((field) => !field.derivedFromFieldId).length,
      split: fields.filter((field) => Boolean(field.derivedFromFieldId)).length,
      current: currentFieldIds.size,
    },
    tree: roots,
    recentAdded,
    resting,
  };
}
