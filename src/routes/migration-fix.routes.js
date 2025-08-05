const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Manual migration fix endpoint
router.post('/fix-failed-migration', async (req, res) => {
  try {
    console.log('🔧 Attempting to fix failed migration...');
    
    // First, check the current migration status
    const migrations = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20250121_fix_staff_deletion_constraints'
    `;
    
    console.log('Current migration status:', migrations);
    
    // Mark the failed migration as rolled back
    await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = '20250121_fix_staff_deletion_constraints'
    `;
    
    console.log('✅ Removed failed migration record');
    
    // Now manually apply the corrected constraints
    try {
      // Fix staff deletion constraints
      await prisma.$executeRaw`
        ALTER TABLE "ChangeLog" 
        DROP CONSTRAINT IF EXISTS "ChangeLog_staffId_fkey"
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "ChangeLog" 
        ADD CONSTRAINT "ChangeLog_staffId_fkey" 
        FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "DailyOverride" 
        DROP CONSTRAINT IF EXISTS "DailyOverride_originalStaffId_fkey"
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "DailyOverride" 
        ADD CONSTRAINT "DailyOverride_originalStaffId_fkey" 
        FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "DailyOverride" 
        DROP CONSTRAINT IF EXISTS "DailyOverride_newStaffId_fkey"
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "DailyOverride" 
        ADD CONSTRAINT "DailyOverride_newStaffId_fkey" 
        FOREIGN KEY ("newStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "ReassignmentNeeded" 
        DROP CONSTRAINT IF EXISTS "ReassignmentNeeded_originalStaffId_fkey"
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "ReassignmentNeeded" 
        ADD CONSTRAINT "ReassignmentNeeded_originalStaffId_fkey" 
        FOREIGN KEY ("originalStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "ReassignmentNeeded" 
        DROP CONSTRAINT IF EXISTS "ReassignmentNeeded_plannedStaffId_fkey"
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "ReassignmentNeeded" 
        ADD CONSTRAINT "ReassignmentNeeded_plannedStaffId_fkey" 
        FOREIGN KEY ("plannedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "DailyAssignmentState" 
        DROP CONSTRAINT IF EXISTS "DailyAssignmentState_currentStaffId_fkey"
      `;
      
      await prisma.$executeRaw`
        ALTER TABLE "DailyAssignmentState" 
        ADD CONSTRAINT "DailyAssignmentState_currentStaffId_fkey" 
        FOREIGN KEY ("currentStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
      `;
      
      console.log('✅ Applied all constraint fixes');
      
      // Mark migration as successful
      await prisma.$executeRaw`
        INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
        VALUES (
          gen_random_uuid(),
          '8c7f3b2a1e5d9f4c6b8a0d2e7f1c5b9a3e8d7c2f6a1b4e9d3c7f0a5b2e8d1c6',
          NOW(),
          '20250121_fix_staff_deletion_constraints',
          NULL,
          NULL,
          NOW(),
          1
        )
      `;
      
      console.log('✅ Marked migration as complete');
      
    } catch (error) {
      console.error('Error applying constraints:', error);
      throw error;
    }
    
    res.json({ 
      success: true, 
      message: 'Migration fixed and constraints applied successfully' 
    });
  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    res.status(500).json({ 
      error: 'Failed to fix migration', 
      details: error.message 
    });
  }
});

// Check migration status
router.get('/migration-status', async (req, res) => {
  try {
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at 
      FROM "_prisma_migrations" 
      ORDER BY started_at DESC 
      LIMIT 10
    `;
    
    res.json({ migrations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;