import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CURRENT_USER_COOKIE } from "@/lib/constants";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function POST(request: NextRequest) {
  try {
    const json = (await request.json()) as { user_id?: string };
    const userId = json.user_id;

    if (!userId) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const currentUserId = await getCurrentUserIdFromRequest(request);
    const currentMembership = await prisma.familyMember.findFirst({
      where: { userId: currentUserId },
      select: { familyId: true },
    });
    const membership = await prisma.familyMember.findFirst({
      where: {
        userId,
        familyId: currentMembership?.familyId,
      },
      include: { user: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "そのユーザーはありません" }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true, user: membership.user });
    response.cookies.set(CURRENT_USER_COOKIE, membership.user.id, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "ユーザーを切り替えられませんでした" }, { status: 400 });
  }
}
