import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Manual migration endpoint for fixing staff deletion constraints
router.post('/migrate-staff-deletion-constraints', async (req, res) => {
  try {
    console.log('Starting staff deletion constraint migration...');
    
    // Run the migration SQL
    await prisma.$executeRawUnsafe(`
      -- Fix staff deletion by updating foreign key constraints to SET NULL
      -- This allows staff to be deleted while preserving historical records

      -- ChangeLog table - Set staff reference to NULL when staff is deleted
      ALTER TABLE "ChangeLog" 
      DROP CONSTRAINT IF EXISTS "ChangeLog_staffId_fkey";

      ALTER TABLE "ChangeLog" 
      ADD CONSTRAINT "ChangeLog_staffId_fkey" 
      FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    await prisma.$executeRawUnsafe(`
      -- DailyOverride table - Set staff references to NULL when staff is deleted
      ALTER TABLE "DailyOverride" 
      DROP CONSTRAINT IF EXISTS "DailyOverride_originalStaffId_fkey";

      ALTER TABLE "DailyOverride" 
      ADD CONSTRAINT "DailyOverride_originalStaffId_fkey" 
      FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DailyOverride" 
      DROP CONSTRAINT IF EXISTS "DailyOverride_newStaffId_fkey";

      ALTER TABLE "DailyOverride" 
      ADD CONSTRAINT "DailyOverride_newStaffId_fkey" 
      FOREIGN KEY ("newStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    await prisma.$executeRawUnsafe(`
      -- ReassignmentNeeded table - Set staff references to NULL when staff is deleted
      ALTER TABLE "ReassignmentNeeded" 
      DROP CONSTRAINT IF EXISTS "ReassignmentNeeded_originalStaffId_fkey";

      ALTER TABLE "ReassignmentNeeded" 
      ADD CONSTRAINT "ReassignmentNeeded_originalStaffId_fkey" 
      FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ReassignmentNeeded" 
      DROP CONSTRAINT IF EXISTS "ReassignmentNeeded_plannedReplacementStaffId_fkey";

      ALTER TABLE "ReassignmentNeeded" 
      ADD CONSTRAINT "ReassignmentNeeded_plannedReplacementStaffId_fkey" 
      FOREIGN KEY ("plannedReplacementStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    await prisma.$executeRawUnsafe(`
      -- DailyAssignmentState table - Set staff reference to NULL when staff is deleted
      ALTER TABLE "DailyAssignmentState" 
      DROP CONSTRAINT IF EXISTS "DailyAssignmentState_currentStaffId_fkey";

      ALTER TABLE "DailyAssignmentState" 
      ADD CONSTRAINT "DailyAssignmentState_currentStaffId_fkey" 
      FOREIGN KEY ("currentStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    console.log('Staff deletion constraint migration completed successfully');
    res.json({ 
      success: true, 
      message: 'Staff deletion constraints updated successfully. Staff can now be deleted while preserving historical records.' 
    });
  } catch (error: any) {
    console.error('Error during staff deletion constraint migration:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Migration failed', 
      details: error.message 
    });
  }
});

export { router as adminRoutes };