import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CURRENT_USER_COOKIE, DEV_FAMILY, DEV_USER_ID } from "@/lib/constants";

export async function ensureFamilyUsers() {
  await prisma.family.upsert({
    where: { id: DEV_FAMILY.id },
    update: {},
    create: {
      id: DEV_FAMILY.id,
      name: DEV_FAMILY.name,
    },
  });

  for (const member of DEV_FAMILY.members) {
    await prisma.user.upsert({
      where: { id: member.id },
      update: {},
      create: { id: member.id, name: member.name },
    });

    await prisma.familyMember.upsert({
      where: {
        familyId_userId: {
          familyId: DEV_FAMILY.id,
          userId: member.id,
        },
      },
      update: {},
      create: {
        familyId: DEV_FAMILY.id,
        userId: member.id,
        role: member.role,
      },
    });
  }
}

async function getFamilyIdForUser(userId: string) {
  const membership = await prisma.familyMember.findFirst({
    where: { userId },
    select: { familyId: true },
  });

  return membership?.familyId || DEV_FAMILY.id;
}

export async function listAvailableUsers(userId?: string) {
  await ensureFamilyUsers();
  const familyId = await getFamilyIdForUser(userId || DEV_USER_ID);

  const memberships = await prisma.familyMember.findMany({
    where: { familyId },
    orderBy: { createdAt: "asc" },
    include: { user: true },
  });

  return memberships.map((membership) => membership.user);
}

export async function getCurrentUserId() {
  const cookieStore = await cookies();
  const selectedUserId = cookieStore.get(CURRENT_USER_COOKIE)?.value;
  const users = await listAvailableUsers(selectedUserId || DEV_USER_ID);

  if (selectedUserId && users.some((user) => user.id === selectedUserId)) {
    return selectedUserId;
  }

  return users[0]?.id || DEV_USER_ID;
}

export async function getCurrentUser() {
  const userId = await getCurrentUserId();

  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export async function getCurrentFamily(userId?: string) {
  await ensureFamilyUsers();
  const resolvedUserId = userId || (await getCurrentUserId());
  const familyId = await getFamilyIdForUser(resolvedUserId);

  return prisma.family.findUnique({
    where: { id: familyId },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: true },
      },
    },
  });
}

export async function getCurrentUserIdFromRequest(request: NextRequest) {
  const selectedUserId = request.cookies.get(CURRENT_USER_COOKIE)?.value;
  const users = await listAvailableUsers(selectedUserId || DEV_USER_ID);

  if (selectedUserId && users.some((user) => user.id === selectedUserId)) {
    return selectedUserId;
  }

  return users[0]?.id || DEV_USER_ID;
}
