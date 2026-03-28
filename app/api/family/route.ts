import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";
import { updateFamilySchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/errors";

export async function PUT(request: NextRequest) {
  try {
    const currentUserId = await getCurrentUserIdFromRequest(request);
    const json = await request.json();
    const input = updateFamilySchema.parse(json);

    const membership = await prisma.familyMember.findFirst({
      where: { userId: currentUserId },
      select: { familyId: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "家族が見つかりませんでした" }, { status: 404 });
    }

    const family = await prisma.family.update({
      where: { id: membership.familyId },
      data: { name: input.name },
    });

    return NextResponse.json({ family });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error, "家族名を更新できませんでした") }, { status: 400 });
  }
}
