import { z } from "zod";
import { INPUT_LIMITS } from "@/lib/input-limits";

export const purposeFocusSchema = z.enum(["record", "compare", "relate", "predict", "cause", "execute"]);
export const selfProgressSignalSchema = z.enum(["forward", "same", "harder"]);

export const questionCandidateRequestSchema = z.object({
  wish_text: z.string().trim().min(1, "願いを入れてください").max(INPUT_LIMITS.wish_text, `願いは${INPUT_LIMITS.wish_text}文字までです`),
  reason: z.string().max(INPUT_LIMITS.reason, `理由は${INPUT_LIMITS.reason}文字までです`).optional().default(""),
  current_state: z.string().max(INPUT_LIMITS.current_state, `今できていることは${INPUT_LIMITS.current_state}文字までです`).optional().default(""),
  not_yet: z.string().max(INPUT_LIMITS.not_yet, `まだできていないことは${INPUT_LIMITS.not_yet}文字までです`).optional().default(""),
  desired_state: z.string().max(INPUT_LIMITS.desired_state, `できるようになりたいことは${INPUT_LIMITS.desired_state}文字までです`).optional().default(""),
});

export const createQuestionSchema = questionCandidateRequestSchema.extend({
  question_text: z.string().trim().min(1, "問いを選んでください").max(INPUT_LIMITS.question_text, `問いは${INPUT_LIMITS.question_text}文字までです`),
  purpose_focus: purposeFocusSchema,
});

export const createRecordSchema = z.object({
  question_id: z.string().min(1),
  recorded_at: z.string().datetime().optional(),
  body: z.string().trim().min(1, "何をしたかを入れてください").max(INPUT_LIMITS.record_body, `何をしたかは${INPUT_LIMITS.record_body}文字までです`),
  memo: z.string().max(INPUT_LIMITS.record_memo, `メモは${INPUT_LIMITS.record_memo}文字までです`).optional().nullable(),
  kv_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({}),
  tags: z.array(z.string().max(INPUT_LIMITS.tag, `タグは${INPUT_LIMITS.tag}文字までです`)).optional().default([]),
  source: z.string().optional(),
});

export const updateRecordSchema = z.object({
  recorded_at: z.string().datetime().optional(),
  body: z.string().trim().min(1, "何をしたかを入れてください").max(INPUT_LIMITS.record_body, `何をしたかは${INPUT_LIMITS.record_body}文字までです`).optional(),
  memo: z.string().max(INPUT_LIMITS.record_memo, `メモは${INPUT_LIMITS.record_memo}文字までです`).optional().nullable(),
  kv_fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  tags: z.array(z.string().max(INPUT_LIMITS.tag, `タグは${INPUT_LIMITS.tag}文字までです`)).optional(),
});

export const reflectionSchema = z.object({
  question_id: z.string().min(1),
  reflection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  learned: z.string().max(INPUT_LIMITS.reflection_learned, `今日わかったことは${INPUT_LIMITS.reflection_learned}文字までです`).optional().nullable(),
  unknown: z.string().max(INPUT_LIMITS.reflection_unknown, `まだわからないことは${INPUT_LIMITS.reflection_unknown}文字までです`).optional().nullable(),
  next_step_text: z.string().max(INPUT_LIMITS.reflection_next_step_text, `次にやりたいことは${INPUT_LIMITS.reflection_next_step_text}文字までです`).optional().nullable(),
  self_progress_signal: selfProgressSignalSchema,
});

export const homeSummarySchema = z.object({
  wish_text: z.string(),
  question_text: z.string(),
  recent_records_summary: z.array(z.record(z.string(), z.unknown())),
  latest_reflection: z
    .object({
      self_progress_signal: z.string().nullable().optional(),
      learned: z.string().nullable().optional(),
      unknown: z.string().nullable().optional(),
      next_step_text: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const recordFieldsSuggestSchema = z.object({
  question_text: z.string().min(1),
  purpose_focus: purposeFocusSchema,
  wish_text: z.string().optional().default(""),
  reason: z.string().optional().default(""),
  current_state: z.string().optional().default(""),
  not_yet: z.string().optional().default(""),
  desired_state: z.string().optional().default(""),
  existing_kv_keys: z.array(z.string()).optional().default([]),
});

export const suggestedFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(["text", "number", "boolean", "select"]),
  unit: z.string().nullable().optional(),
  options: z.array(z.string()).optional().default([]),
});

export const uiLogSchema = z.object({
  event: z.enum(["next_step_shown", "next_step_clicked"]),
  question_id: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateFamilySchema = z.object({
  name: z.string().trim().min(1, "家族名を入れてください").max(INPUT_LIMITS.family_name, `家族名は${INPUT_LIMITS.family_name}文字までです`),
});

export const createFamilyMemberSchema = z.object({
  name: z.string().trim().min(1, "表示名を入れてください").max(INPUT_LIMITS.user_name, `表示名は${INPUT_LIMITS.user_name}文字までです`),
});

export const updateFamilyMemberSchema = z.object({
  name: z.string().trim().min(1, "表示名を入れてください").max(INPUT_LIMITS.user_name, `表示名は${INPUT_LIMITS.user_name}文字までです`),
});
