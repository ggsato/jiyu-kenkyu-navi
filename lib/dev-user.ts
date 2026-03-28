import { prisma } from "@/lib/prisma";
import { DEV_USER_ID } from "@/lib/constants";
import { ensureFamilyUsers } from "@/lib/current-user";

export async function ensureDevUser() {
  await ensureFamilyUsers();

  return prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      name: process.env.DEV_USER_NAME || "開発ユーザー",
    },
  });
}
