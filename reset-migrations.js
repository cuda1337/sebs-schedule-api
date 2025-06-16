const { PrismaClient } = require('@prisma/client');

async function resetMigrations() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔄 Resetting migration state...');
    
    // Drop the migration tracking table to reset state
    await prisma.$executeRaw`DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;`;
    
    console.log('✅ Migration state reset. Run prisma migrate deploy to apply all migrations fresh.');
    
  } catch (error) {
    console.error('❌ Error resetting migrations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetMigrations();