import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";
import { updateFamilyMemberSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/errors";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const currentUserId = await getCurrentUserIdFromRequest(request);
    const { id } = await context.params;
    const json = await request.json();
    const input = updateFamilyMemberSchema.parse(json);

    const currentMembership = await prisma.familyMember.findFirst({
      where: { userId: currentUserId },
      select: { familyId: true },
    });

    if (!currentMembership) {
      return NextResponse.json({ error: "家族が見つかりませんでした" }, { status: 404 });
    }

    const targetMembership = await prisma.familyMember.findFirst({
      where: {
        userId: id,
        familyId: currentMembership.familyId,
      },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "そのメンバーは見つかりませんでした" }, { status: 404 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { name: input.name },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "表示名を更新できませんでした") }, { status: 400 });
  }
}
