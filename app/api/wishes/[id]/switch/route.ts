import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    const { id } = await context.params;

    const wish = await prisma.wish.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        questions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const targetQuestion = wish?.questions[0];

    if (!wish || !targetQuestion) {
      return NextResponse.json({ error: "その願いは見つかりませんでした" }, { status: 404 });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.question.updateMany({
        where: {
          status: "active",
          wish: { userId },
        },
        data: { status: "archived" },
      });

      await tx.question.update({
        where: { id: targetQuestion.id },
        data: { status: "active" },
      });
    });

    return NextResponse.json({ ok: true, wishId: wish.id, questionId: targetQuestion.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "願いを切り替えられませんでした" }, { status: 400 });
  }
}
