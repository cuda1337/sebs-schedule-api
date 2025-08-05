// Fix failed migration before running migrations
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Checking for failed migrations...');
  
  try {
    // Remove the failed migration record
    const result = await prisma.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = '20250121_fix_staff_deletion_constraints'
      AND rolled_back_at IS NULL
      AND finished_at IS NULL
    `;
    
    if (result > 0) {
      console.log('✅ Removed failed migration record');
    } else {
      console.log('ℹ️ No failed migration found');
    }
    
  } catch (error) {
    // If table doesn't exist or other error, just continue
    console.log('ℹ️ Could not check migrations:', error.message);
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('✅ Pre-migration cleanup complete');
}

main().catch(console.error);