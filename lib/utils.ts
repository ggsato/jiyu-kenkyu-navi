import { format } from "date-fns";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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
