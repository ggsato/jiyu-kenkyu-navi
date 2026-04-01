import { NextRequest, NextResponse } from "next/server";
import { recordFieldsSuggestSchema } from "@/lib/validation";
import { buildWishObservationFieldCandidates } from "@/lib/question-field-definitions";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = recordFieldsSuggestSchema.parse(json);
    const result = await buildWishObservationFieldCandidates(input.wish_id, input.question_text, input.purpose_focus, input);

    return NextResponse.json({
      suggested_fields: result.fields,
      selected_existing_keys: result.selectedExistingKeys,
      split_existing_keys: result.splitExistingKeys,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      suggested_fields: [
        { key: "when", label: "いつ", type: "text", unit: null, options: [] },
        { key: "what", label: "何をした", type: "text", unit: null, options: [] },
        { key: "how_it_went", label: "どうだった", type: "text", unit: null, options: [] },
      ],
      fallback_message: "まずは、いつ・何をしたか・どうだったか、の3つを残してみよう",
    });
  }
}
