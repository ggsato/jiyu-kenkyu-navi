import { ReflectionClient } from "./reflection-client";
import { prisma } from "@/lib/prisma";
import { PageShell, Card, SectionTitle } from "@/components/ui";
import { getCurrentUserId, listAvailableUsers } from "@/lib/current-user";
import { UserSwitcher } from "@/components/user-switcher";

export const dynamic = "force-dynamic";

export default async function ReflectionPage() {
  const currentUserId = await getCurrentUserId();
  const users = await listAvailableUsers(currentUserId);
  const activeQuestion = await prisma.question.findFirst({
    where: {
      status: "active",
      wish: { userId: currentUserId },
    },
    include: {
      wish: true,
    },
  });

  const today = new Date().toISOString().slice(0, 10);
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

  return (
    <PageShell>
      <UserSwitcher users={users} currentUserId={currentUserId} />
      <Card>
        <SectionTitle>振り返り</SectionTitle>
        <p className="mt-2 text-sm text-slate-600">今日わかったこと、まだわからないこと、次にやりたいことを短く残します。</p>
      </Card>
      <ReflectionClient
        activeQuestionId={activeQuestion?.id || ""}
        reflectionDate={today}
        initialReflection={reflection}
        previousWishState={{
          current_state: activeQuestion?.wish.currentState || "",
          not_yet: activeQuestion?.wish.notYet || "",
          desired_state: activeQuestion?.wish.desiredState || "",
        }}
      />
    </PageShell>
  );
}
