CREATE TABLE "ObservationFieldDefinition" (
    "id" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "RecordFieldType" NOT NULL,
    "unit" TEXT,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" "QuestionFieldRole" NOT NULL DEFAULT 'core',
    "why" TEXT,
    "howToUse" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "derivedFromFieldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuestionObservationFocus" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "isSelected" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionObservationFocus_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ObservationFieldDefinition" (
    "id",
    "wishId",
    "key",
    "label",
    "type",
    "unit",
    "options",
    "role",
    "why",
    "howToUse",
    "isDefault",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    'obs_' || qfd."id",
    q."wishId",
    qfd."key",
    qfd."label",
    qfd."type",
    qfd."unit",
    qfd."options",
    qfd."role",
    qfd."why",
    qfd."howToUse",
    qfd."isDefault",
    qfd."sortOrder",
    qfd."createdAt",
    qfd."updatedAt"
FROM "QuestionFieldDefinition" qfd
JOIN "Question" q ON q."id" = qfd."questionId";

INSERT INTO "QuestionObservationFocus" (
    "id",
    "questionId",
    "fieldDefinitionId",
    "isSelected",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    'focus_' || qfd."id",
    qfd."questionId",
    'obs_' || qfd."id",
    true,
    qfd."sortOrder",
    qfd."createdAt",
    qfd."updatedAt"
FROM "QuestionFieldDefinition" qfd;

CREATE UNIQUE INDEX "ObservationFieldDefinition_wishId_key_key" ON "ObservationFieldDefinition"("wishId", "key");
CREATE INDEX "ObservationFieldDefinition_wishId_sortOrder_idx" ON "ObservationFieldDefinition"("wishId", "sortOrder");
CREATE INDEX "ObservationFieldDefinition_derivedFromFieldId_idx" ON "ObservationFieldDefinition"("derivedFromFieldId");

CREATE UNIQUE INDEX "QuestionObservationFocus_questionId_fieldDefinitionId_key" ON "QuestionObservationFocus"("questionId", "fieldDefinitionId");
CREATE INDEX "QuestionObservationFocus_questionId_sortOrder_idx" ON "QuestionObservationFocus"("questionId", "sortOrder");
CREATE INDEX "QuestionObservationFocus_fieldDefinitionId_idx" ON "QuestionObservationFocus"("fieldDefinitionId");

ALTER TABLE "ObservationFieldDefinition" ADD CONSTRAINT "ObservationFieldDefinition_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "Wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ObservationFieldDefinition" ADD CONSTRAINT "ObservationFieldDefinition_derivedFromFieldId_fkey" FOREIGN KEY ("derivedFromFieldId") REFERENCES "ObservationFieldDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionObservationFocus" ADD CONSTRAINT "QuestionObservationFocus_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionObservationFocus" ADD CONSTRAINT "QuestionObservationFocus_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "ObservationFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "QuestionFieldDefinition";
