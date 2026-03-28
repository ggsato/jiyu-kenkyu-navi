import { prisma } from "@/lib/prisma";
import { ensureQuestionFieldDefinitions } from "@/lib/question-field-definitions";
import { PageShell, Card, SectionTitle } from "@/components/ui";
import { RecordsClient } from "./records-client";
import { getCurrentUserId, listAvailableUsers } from "@/lib/current-user";
import { UserSwitcher } from "@/components/user-switcher";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const currentUserId = await getCurrentUserId();
  const users = await listAvailableUsers(currentUserId);
  const activeQuestion = await prisma.question.findFirst({
    where: {
      status: "active",
      wish: { userId: currentUserId },
    },
    include: { wish: true, fieldDefinitions: { orderBy: { sortOrder: "asc" } } },
  });

  const records = activeQuestion
    ? await prisma.record.findMany({
        where: { questionId: activeQuestion.id },
        orderBy: { recordedAt: "desc" },
        include: { attachments: true },
      })
    : [];

  const fieldDefinitions = activeQuestion ? await ensureQuestionFieldDefinitions(activeQuestion.id) : [];

  const serializedRecords = records.map((record) => ({
    ...record,
    recordedAt: record.recordedAt.toISOString(),
    kvFields: (record.kvFields as Record<string, unknown>) || {},
  }));

  return (
    <PageShell>
      <UserSwitcher users={users} currentUserId={currentUserId} />
      <Card>
        <SectionTitle>記録</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">今何をしているかを残し、次に何を見るとよいかを見つけます。</p>
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
        }))}
      />
    </PageShell>
  );
}
