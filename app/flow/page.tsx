import { prisma } from "@/lib/prisma";
import { PageShell, Card, SectionTitle } from "@/components/ui";
import { getCurrentUserId } from "@/lib/current-user";
import { getTodayDateInAppTimeZone } from "@/lib/utils";
import { ensureQuestionFieldDefinitions } from "@/lib/question-field-definitions";
import { buildRecordInsightSummary, buildRecordVisualization } from "@/lib/record-visualization";
import { FlowClient } from "./flow-client";

export const dynamic = "force-dynamic";

export default async function FlowPage() {
  const currentUserId = await getCurrentUserId();
  const activeQuestion = await prisma.question.findFirst({
    where: {
      status: "active",
      wish: { userId: currentUserId },
    },
    include: {
      wish: true,
      records: {
        orderBy: { recordedAt: "desc" },
        include: { attachments: true },
      },
    },
  });

  const today = getTodayDateInAppTimeZone();
  const reflection = activeQuestion
    ? await prisma.reflection.findUnique({
        where: {
          questionId_reflectionDate: {
            questionId: activeQuestion.id,
            reflectionDate: today,
          },
        },
      })
    : null;

  const fieldDefinitions = activeQuestion ? await ensureQuestionFieldDefinitions(activeQuestion.id) : [];
  const selectedFields = fieldDefinitions.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    unit: field.unit,
    role: field.role,
    why: field.why,
  }));
  const serializedRecords = activeQuestion
    ? activeQuestion.records.map((record) => ({
        ...record,
        recordedAt: record.recordedAt.toISOString(),
        kvFields: (record.kvFields as Record<string, unknown>) || {},
      }))
    : [];

  const visualization = buildRecordVisualization(
    serializedRecords.map((record) => ({
      recordedAt: record.recordedAt,
      kvFields: record.kvFields,
    })),
    selectedFields,
    activeQuestion?.purposeFocus || "compare",
  );
  const insightSummary = buildRecordInsightSummary(
    serializedRecords.map((record) => ({
      recordedAt: record.recordedAt,
      kvFields: record.kvFields,
    })),
    selectedFields,
    activeQuestion?.purposeFocus || "compare",
  );

  return (
    <PageShell>
      <Card>
        <SectionTitle>流れを見る</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">記録を圧縮して、差や流れを見ながら次の判断材料を整えます。</p>
        <p className="mt-3 text-base font-medium text-slate-900">{activeQuestion?.text || "まずは問いを作ろう"}</p>
      </Card>
      <FlowClient
        activeQuestionId={activeQuestion?.id || ""}
        activeQuestionText={activeQuestion?.text || ""}
        initialReflection={reflection}
        reflectionDate={today}
        visualization={visualization}
        insightSummary={insightSummary}
        recordCount={serializedRecords.length}
        latestRecordedAt={serializedRecords[0]?.recordedAt || null}
        previousWishState={{
          current_state: activeQuestion?.wish.currentState || "",
          not_yet: activeQuestion?.wish.notYet || "",
          desired_state: activeQuestion?.wish.desiredState || "",
        }}
      />
    </PageShell>
  );
}
