import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";
import { getTodayDateInAppTimeZone } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId");
  const today = getTodayDateInAppTimeZone();
  const userId = await getCurrentUserIdFromRequest(request);

  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  const reflection = await prisma.reflection.findUnique({
    where: {
      questionId_reflectionDate: {
        questionId,
        reflectionDate: today,
      },
    },
  });

  if (!reflection) {
    return NextResponse.json({ reflection: null });
  }

  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      wish: { userId },
    },
  });

  if (!question) {
    return NextResponse.json({ error: "その問いは見つかりませんでした" }, { status: 404 });
  }

  return NextResponse.json({ reflection });
}
