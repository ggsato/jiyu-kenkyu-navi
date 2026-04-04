import { PurposeFocus } from "@prisma/client";

export const PRIMARY_PURPOSE_FOCUS_OPTIONS: Array<{
  value: "compare" | "relate" | "predict";
  label: string;
  description: string;
}> = [
  { value: "relate", label: "見る", description: "まず何が起きているかをつかむ" },
  { value: "compare", label: "試す", description: "やり方の違いを試し分ける" },
  { value: "predict", label: "続ける", description: "ひとつのやり方や見方を続けて確かめる" },
];

export function getPrimaryPurposeFocusOption(value: string) {
  return PRIMARY_PURPOSE_FOCUS_OPTIONS.find((option) => option.value === value) || PRIMARY_PURPOSE_FOCUS_OPTIONS[0];
}

export function normalizePurposeFocus(value: string): PurposeFocus {
  if (value === "compare" || value === "relate" || value === "predict" || value === "cause" || value === "execute") {
    return value;
  }

  return "compare";
}
