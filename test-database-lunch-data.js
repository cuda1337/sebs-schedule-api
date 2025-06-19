const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLunchScheduleData() {
  try {
    console.log('=== CHECKING LUNCH SCHEDULE DATABASE ===\n');
    
    // Check all lunch schedules
    console.log('1. All LunchSchedule records:');
    const schedules = await prisma.$queryRaw`
      SELECT id, date, location, "isFinalized", "createdBy", "createdAt"
      FROM "LunchSchedule" 
      ORDER BY date DESC, location
    `;
    
    if (schedules.length === 0) {
      console.log('   No lunch schedules found in database');
    } else {
      schedules.forEach(schedule => {
        console.log(`   ID: ${schedule.id}, Date: ${schedule.date.toISOString().split('T')[0]}, Location: ${schedule.location}, Finalized: ${schedule.isFinalized}`);
      });
    }
    
    console.log('\n2. All LunchTimeBlock records:');
    const timeBlocks = await prisma.$queryRaw`
      SELECT tb.id, tb."lunchScheduleId", tb."startTime", tb."endTime", tb.label,
             ls.date, ls.location
      FROM "LunchTimeBlock" tb
      JOIN "LunchSchedule" ls ON ls.id = tb."lunchScheduleId"
      ORDER BY ls.date DESC, tb."startTime"
    `;
    
    if (timeBlocks.length === 0) {
      console.log('   No time blocks found in database');
    } else {
      timeBlocks.forEach(tb => {
        console.log(`   TimeBlock ID: ${tb.id}, Schedule: ${tb.date.toISOString().split('T')[0]} ${tb.location}, Time: ${tb.startTime}-${tb.endTime}`);
      });
    }
    
    console.log('\n3. All LunchGroup records:');
    const groups = await prisma.$queryRaw`
      SELECT lg.id, lg."timeBlockId", lg."primaryStaff", lg.helpers, lg."groupName",
             tb."startTime", tb."endTime", ls.date, ls.location
      FROM "LunchGroup" lg
      JOIN "LunchTimeBlock" tb ON tb.id = lg."timeBlockId"
      JOIN "LunchSchedule" ls ON ls.id = tb."lunchScheduleId"
      ORDER BY ls.date DESC, tb."startTime", lg.id
    `;
    
    if (groups.length === 0) {
      console.log('   No lunch groups found in database');
    } else {
      groups.forEach(group => {
        console.log(`   Group ID: ${group.id}, Schedule: ${group.date.toISOString().split('T')[0]} ${group.location}, Staff: ${group.primaryStaff}, Name: ${group.groupName}`);
      });
    }
    
    console.log('\n4. All LunchGroupClient records:');
    const groupClients = await prisma.$queryRaw`
      SELECT lgc.*, c.name as client_name,
             lg.id as group_id, tb."startTime", ls.date, ls.location
      FROM "LunchGroupClient" lgc
      JOIN "Client" c ON c.id = lgc."clientId"
      JOIN "LunchGroup" lg ON lg.id = lgc."lunchGroupId"
      JOIN "LunchTimeBlock" tb ON tb.id = lg."timeBlockId"
      JOIN "LunchSchedule" ls ON ls.id = tb."lunchScheduleId"
      ORDER BY ls.date DESC, tb."startTime", lgc."displayOrder"
    `;
    
    if (groupClients.length === 0) {
      console.log('   No lunch group clients found in database');
    } else {
      groupClients.forEach(gc => {
        console.log(`   Client: ${gc.client_name}, Schedule: ${gc.date.toISOString().split('T')[0]} ${gc.location}, Group: ${gc.group_id}`);
      });
    }
    
    // Test specific date that might have data
    console.log('\n5. Testing common dates that might have data:');
    const testDates = ['2025-06-17', '2025-06-16', '2025-06-15'];
    const testLocations = ['Navarre', 'Pensacola', 'Gulf Breeze'];
    
    for (const date of testDates) {
      for (const location of testLocations) {
        const testSchedule = await prisma.$queryRaw`
          SELECT id, date, location, "isFinalized"
          FROM "LunchSchedule" 
          WHERE date = ${new Date(date)}::date AND location = ${location}
        `;
        
        if (testSchedule.length > 0) {
          console.log(`   Found schedule for ${date} ${location}: ID ${testSchedule[0].id}`);
          
          // Get time blocks for this schedule
          const testTimeBlocks = await prisma.$queryRaw`
            SELECT COUNT(*) as block_count
            FROM "LunchTimeBlock" 
            WHERE "lunchScheduleId" = ${testSchedule[0].id}
          `;
          
          const testGroups = await prisma.$queryRaw`
            SELECT COUNT(*) as group_count
            FROM "LunchGroup" lg
            JOIN "LunchTimeBlock" tb ON tb.id = lg."timeBlockId"
            WHERE tb."lunchScheduleId" = ${testSchedule[0].id}
          `;
          
          console.log(`     Time blocks: ${testTimeBlocks[0].block_count}, Groups: ${testGroups[0].group_count}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking lunch schedule data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLunchScheduleData();