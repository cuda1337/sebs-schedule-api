-- Add override columns to existing LunchSchedule table
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "isFinalized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "finalizedBy" TEXT;
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "modifiedAfterFinalization" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "lastModifiedBy" TEXT;
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "lastModifiedAt" TIMESTAMP(3);
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "manuallyMovedToAvailable" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "manualStayWithStaff" INTEGER[] NOT NULL DEFAULT '{}';
ALTER TABLE "LunchSchedule" ADD COLUMN IF NOT EXISTS "excludedClients" INTEGER[] NOT NULL DEFAULT '{}';