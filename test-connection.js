const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');
    
    const staffCount = await prisma.staff.count();
    console.log(`📊 Current staff count: ${staffCount}`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();