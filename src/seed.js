const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const sampleStaff = [
  {
    name: 'Sarah Johnson',
    locations: ['Morristown', 'Oak Ridge'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': false,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': false,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Mike Chen',
    locations: ['Morristown', 'In-Home'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Emily Rodriguez',
    locations: ['Oak Ridge', 'In-Home'],
    availability: {
      'Monday-AM': false,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': false,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': false,
      'Friday-PM': true,
    }
  },
  {
    name: 'David Kim',
    locations: ['Morristown'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': false,
      'Tuesday-PM': false,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Lisa Thompson',
    locations: ['Oak Ridge', 'In-Home'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': false,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  }
];

const sampleClients = [
  {
    name: 'Alex Thompson',
    locations: ['Morristown'],
    authorizedHours: 20,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': false,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': false,
      'Friday-PM': false,
    }
  },
  {
    name: 'Taylor Martinez',
    locations: ['Oak Ridge'],
    authorizedHours: 16,
    availability: {
      'Monday-AM': false,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': false,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Jordan Williams',
    locations: ['Morristown', 'In-Home'],
    authorizedHours: 24,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': false,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Casey Anderson',
    locations: ['In-Home'],
    authorizedHours: 12,
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': false,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Morgan Davis',
    locations: ['Oak Ridge', 'Morristown'],
    authorizedHours: 30,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  }
];

async function seed() {
  try {
    console.log('🌱 Starting seed...');
    
    // Check if we should clear existing data
    const existingStaff = await prisma.staff.count();
    const existingClients = await prisma.client.count();
    
    if (existingStaff > 0 || existingClients > 0) {
      console.log('⚠️  Database already has data. Skipping seed to avoid duplicates.');
      console.log(`   Existing staff: ${existingStaff}`);
      console.log(`   Existing clients: ${existingClients}`);
      return;
    }
    
    // Create main schedule version if it doesn't exist
    let mainVersion = await prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      console.log('📅 Creating main schedule version...');
      mainVersion = await prisma.scheduleVersion.create({
        data: {
          name: 'Main Schedule',
          type: 'main',
          status: 'active',
          description: 'Primary schedule',
          createdBy: 'system'
        }
      });
      console.log('✅ Created main schedule version');
    }
    
    // Add sample staff
    console.log('\n👥 Creating staff members...');
    const createdStaff = [];
    for (const staffData of sampleStaff) {
      const staff = await prisma.staff.create({
        data: staffData
      });
      createdStaff.push(staff);
      console.log(`✅ Created staff: ${staff.name}`);
    }
    
    // Add sample clients
    console.log('\n👤 Creating clients...');
    const createdClients = [];
    for (const clientData of sampleClients) {
      const client = await prisma.client.create({
        data: clientData
      });
      createdClients.push(client);
      console.log(`✅ Created client: ${client.name}`);
    }
    
    // Create a few sample assignments
    console.log('\n📅 Creating sample assignments...');
    const sampleAssignments = [
      // Monday AM
      { day: 'Monday', block: 'AM', staffId: createdStaff[0].id, clientId: createdClients[0].id },
      { day: 'Monday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[2].id },
      
      // Monday PM
      { day: 'Monday', block: 'PM', staffId: createdStaff[0].id, clientId: createdClients[4].id },
      { day: 'Monday', block: 'PM', staffId: createdStaff[2].id, clientId: createdClients[1].id },
      
      // Tuesday AM
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[1].id },
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[2].id, clientId: createdClients[3].id },
      
      // Wednesday PM
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[0].id, clientId: createdClients[2].id },
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[3].id, clientId: createdClients[0].id },
    ];
    
    let assignmentCount = 0;
    for (const assignmentData of sampleAssignments) {
      try {
        await prisma.assignment.create({
          data: {
            ...assignmentData,
            versionId: mainVersion.id
          }
        });
        assignmentCount++;
      } catch (error) {
        console.log(`⚠️  Skipped assignment due to conflict: ${error.message}`);
      }
    }
    console.log(`✅ Created ${assignmentCount} assignments`);
    
    console.log('\n🎉 Seed completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${createdStaff.length} staff members`);
    console.log(`   - ${createdClients.length} clients`);
    console.log(`   - ${assignmentCount} assignments`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Only run if called directly
if (require.main === module) {
  seed().catch(console.error);
}

module.exports = seed;