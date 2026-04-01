import { NextRequest, NextResponse } from "next/server";
import { generateSplitFieldSuggestions } from "@/lib/ai";
import { recordFieldSplitSuggestSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = recordFieldSplitSuggestSchema.parse(json);
    const result = await generateSplitFieldSuggestions(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      split_candidates: [],
      error: "細分化候補を作れませんでした",
    });
  }
}
