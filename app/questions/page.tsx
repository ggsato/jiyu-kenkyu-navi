import { prisma } from "@/lib/prisma";
import { QuestionsClient } from "./questions-client";
import { getCurrentUserId } from "@/lib/current-user";
import { PageShell } from "@/components/ui";

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
      observationFocuses: {
        where: { isSelected: true },
        orderBy: { sortOrder: "asc" },
        include: { fieldDefinition: true },
      },
    },
  });

  const latestReflection = activeQuestion?.reflections[0] || null;

  const continueTemplate = activeQuestion
    ? {
        wish_id: activeQuestion.wish.id,
        wish_text: activeQuestion.wish.text,
        reason: activeQuestion.wish.reason || "",
        current_state: activeQuestion.wish.currentState || "",
        not_yet: activeQuestion.wish.notYet || "",
        desired_state: activeQuestion.wish.desiredState || "",
        next_curiosity_text: latestReflection?.nextStepText || "",
        question_text: "",
        purpose_focus: "compare",
      }
    : {
        wish_id: "",
        wish_text: "",
        reason: "",
        current_state: "",
        not_yet: "",
        desired_state: "",
        next_curiosity_text: "",
        question_text: "",
        purpose_focus: "compare",
      };

  const newTemplate = {
    wish_id: "",
    wish_text: "",
    reason: "",
    current_state: "",
    not_yet: "",
    desired_state: "",
    next_curiosity_text: "",
    question_text: "",
    purpose_focus: "compare",
  };

  return (
    <PageShell>
      <QuestionsClient
        key={`${activeQuestion?.wish.id || "new"}:${requestedMode}:${fromReflection ? "reflection" : "default"}`}
        continueTemplate={continueTemplate}
        newTemplate={newTemplate}
        initialMode={activeQuestion ? requestedMode : "new"}
        hasActiveWish={Boolean(activeQuestion)}
        forceTemplate={fromReflection}
        preferredFieldKeys={
          activeQuestion
            ? activeQuestion.observationFocuses.map((focus) => focus.fieldDefinition.key)
            : []
        }
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
                latest_reflection_learned: latestReflection?.learned || "",
                latest_reflection_unknown: latestReflection?.unknown || "",
                latest_reflection_next_step: latestReflection?.nextStepText || "",
              }
            : null
        }
      />
    </PageShell>
  );
}
