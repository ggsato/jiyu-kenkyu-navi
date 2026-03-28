import { NextRequest, NextResponse } from "next/server";
import { generateRecordFieldSuggestions } from "@/lib/ai";
import { recordFieldsSuggestSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = recordFieldsSuggestSchema.parse(json);
    const result = await generateRecordFieldSuggestions(input);

    return NextResponse.json(result);
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
