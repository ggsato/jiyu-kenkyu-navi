type ReflectionLike = {
  learned?: string | null;
  unknown?: string | null;
  nextStepText?: string | null;
};

export function buildFlowSummaryText({
  recordInsightSummary,
  latestReflection,
}: {
  recordInsightSummary?: string;
  latestReflection?: ReflectionLike | null;
}) {
  const parts = [recordInsightSummary?.trim() || ""];

  if (latestReflection?.learned?.trim()) {
    parts.push(`気づいたこと: ${latestReflection.learned.trim()}`);
  }

  if (latestReflection?.unknown?.trim()) {
    parts.push(`まだ気になること: ${latestReflection.unknown.trim()}`);
  }

  if (latestReflection?.nextStepText?.trim()) {
    parts.push(`次にやってみたいこと: ${latestReflection.nextStepText.trim()}`);
  }

  return parts.filter(Boolean).join(" / ");
}
