-- Fix staff deletion by updating foreign key constraints to SET NULL
-- This allows staff to be deleted while preserving historical records

-- ChangeLog table - Set staff reference to NULL when staff is deleted
ALTER TABLE "ChangeLog" 
DROP CONSTRAINT IF EXISTS "ChangeLog_staffId_fkey";

ALTER TABLE "ChangeLog" 
ADD CONSTRAINT "ChangeLog_staffId_fkey" 
FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DailyOverride table - Set staff references to NULL when staff is deleted
ALTER TABLE "DailyOverride" 
DROP CONSTRAINT IF EXISTS "DailyOverride_originalStaffId_fkey";

ALTER TABLE "DailyOverride" 
ADD CONSTRAINT "DailyOverride_originalStaffId_fkey" 
FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyOverride" 
DROP CONSTRAINT IF EXISTS "DailyOverride_newStaffId_fkey";

ALTER TABLE "DailyOverride" 
ADD CONSTRAINT "DailyOverride_newStaffId_fkey" 
FOREIGN KEY ("newStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReassignmentNeeded table - Set staff references to NULL when staff is deleted
ALTER TABLE "ReassignmentNeeded" 
DROP CONSTRAINT IF EXISTS "ReassignmentNeeded_originalStaffId_fkey";

ALTER TABLE "ReassignmentNeeded" 
ADD CONSTRAINT "ReassignmentNeeded_originalStaffId_fkey" 
FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReassignmentNeeded" 
DROP CONSTRAINT IF EXISTS "ReassignmentNeeded_plannedReplacementStaffId_fkey";

ALTER TABLE "ReassignmentNeeded" 
ADD CONSTRAINT "ReassignmentNeeded_plannedReplacementStaffId_fkey" 
FOREIGN KEY ("plannedReplacementStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DailyAssignmentState table - Set staff reference to NULL when staff is deleted
ALTER TABLE "DailyAssignmentState" 
DROP CONSTRAINT IF EXISTS "DailyAssignmentState_currentStaffId_fkey";

ALTER TABLE "DailyAssignmentState" 
ADD CONSTRAINT "DailyAssignmentState_currentStaffId_fkey" 
FOREIGN KEY ("currentStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;