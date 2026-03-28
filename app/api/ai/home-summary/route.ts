import { NextRequest, NextResponse } from "next/server";
import { generateHomeSummary } from "@/lib/ai";
import { homeSummarySchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const input = homeSummarySchema.parse(json);
    const result = await generateHomeSummary(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      state_label: "記録をためる時期",
      trajectory_summary: "記録が少しずつたまっています。",
      next_step_summary: "記録が少しずつたまっています。次も同じ見方で1件残してみよう",
      character_message: "同じ見方で、もう1件残してみよう。",
    });
  }
}
