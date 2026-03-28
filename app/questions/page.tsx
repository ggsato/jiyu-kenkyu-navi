import { prisma } from "@/lib/prisma";
import { QuestionsClient } from "./questions-client";
import { getCurrentUserId, listAvailableUsers } from "@/lib/current-user";
import { PageShell } from "@/components/ui";
import { UserSwitcher } from "@/components/user-switcher";

export const dynamic = "force-dynamic";

type QuestionsPageProps = {
  searchParams?: Promise<{
    mode?: string;
    from?: string;
  }>;
};

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const params = (await searchParams) || {};
  const requestedMode = params.mode === "new" ? "new" : "continue";
  const fromReflection = params.from === "reflection";
  const currentUserId = await getCurrentUserId();
  const users = await listAvailableUsers(currentUserId);

  const activeQuestion = await prisma.question.findFirst({
    where: {
      status: "active",
      wish: { userId: currentUserId },
    },
    include: {
      wish: true,
      reflections: {
        orderBy: { reflectionDate: "desc" },
        take: 1,
      },
    },
  });

  const latestReflection = activeQuestion?.reflections[0] || null;

  const continueTemplate = activeQuestion
    ? {
        wish_text: activeQuestion.wish.text,
        reason: activeQuestion.wish.reason || "",
        current_state: latestReflection?.learned || activeQuestion.wish.currentState || "",
        not_yet: latestReflection?.unknown || activeQuestion.wish.notYet || "",
        desired_state: latestReflection?.nextStepText || activeQuestion.wish.desiredState || "",
        question_text: "",
        purpose_focus: "compare",
      }
    : {
        wish_text: "",
        reason: "",
        current_state: "",
        not_yet: "",
        desired_state: "",
        question_text: "",
        purpose_focus: "compare",
      };

  const newTemplate = {
    wish_text: "",
    reason: "",
    current_state: "",
    not_yet: "",
    desired_state: "",
    question_text: "",
    purpose_focus: "compare",
  };

  return (
    <PageShell>
      <UserSwitcher users={users} currentUserId={currentUserId} />
      <QuestionsClient
        continueTemplate={continueTemplate}
        newTemplate={newTemplate}
        initialMode={activeQuestion ? requestedMode : "new"}
        hasActiveWish={Boolean(activeQuestion)}
        forceTemplate={fromReflection}
        continueSummary={
          activeQuestion
            ? {
                wish_text: activeQuestion.wish.text,
                reason: activeQuestion.wish.reason || "",
                before_current_state: activeQuestion.wish.currentState || "",
                before_not_yet: activeQuestion.wish.notYet || "",
                before_desired_state: activeQuestion.wish.desiredState || "",
                after_current_state: continueTemplate.current_state,
                after_not_yet: continueTemplate.not_yet,
                after_desired_state: continueTemplate.desired_state,
              }
            : null
        }
      />
    </PageShell>
  );
}
