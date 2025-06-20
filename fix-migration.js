// Script to fix failed migration state in production
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function fixMigration() {
  try {
    console.log('🔄 Fixing failed migration state...');

    // Mark the failed migration as applied since the tables already exist
    await prisma.$executeRaw`
      UPDATE "_prisma_migrations" 
      SET finished_at = NOW(), logs = 'Manually resolved - tables already exist'
      WHERE migration_name = '20250620_add_daily_schedule_system' 
      AND finished_at IS NULL;
    `;

    console.log('✅ Migration state fixed');
    
    // Verify the tables exist
    const dailyStateCount = await prisma.dailyScheduleState.count();
    const sessionReviewCount = await prisma.sessionReview.count();
    
    console.log(`📊 DailyScheduleState records: ${dailyStateCount}`);
    console.log(`📊 SessionReview records: ${sessionReviewCount}`);
    
  } catch (error) {
    console.error('❌ Error fixing migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixMigration()
  .then(() => {
    console.log('✅ Migration fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration fix failed:', error);
    process.exit(1);
  });