-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "PurposeFocus" AS ENUM ('record', 'compare', 'relate', 'predict', 'cause', 'execute');

-- CreateEnum
CREATE TYPE "ModeHint" AS ENUM ('stretch', 'challenge');

-- CreateEnum
CREATE TYPE "SelfProgressSignal" AS ENUM ('forward', 'same', 'harder');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reason" TEXT,
    "currentState" TEXT,
    "notYet" TEXT,
    "desiredState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'active',
    "purposeFocus" "PurposeFocus" NOT NULL,
    "modeHint" "ModeHint" NOT NULL DEFAULT 'stretch',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Record" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "body" TEXT NOT NULL,
    "memo" TEXT,
    "kvFields" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordAttachment" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reflection" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reflectionDate" TEXT NOT NULL,
    "learned" TEXT,
    "unknown" TEXT,
    "nextStepText" TEXT,
    "selfProgressSignal" "SelfProgressSignal" NOT NULL,
    "distanceDelta" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reflection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wish_userId_createdAt_idx" ON "Wish"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Question_wishId_status_createdAt_idx" ON "Question"("wishId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Record_questionId_recordedAt_idx" ON "Record"("questionId", "recordedAt");

-- CreateIndex
CREATE INDEX "RecordAttachment_recordId_sortOrder_idx" ON "RecordAttachment"("recordId", "sortOrder");

-- CreateIndex
CREATE INDEX "Reflection_questionId_reflectionDate_idx" ON "Reflection"("questionId", "reflectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "Reflection_questionId_reflectionDate_key" ON "Reflection"("questionId", "reflectionDate");

-- AddForeignKey
ALTER TABLE "Wish" ADD CONSTRAINT "Wish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "Wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Record" ADD CONSTRAINT "Record_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordAttachment" ADD CONSTRAINT "RecordAttachment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "Record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reflection" ADD CONSTRAINT "Reflection_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
