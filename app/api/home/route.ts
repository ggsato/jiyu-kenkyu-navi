import { NextRequest, NextResponse } from "next/server";
import { buildHomePayload } from "@/lib/home";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserIdFromRequest(request);
  const payload = await buildHomePayload(userId);
  return NextResponse.json(payload);
}
