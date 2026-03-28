import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALLOWED_IMAGE_TYPES, MAX_ATTACHMENTS_PER_RECORD, MAX_ATTACHMENT_SIZE } from "@/lib/constants";
import { saveUploadedFile } from "@/lib/uploads";
import { logEvent } from "@/lib/logging";
import { getCurrentUserIdFromRequest } from "@/lib/current-user";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserIdFromRequest(request);
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return NextResponse.json({ error: "jpg / png / webp の画像のみ保存できます" }, { status: 400 });
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      return NextResponse.json({ error: "画像サイズは10MBまでです" }, { status: 400 });
    }

    const record = await prisma.record.findFirst({
      where: {
        id,
        question: {
          wish: { userId },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "その記録は見つかりませんでした" }, { status: 404 });
    }

    const count = await prisma.recordAttachment.count({
      where: { recordId: id },
    });

    if (count >= MAX_ATTACHMENTS_PER_RECORD) {
      return NextResponse.json({ error: "画像は1記録3件までです" }, { status: 400 });
    }

    const saved = await saveUploadedFile(file);

    const attachment = await prisma.recordAttachment.create({
      data: {
        recordId: id,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        fileSize: saved.fileSize,
        sortOrder: count,
      },
    });

    await logEvent("attachment_uploaded", {
      recordId: id,
      attachmentId: attachment.id,
      mimeType: attachment.mimeType,
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "画像を保存できませんでした" }, { status: 400 });
  }
}
