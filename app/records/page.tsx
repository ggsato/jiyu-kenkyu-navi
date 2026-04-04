import { prisma } from "@/lib/prisma";
import { ensureQuestionFieldDefinitions } from "@/lib/question-field-definitions";
import { PageShell, Card, SectionTitle } from "@/components/ui";
import { RecordsClient } from "./records-client";
import { getCurrentUserId } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const currentUserId = await getCurrentUserId();
  const activeQuestion = await prisma.question.findFirst({
    where: {
      status: "active",
      wish: { userId: currentUserId },
    },
    include: { wish: true },
  });

  const records = activeQuestion
    ? await prisma.record.findMany({
        where: { questionId: activeQuestion.id },
        orderBy: { recordedAt: "desc" },
        include: { attachments: true },
      })
    : [];

  const fieldDefinitions = activeQuestion ? await ensureQuestionFieldDefinitions(activeQuestion.id) : [];
  const questionFocuses = activeQuestion
    ? await prisma.questionObservationFocus.findMany({
        where: { questionId: activeQuestion.id },
        orderBy: { sortOrder: "asc" },
      })
    : [];
  const selectedFieldIds = new Set(
    questionFocuses.filter((focus) => focus.isSelected).map((focus) => focus.fieldDefinitionId),
  );
  const allFieldDefinitions = activeQuestion
    ? await prisma.observationFieldDefinition.findMany({
        where: { wishId: activeQuestion.wishId },
        orderBy: { sortOrder: "asc" },
        include: { derivedFromField: true },
      })
    : [];

  const serializedRecords = records.map((record) => ({
    ...record,
    recordedAt: record.recordedAt.toISOString(),
    kvFields: (record.kvFields as Record<string, unknown>) || {},
  }));

  return (
    <PageShell>
      <Card>
        <SectionTitle>記録</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">今回どうしてみたかと、その結果を残しながら、この願いで次に何を試すとよいかを見つけます。</p>
        <p className="mt-3 text-base font-medium text-slate-900">{activeQuestion?.text || "まずは問いを作ろう"}</p>
      </Card>
      <RecordsClient
        activeQuestionId={activeQuestion?.id || ""}
        activeQuestionText={activeQuestion?.text || ""}
        activePurposeFocus={activeQuestion?.purposeFocus || "compare"}
        records={serializedRecords}
        fieldDefinitions={fieldDefinitions.map((field) => ({
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
          parentLabel: field.derivedFromField?.label || null,
        }))}
        allFieldDefinitions={allFieldDefinitions.map((field) => ({
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
          isSelected: selectedFieldIds.has(field.id),
        }))}
      />
    </PageShell>
  );
}
