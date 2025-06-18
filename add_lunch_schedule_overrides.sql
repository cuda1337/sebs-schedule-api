-- Migration: Add override fields to LunchSchedule table
-- This adds three integer array fields to track manual client overrides

ALTER TABLE "LunchSchedule" 
ADD COLUMN "manuallyMovedToAvailable" INTEGER[] DEFAULT '{}',
ADD COLUMN "manualStayWithStaff" INTEGER[] DEFAULT '{}',
ADD COLUMN "excludedClients" INTEGER[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN "LunchSchedule"."manuallyMovedToAvailable" IS 'Client IDs manually moved to available (override auto-detection)';
COMMENT ON COLUMN "LunchSchedule"."manualStayWithStaff" IS 'Client IDs manually set to stay with staff';
COMMENT ON COLUMN "LunchSchedule"."excludedClients" IS 'Client IDs excluded from lunch entirely';