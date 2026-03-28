export const DEV_USER_ID = "dev-user-fixed";
export const CURRENT_USER_COOKIE = "jiyu-nav-user";
export const DEV_FAMILY_ID = "dev-family-fixed";
export const QUESTION_CANDIDATE_FALLBACK = "いまの願いから、まずは小さく記録できる問いを考えてみよう";
export const RECORD_FIELD_FALLBACK = "まずは、いつ・何をしたか・どうだったか、の3つを残してみよう";
export const HOME_SUMMARY_FALLBACK = "記録が少しずつたまっています。次も同じ見方で1件残してみよう";
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_RECORD = 3;

export const DEV_FAMILY = {
  id: DEV_FAMILY_ID,
  name: "サンプル家族",
  members: [
    { id: "dev-user-fixed", name: "開発ユーザー", role: "owner" },
    { id: "family-user-a", name: "家族A", role: "member" },
    { id: "family-user-b", name: "家族B", role: "member" },
  ],
} as const;
