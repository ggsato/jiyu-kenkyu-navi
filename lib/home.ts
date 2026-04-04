import { Reflection, Record as PrismaRecord, RecordAttachment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateHomeSummary } from "@/lib/ai";
import { HOME_SUMMARY_FALLBACK } from "@/lib/constants";
import { logEvent } from "@/lib/logging";
import { buildRecordVisualization, type RecordVisualization } from "@/lib/record-visualization";
import { formatDateInAppTimeZone, formatDateTimeInAppTimeZone, getTodayDateInAppTimeZone } from "@/lib/utils";

type RecordWithAttachments = PrismaRecord & {
  attachments: RecordAttachment[];
  recordedAtLabel?: string;
};

type HomePayload =
  | {
      has_active_question: false;
      wish_text: string;
      question_text: string;
      state_label: string;
      record_count: number;
      recent_reflection_summary: string;
      trajectory_summary: string;
      next_step_summary: string;
      character_message: string;
      total_distance: number;
      active_question_id: string | null;
      active_wish_id: string | null;
      latest_reflection: Reflection | null;
      recent_records: RecordWithAttachments[];
      record_visualization: RecordVisualization;
      pending_reflection_date: string;
      observation_summary: {
        current: string[];
        frequent: Array<{ label: string; count: number }>;
        resting: string[];
        recentAdded: string[];
      };
      wishes: Array<{
        id: string;
        text: string;
        questionId: string;
        questionText: string;
        updatedAt: string;
        updatedAtLabel: string;
        isActive: boolean;
      }>;
    }
  | {
      has_active_question: true;
      wish_text: string;
      question_text: string;
      state_label: string;
      record_count: number;
      recent_reflection_summary: string;
      trajectory_summary: string;
      next_step_summary: string;
      character_message: string;
      total_distance: number;
      active_question_id: string;
      active_wish_id: string;
      latest_reflection: Reflection | null;
      recent_records: RecordWithAttachments[];
      record_visualization: RecordVisualization;
      pending_reflection_date: string;
      observation_summary: {
        current: string[];
        frequent: Array<{ label: string; count: number }>;
        resting: string[];
        recentAdded: string[];
      };
      wishes: Array<{
        id: string;
        text: string;
        questionId: string;
        questionText: string;
        updatedAt: string;
        updatedAtLabel: string;
        isActive: boolean;
      }>;
    };

export async function getActiveQuestionWithRelations(userId: string) {
  return prisma.question.findFirst({
    where: {
      status: "active",
      wish: { userId },
    },
    include: {
      wish: true,
      records: {
        orderBy: { recordedAt: "desc" },
        take: 12,
        include: { attachments: true },
      },
      reflections: {
        orderBy: { reflectionDate: "desc" },
        take: 5,
      },
    },
  });
}

export async function listWishSummaries(userId: string, activeQuestionId?: string) {
  const wishes = await prisma.wish.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      questions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return wishes
    .filter((wish) => wish.questions[0])
    .map((wish) => ({
      id: wish.id,
      text: wish.text,
      questionId: wish.questions[0]!.id,
      questionText: wish.questions[0]!.text,
      updatedAt: wish.updatedAt.toISOString(),
      updatedAtLabel: formatDateInAppTimeZone(wish.updatedAt),
      isActive: wish.questions[0]!.id === activeQuestionId,
    }));
}

function computeStateLabel(recordCount: number, reflectionSignals: string[]) {
  if (reflectionSignals[0] === "forward" && reflectionSignals[1] === "forward") {
    return "比較してみてもよさそう";
  }

  if (recordCount === 0) {
    return "はじめの一歩";
  }

  if (recordCount <= 2) {
    return "記録をためる時期";
  }

  if (recordCount >= 3 && reflectionSignals.length > 0) {
    return "材料がそろってきた";
  }

  return "記録をためる時期";
}

export async function buildHomePayload(userId: string): Promise<HomePayload> {
  const activeQuestion = await getActiveQuestionWithRelations(userId);
  const wishes = await listWishSummaries(userId, activeQuestion?.id);

  if (!activeQuestion) {
    return {
      has_active_question: false,
      wish_text: "",
      question_text: "",
      state_label: "はじめの一歩",
      record_count: 0,
      recent_reflection_summary: "",
      trajectory_summary: "",
      next_step_summary: "まずは願いから問いを作ってみよう。",
      character_message: "最初の問いを作るところから始めよう。",
      total_distance: 0,
      active_question_id: null,
      active_wish_id: null,
      latest_reflection: null,
      recent_records: [],
      record_visualization: {
        kind: "empty",
        title: "まだ見える形がありません",
        description: "記録がたまると、ここに変化や試し分けの流れが出ます。",
      },
      pending_reflection_date: getTodayDateInAppTimeZone(),
      observation_summary: {
        current: [],
        frequent: [],
        resting: [],
        recentAdded: [],
      },
      wishes,
    };
  }

  const recordCount = await prisma.record.count({
    where: { questionId: activeQuestion.id },
  });

  const latestReflection = activeQuestion.reflections[0] || null;
  const reflectionSignals = activeQuestion.reflections.map((item: Reflection) => item.selfProgressSignal);
  const sumDistance = await prisma.reflection.aggregate({
    where: { questionId: activeQuestion.id },
    _sum: { distanceDelta: true },
  });

  const recentRecordsSummary = activeQuestion.records.map((record: RecordWithAttachments) => ({
    recorded_at: record.recordedAt.toISOString(),
    body: record.body,
    memo: record.memo,
    kv_fields: Object.fromEntries(Object.entries((record.kvFields as globalThis.Record<string, unknown>) || {}).slice(0, 3)),
    tags: record.tags,
  }));

  const baseLabel = computeStateLabel(recordCount, reflectionSignals);
  const [observationFields, focusUsage] = await Promise.all([
    prisma.observationFieldDefinition.findMany({
      where: { wishId: activeQuestion.wishId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.questionObservationFocus.groupBy({
      by: ["fieldDefinitionId"],
      where: {
        question: {
          wishId: activeQuestion.wishId,
        },
        isSelected: true,
      },
      _count: {
        fieldDefinitionId: true,
      },
    }),
  ]);
  const currentFocuses = await prisma.questionObservationFocus.findMany({
    where: {
      questionId: activeQuestion.id,
      isSelected: true,
    },
    include: { fieldDefinition: true },
    orderBy: { sortOrder: "asc" },
  });
  const usageById = new Map(focusUsage.map((item) => [item.fieldDefinitionId, item._count.fieldDefinitionId]));
  const currentIds = new Set(currentFocuses.map((focus) => focus.fieldDefinitionId));
  const observationSummary = {
    current: currentFocuses.map((focus) => focus.fieldDefinition.label).slice(0, 5),
    frequent: observationFields
      .map((field) => ({
        label: field.label,
        count: usageById.get(field.id) || 0,
      }))
      .filter((field) => field.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
    resting: observationFields
      .filter((field) => !currentIds.has(field.id) && (usageById.get(field.id) || 0) > 0)
      .map((field) => field.label)
      .slice(0, 3),
    recentAdded: [...observationFields]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((field) => field.label)
      .slice(0, 3),
  };
  const recordVisualization = buildRecordVisualization(
    activeQuestion.records.map((record) => ({
      recordedAt: record.recordedAt.toISOString(),
      kvFields: (record.kvFields as globalThis.Record<string, unknown>) || {},
    })),
    currentFocuses.map((focus) => ({
      key: focus.fieldDefinition.key,
      label: focus.fieldDefinition.label,
      type: focus.fieldDefinition.type,
      unit: focus.fieldDefinition.unit,
      role: focus.fieldDefinition.role,
      why: focus.fieldDefinition.why,
      isPrimaryMetric: focus.isPrimaryMetric,
    })),
    activeQuestion.purposeFocus,
  );

  const aiSummary = await generateHomeSummary({
    wish_text: activeQuestion.wish.text,
    question_text: activeQuestion.text,
    recent_records_summary: recentRecordsSummary,
    latest_reflection: latestReflection
      ? {
          self_progress_signal: latestReflection.selfProgressSignal,
          learned: latestReflection.learned,
          unknown: latestReflection.unknown,
          next_step_text: latestReflection.nextStepText,
        }
      : null,
  });

  const payload = {
    has_active_question: true,
    wish_text: activeQuestion.wish.text,
    question_text: activeQuestion.text,
    state_label: aiSummary.state_label || baseLabel,
    record_count: recordCount,
    total_distance: sumDistance._sum.distanceDelta || 0,
    recent_reflection_summary: latestReflection?.learned || "",
    trajectory_summary: aiSummary.trajectory_summary || "記録が少しずつたまっています。",
    next_step_summary:
      aiSummary.next_step_summary ||
      latestReflection?.nextStepText ||
      HOME_SUMMARY_FALLBACK,
    character_message: aiSummary.character_message || "同じ見方で、もう1件残してみよう。",
    active_question_id: activeQuestion.id,
    active_wish_id: activeQuestion.wishId,
    latest_reflection: latestReflection,
    recent_records: activeQuestion.records.map((record) => ({
      ...record,
      recordedAtLabel: formatDateTimeInAppTimeZone(record.recordedAt),
    })),
    record_visualization: recordVisualization,
    pending_reflection_date: getTodayDateInAppTimeZone(),
    observation_summary: observationSummary,
    wishes,
  };

  await logEvent("next_step_shown", {
    questionId: activeQuestion.id,
    nextStepSummary: payload.next_step_summary,
  });

  return payload;
}
