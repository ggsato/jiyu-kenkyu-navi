-- CreateEnum
CREATE TYPE "RecordFieldType" AS ENUM ('text', 'number', 'boolean', 'select');

-- CreateTable
CREATE TABLE "QuestionFieldDefinition" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "RecordFieldType" NOT NULL,
    "unit" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionFieldDefinition_questionId_sortOrder_idx" ON "QuestionFieldDefinition"("questionId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionFieldDefinition_questionId_key_key" ON "QuestionFieldDefinition"("questionId", "key");

-- AddForeignKey
ALTER TABLE "QuestionFieldDefinition" ADD CONSTRAINT "QuestionFieldDefinition_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
