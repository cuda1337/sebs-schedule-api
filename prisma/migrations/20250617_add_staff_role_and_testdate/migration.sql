-- Add role and testDate fields to Staff table

-- AlterTable - Add columns only if they don't exist
DO $$ 
BEGIN
    -- Add role column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'role') THEN
        ALTER TABLE "Staff" ADD COLUMN "role" TEXT;
    END IF;
    
    -- Add testDate column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'testDate') THEN
        ALTER TABLE "Staff" ADD COLUMN "testDate" TEXT;
    END IF;
    
    -- Add active column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'active') THEN
        ALTER TABLE "Staff" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- Update existing records to have default role
UPDATE "Staff" SET "role" = 'RBT' WHERE "role" IS NULL;