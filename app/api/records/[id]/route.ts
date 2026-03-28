import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateRecordSchema } from "@/lib/validation";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const json = await request.json();
    const input = updateRecordSchema.parse(json);
    const userId = await getCurrentUserIdFromRequest(request);
    const existing = await prisma.record.findFirst({
      where: {
        id,
        question: {
          wish: { userId },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "その記録は見つかりませんでした" }, { status: 404 });
    }

    const record = await prisma.record.update({
      where: { id },
      data: {
        recordedAt: input.recorded_at ? new Date(input.recorded_at) : undefined,
        body: input.body,
        memo: input.memo,
        kvFields: input.kv_fields,
        tags: input.tags,
      },
      include: { attachments: true },
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "記録を更新できませんでした" }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const userId = await getCurrentUserIdFromRequest(_);
    const existing = await prisma.record.findFirst({
      where: {
        id,
        question: {
          wish: { userId },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "その記録は見つかりませんでした" }, { status: 404 });
    }

    await prisma.record.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "記録を削除できませんでした" }, { status: 400 });
  }
}
