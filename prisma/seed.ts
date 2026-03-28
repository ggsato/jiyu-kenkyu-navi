import { PrismaClient, PurposeFocus, QuestionStatus, SelfProgressSignal } from "@prisma/client";

const prisma = new PrismaClient();
const DEV_FAMILY = {
  id: "dev-family-fixed",
  name: "サンプル家族",
  members: [
    { id: "dev-user-fixed", name: "開発ユーザー", role: "owner" as const },
    { id: "family-user-a", name: "家族A", role: "member" as const },
    { id: "family-user-b", name: "家族B", role: "member" as const },
  ],
};

async function main() {
  await prisma.family.upsert({
    where: { id: DEV_FAMILY.id },
    update: {},
    create: {
      id: DEV_FAMILY.id,
      name: DEV_FAMILY.name,
    },
  });

  const members = await Promise.all(
    DEV_FAMILY.members.map((item, index) =>
      prisma.user.upsert({
        where: { id: item.id },
        update: {},
        create: {
          id: item.id,
          name: index === 0 ? process.env.DEV_USER_NAME || item.name : item.name,
        },
      }),
    ),
  );

  await Promise.all(
    DEV_FAMILY.members.map((item) =>
      prisma.familyMember.upsert({
        where: {
          familyId_userId: {
            familyId: DEV_FAMILY.id,
            userId: item.id,
          },
        },
        update: {},
        create: {
          familyId: DEV_FAMILY.id,
          userId: item.id,
          role: item.role,
        },
      }),
    ),
  );

  const user = members[0];

  const questionCount = await prisma.question.count();

  if (questionCount > 0) {
    return user;
  }

  const wish = await prisma.wish.create({
    data: {
      userId: user.id,
      text: "もっと勝てるようになりたい",
      reason: "相手を見て考えて動けるようになりたいから",
      currentState: "なんとなく操作している",
      notYet: "苦しくなる場面を整理できていない",
      desiredState: "どこで困るかを見つけて直せるようになりたい",
    },
  });

  const question = await prisma.question.create({
    data: {
      wishId: wish.id,
      text: "どんな相手のとき、どんな場面で苦しくなりやすいか？",
      status: QuestionStatus.active,
      purposeFocus: PurposeFocus.record,
    },
  });

  await prisma.questionFieldDefinition.createMany({
    data: [
      {
        questionId: question.id,
        key: "opponent_character",
        label: "相手キャラ",
        type: "select",
        options: ["Mario", "Kirby", "Pikachu", "その他"],
        sortOrder: 0,
      },
      {
        questionId: question.id,
        key: "difficult_scene",
        label: "苦しくなった場面",
        type: "select",
        options: ["崖ぎわ", "着地", "近づくとき", "守るとき"],
        sortOrder: 1,
      },
      {
        questionId: question.id,
        key: "result",
        label: "どうだった",
        type: "select",
        options: ["できた", "もう少し", "むずかしい"],
        sortOrder: 2,
      },
    ],
  });

  await prisma.record.createMany({
    data: [
      {
        questionId: question.id,
        recordedAt: new Date(),
        body: "3回対戦して、崖ぎわで苦しくなった",
        memo: "急いで戻ろうとして当たりやすかった",
        kvFields: {
          opponent_character: "Mario",
          difficult_scene: "崖ぎわ",
          result: "むずかしい",
        },
        tags: ["対戦", "崖ぎわ"],
      },
      {
        questionId: question.id,
        recordedAt: new Date(),
        body: "相手キャラを先に見ると少し落ち着いた",
        memo: "始まる前にメモした",
        kvFields: {
          opponent_character: "Kirby",
          result: "できた",
        },
        tags: ["準備"],
      },
    ],
  });

  await prisma.reflection.upsert({
    where: {
      questionId_reflectionDate: {
        questionId: question.id,
        reflectionDate: "2026-03-28",
      },
    },
    update: {},
    create: {
      questionId: question.id,
      reflectionDate: "2026-03-28",
      learned: "崖ぎわで苦しくなりやすい",
      unknown: "どの相手で特に起こるかはまだ不明",
      nextStepText: "次は相手キャラを必ず記録する",
      selfProgressSignal: SelfProgressSignal.forward,
      distanceDelta: 30,
    },
  });

  return user;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
