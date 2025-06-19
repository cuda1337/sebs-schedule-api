const { PrismaClient } = require('@prisma/client');

async function checkDatabaseData() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Checking database data...\n');

  try {
    // Check clients
    const clients = await prisma.client.findMany();
    console.log(`📊 Clients: ${clients.length}`);
    if (clients.length > 0) {
      console.log('First few clients:', clients.slice(0, 3).map(c => ({ id: c.id, name: c.name })));
    }

    // Check staff
    const staff = await prisma.staff.findMany();
    console.log(`📊 Staff: ${staff.length}`);
    if (staff.length > 0) {
      console.log('First few staff:', staff.slice(0, 3).map(s => ({ id: s.id, name: s.name })));
    }

    // Check lunch schedules
    const lunchSchedules = await prisma.lunchSchedule.findMany();
    console.log(`📊 Lunch Schedules: ${lunchSchedules.length}`);

    console.log('\n🎯 Database status:', {
      hasClients: clients.length > 0,
      hasStaff: staff.length > 0,
      hasLunchSchedules: lunchSchedules.length > 0
    });

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseData();