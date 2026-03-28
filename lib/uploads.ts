import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export async function saveUploadedFile(file: File) {
  const uploadDir = process.env.UPLOAD_DIR || "public/uploads";
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const relativePath = path.join(uploadDir, filename);
  const absolutePath = path.join(process.cwd(), relativePath);
  const arrayBuffer = await file.arrayBuffer();

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(arrayBuffer));

  return {
    storageKey: relativePath,
    fileSize: file.size,
    mimeType: file.type,
  };
}
