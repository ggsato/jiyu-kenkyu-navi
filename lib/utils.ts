import { format } from "date-fns";

const APP_DATE_LOCALE = "en-CA";
export const APP_TIME_ZONE = "Asia/Tokyo";
const APP_DISPLAY_LOCALE = "ja-JP";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function getTodayDateInAppTimeZone(now: Date = new Date()) {
  return new Intl.DateTimeFormat(APP_DATE_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatDateInAppTimeZone(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }

  return new Intl.DateTimeFormat(APP_DISPLAY_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

export function formatDateTimeInAppTimeZone(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }

  return new Intl.DateTimeFormat(APP_DISPLAY_LOCALE, {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toReflectionDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("INVALID_REFLECTION_DATE");
  }

  return format(date, "yyyy-MM-dd");
}

export function toDistanceDelta(signal: "forward" | "same" | "harder") {
  if (signal === "forward") return 30;
  if (signal === "same") return 10;
  return 0;
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
