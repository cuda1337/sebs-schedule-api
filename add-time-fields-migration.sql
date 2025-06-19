-- Add startTime and endTime fields to LunchGroup table
ALTER TABLE "LunchGroup" ADD COLUMN "startTime" TEXT;
ALTER TABLE "LunchGroup" ADD COLUMN "endTime" TEXT;

-- Update existing groups with default times
UPDATE "LunchGroup" SET "startTime" = '12:30' WHERE "startTime" IS NULL;
UPDATE "LunchGroup" SET "endTime" = '13:00' WHERE "endTime" IS NULL;