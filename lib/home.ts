import { Reflection, Record as PrismaRecord, RecordAttachment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateHomeSummary } from "@/lib/ai";
import { HOME_SUMMARY_FALLBACK } from "@/lib/constants";
import { logEvent } from "@/lib/logging";

type RecordWithAttachments = PrismaRecord & {
  attachments: RecordAttachment[];
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
      pending_reflection_date: string;
      wishes: Array<{
        id: string;
        text: string;
        questionId: string;
        questionText: string;
        updatedAt: string;
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
      pending_reflection_date: string;
      wishes: Array<{
        id: string;
        text: string;
        questionId: string;
        questionText: string;
        updatedAt: string;
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
        take: 5,
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

  const seenTexts = new Set<string>();

  return wishes
    .filter((wish) => wish.questions[0])
    .filter((wish) => {
      if (seenTexts.has(wish.text)) {
        return false;
      }

      seenTexts.add(wish.text);
      return true;
    })
    .map((wish) => ({
      id: wish.id,
      text: wish.text,
      questionId: wish.questions[0]!.id,
      questionText: wish.questions[0]!.text,
      updatedAt: wish.updatedAt.toISOString(),
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
      pending_reflection_date: new Date().toISOString().slice(0, 10),
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
    recent_records: activeQuestion.records,
    pending_reflection_date: new Date().toISOString().slice(0, 10),
    wishes,
  };

  await logEvent("next_step_shown", {
    questionId: activeQuestion.id,
    nextStepSummary: payload.next_step_summary,
  });

  return payload;
}
