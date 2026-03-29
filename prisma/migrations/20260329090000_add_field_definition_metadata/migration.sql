CREATE TYPE "QuestionFieldRole" AS ENUM ('core', 'compare', 'optional');

ALTER TABLE "QuestionFieldDefinition"
ADD COLUMN "role" "QuestionFieldRole" NOT NULL DEFAULT 'core',
ADD COLUMN "why" TEXT,
ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
