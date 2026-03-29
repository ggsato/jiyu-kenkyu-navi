import { NextRequest, NextResponse } from "next/server";
import { generateQuestionCandidates } from "@/lib/ai";
import { getErrorMessage } from "@/lib/errors";
import { logEvent } from "@/lib/logging";
import { questionCandidateRequestSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = questionCandidateRequestSchema.parse(json);
    const result = await generateQuestionCandidates(input);

    await logEvent("question_candidates_generated", {
      candidateCount: result.candidates?.length || 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: getErrorMessage(error, "問い候補を作れませんでした"),
        candidates: [
          {
            text: "いまの願いから、まずは小さく記録できる問いを考えてみよう",
            shape_label: "小さくする",
            purpose_hint: "compare",
            why_this_question: "まずは記録できる形にするため",
          },
        ],
      },
      { status: 200 },
    );
  }
}
