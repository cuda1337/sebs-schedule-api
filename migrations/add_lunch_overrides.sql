-- SQL script to add missing columns to production LunchSchedule table
-- Run this on production database when ready to deploy

-- Check if columns exist before adding them
DO $$ 
BEGIN
    -- Add manuallyMovedToAvailable column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'LunchSchedule' AND column_name = 'manuallyMovedToAvailable') THEN
        ALTER TABLE "LunchSchedule" ADD COLUMN "manuallyMovedToAvailable" INTEGER[] DEFAULT '{}';
        RAISE NOTICE 'Added manuallyMovedToAvailable column';
    END IF;
    
    -- Add manualStayWithStaff column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'LunchSchedule' AND column_name = 'manualStayWithStaff') THEN
        ALTER TABLE "LunchSchedule" ADD COLUMN "manualStayWithStaff" INTEGER[] DEFAULT '{}';
        RAISE NOTICE 'Added manualStayWithStaff column';
    END IF;
    
    -- Add excludedClients column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'LunchSchedule' AND column_name = 'excludedClients') THEN
        ALTER TABLE "LunchSchedule" ADD COLUMN "excludedClients" INTEGER[] DEFAULT '{}';
        RAISE NOTICE 'Added excludedClients column';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'LunchSchedule'
ORDER BY ordinal_position;