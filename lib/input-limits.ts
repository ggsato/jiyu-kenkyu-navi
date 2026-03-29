export const INPUT_LIMITS = {
  family_name: 40,
  user_name: 40,
  wish_text: 120,
  reason: 160,
  current_state: 160,
  not_yet: 160,
  desired_state: 160,
  next_curiosity_text: 160,
  question_text: 80,
  record_body: 160,
  record_memo: 240,
  tag: 20,
  reflection_learned: 160,
  reflection_unknown: 160,
  reflection_next_step_text: 120,
} as const;

export function limitLabel(current: number, max: number) {
  return `${current}/${max}`;
}
