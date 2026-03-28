import { PurposeFocus } from "@prisma/client";

export const PRIMARY_PURPOSE_FOCUS_OPTIONS: Array<{
  value: "compare" | "relate" | "predict";
  label: string;
  description: string;
}> = [
  { value: "compare", label: "くらべる", description: "ちがいを見る" },
  { value: "relate", label: "つなげる", description: "いっしょに起きることを見る" },
  { value: "predict", label: "たしかめる", description: "次を見立てて確かめる" },
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
