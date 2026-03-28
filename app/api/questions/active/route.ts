import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserIdFromRequest(request);
  const question = await prisma.question.findFirst({
    where: {
      status: "active",
      wish: {
        userId,
      },
    },
    include: { wish: true },
  });

  return NextResponse.json({ question });
}
