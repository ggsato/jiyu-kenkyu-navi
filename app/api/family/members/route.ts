import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";
import { createFamilyMemberSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserIdFromRequest(request);
    const json = await request.json();
    const input = createFamilyMemberSchema.parse(json);

    const membership = await prisma.familyMember.findFirst({
      where: { userId: currentUserId },
      select: { familyId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "家族が見つかりませんでした" }, { status: 404 });
    }

    const user = await prisma.user.create({
      data: { name: input.name },
    });

    const familyMember = await prisma.familyMember.create({
      data: {
        familyId: membership.familyId,
        userId: user.id,
        role: "member",
      },
      include: { user: true },
    });

    return NextResponse.json({ member: familyMember }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "家族メンバーを追加できませんでした") }, { status: 400 });
  }
}
