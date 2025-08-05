// This script will connect to the database and remove the failed migration record
// Run this locally with your production DATABASE_URL to fix the issue

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixFailedMigration() {
  try {
    console.log('Checking migration status...');
    
    // Check current migrations
    const migrations = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20250121_fix_staff_deletion_constraints'
    `;
    
    console.log('Found migrations:', migrations);
    
    if (migrations.length > 0) {
      console.log('Removing failed migration record...');
      
      // Remove the failed migration
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = '20250121_fix_staff_deletion_constraints'
      `;
      
      console.log('✅ Failed migration record removed!');
      console.log('You can now redeploy and migrations should proceed.');
    } else {
      console.log('No failed migration found.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration();