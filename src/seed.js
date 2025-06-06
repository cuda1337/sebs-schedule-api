const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

const sampleStaff = [
  {
    name: 'Sarah Johnson',
    locations: ['Downtown Clinic', 'North Center'],
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
    locations: ['Downtown Clinic', 'East Branch', 'North Center'],
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
    locations: ['East Branch', 'South Office'],
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
    locations: ['Downtown Clinic', 'West Side'],
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
    locations: ['North Center', 'West Side'],
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
  },
  {
    name: 'James Wilson',
    locations: ['South Office', 'Downtown Clinic'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': false,
      'Wednesday-PM': false,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Maria Garcia',
    locations: ['East Branch'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': false,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Robert Taylor',
    locations: ['West Side', 'North Center'],
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
    name: 'Jennifer Lee',
    locations: ['Downtown Clinic', 'South Office'],
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': false,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': false,
      'Friday-PM': false,
    }
  },
  {
    name: 'Christopher Brown',
    locations: ['North Center'],
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
  }
];

const sampleClients = [
  {
    name: 'Alex Thompson',
    locations: ['Downtown Clinic'],
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
    locations: ['East Branch'],
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
    locations: ['Downtown Clinic', 'North Center'],
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
    locations: ['West Side'],
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
    locations: ['South Office', 'East Branch'],
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
  },
  {
    name: 'Jamie Chen',
    locations: ['North Center'],
    authorizedHours: 15,
    availability: {
      'Monday-AM': false,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': false,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': false,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Skyler Robinson',
    locations: ['Downtown Clinic', 'West Side'],
    authorizedHours: 25,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': false,
      'Tuesday-PM': false,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Riley Johnson',
    locations: ['East Branch'],
    authorizedHours: 18,
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': false,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': false,
      'Friday-PM': true,
    }
  },
  {
    name: 'Cameron White',
    locations: ['South Office'],
    authorizedHours: 20,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': false,
      'Wednesday-PM': false,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Avery Lee',
    locations: ['North Center', 'Downtown Clinic'],
    authorizedHours: 22,
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
    name: 'Quinn Miller',
    locations: ['West Side'],
    authorizedHours: 10,
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': false,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': false,
      'Thursday-AM': false,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Drew Thompson',
    locations: ['East Branch', 'South Office'],
    authorizedHours: 28,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  },
  {
    name: 'Blake Martinez',
    locations: ['Downtown Clinic'],
    authorizedHours: 14,
    availability: {
      'Monday-AM': true,
      'Monday-PM': false,
      'Tuesday-AM': true,
      'Tuesday-PM': false,
      'Wednesday-AM': true,
      'Wednesday-PM': true,
      'Thursday-AM': false,
      'Thursday-PM': true,
      'Friday-AM': false,
      'Friday-PM': true,
    }
  },
  {
    name: 'Parker Wilson',
    locations: ['North Center', 'West Side'],
    authorizedHours: 26,
    availability: {
      'Monday-AM': true,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': true,
      'Wednesday-AM': false,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': true,
      'Friday-AM': true,
      'Friday-PM': false,
    }
  },
  {
    name: 'Reese Garcia',
    locations: ['South Office'],
    authorizedHours: 12,
    availability: {
      'Monday-AM': false,
      'Monday-PM': true,
      'Tuesday-AM': true,
      'Tuesday-PM': false,
      'Wednesday-AM': false,
      'Wednesday-PM': true,
      'Thursday-AM': true,
      'Thursday-PM': false,
      'Friday-AM': true,
      'Friday-PM': true,
    }
  }
];

async function seed() {
  try {
    console.log('🌱 Starting seed...');
    
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.assignment.deleteMany({});
    await prisma.client.deleteMany({});
    await prisma.staff.deleteMany({});
    console.log('✅ Cleared existing data');
    
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
    
    // Create sample assignments
    console.log('\n📅 Creating sample weekly assignments...');
    const sampleAssignments = [
      // Monday AM
      { day: 'Monday', block: 'AM', staffId: createdStaff[0].id, clientId: createdClients[0].id },
      { day: 'Monday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[4].id },
      { day: 'Monday', block: 'AM', staffId: createdStaff[3].id, clientId: createdClients[6].id },
      { day: 'Monday', block: 'AM', staffId: createdStaff[4].id, clientId: createdClients[7].id },
      { day: 'Monday', block: 'AM', staffId: createdStaff[5].id, clientId: createdClients[8].id },
      
      // Monday PM
      { day: 'Monday', block: 'PM', staffId: createdStaff[0].id, clientId: createdClients[2].id },
      { day: 'Monday', block: 'PM', staffId: createdStaff[2].id, clientId: createdClients[1].id },
      { day: 'Monday', block: 'PM', staffId: createdStaff[3].id, clientId: createdClients[9].id },
      { day: 'Monday', block: 'PM', staffId: createdStaff[5].id, clientId: createdClients[11].id },
      { day: 'Monday', block: 'PM', staffId: createdStaff[7].id, clientId: createdClients[13].id },
      
      // Tuesday AM
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[0].id, clientId: createdClients[5].id },
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[1].id },
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[2].id, clientId: createdClients[7].id },
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[4].id, clientId: createdClients[12].id },
      { day: 'Tuesday', block: 'AM', staffId: createdStaff[6].id, clientId: createdClients[11].id },
      
      // Tuesday PM
      { day: 'Tuesday', block: 'PM', staffId: createdStaff[1].id, clientId: createdClients[3].id },
      { day: 'Tuesday', block: 'PM', staffId: createdStaff[2].id, clientId: createdClients[4].id },
      { day: 'Tuesday', block: 'PM', staffId: createdStaff[4].id, clientId: createdClients[9].id },
      { day: 'Tuesday', block: 'PM', staffId: createdStaff[6].id, clientId: createdClients[13].id },
      { day: 'Tuesday', block: 'PM', staffId: createdStaff[7].id, clientId: createdClients[8].id },
      
      // Wednesday AM
      { day: 'Wednesday', block: 'AM', staffId: createdStaff[0].id, clientId: createdClients[2].id },
      { day: 'Wednesday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[1].id },
      { day: 'Wednesday', block: 'AM', staffId: createdStaff[2].id, clientId: createdClients[5].id },
      { day: 'Wednesday', block: 'AM', staffId: createdStaff[3].id, clientId: createdClients[3].id },
      { day: 'Wednesday', block: 'AM', staffId: createdStaff[4].id, clientId: createdClients[10].id },
      
      // Wednesday PM
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[0].id, clientId: createdClients[6].id },
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[1].id, clientId: createdClients[4].id },
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[3].id, clientId: createdClients[0].id },
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[4].id, clientId: createdClients[13].id },
      { day: 'Wednesday', block: 'PM', staffId: createdStaff[8].id, clientId: createdClients[11].id },
      
      // Thursday AM
      { day: 'Thursday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[8].id },
      { day: 'Thursday', block: 'AM', staffId: createdStaff[2].id, clientId: createdClients[1].id },
      { day: 'Thursday', block: 'AM', staffId: createdStaff[3].id, clientId: createdClients[3].id },
      { day: 'Thursday', block: 'AM', staffId: createdStaff[5].id, clientId: createdClients[11].id },
      { day: 'Thursday', block: 'AM', staffId: createdStaff[7].id, clientId: createdClients[9].id },
      
      // Thursday PM
      { day: 'Thursday', block: 'PM', staffId: createdStaff[0].id, clientId: createdClients[0].id },
      { day: 'Thursday', block: 'PM', staffId: createdStaff[1].id, clientId: createdClients[7].id },
      { day: 'Thursday', block: 'PM', staffId: createdStaff[2].id, clientId: createdClients[1].id },
      { day: 'Thursday', block: 'PM', staffId: createdStaff[5].id, clientId: createdClients[13].id },
      { day: 'Thursday', block: 'PM', staffId: createdStaff[7].id, clientId: createdClients[4].id },
      
      // Friday AM
      { day: 'Friday', block: 'AM', staffId: createdStaff[0].id, clientId: createdClients[2].id },
      { day: 'Friday', block: 'AM', staffId: createdStaff[1].id, clientId: createdClients[14].id },
      { day: 'Friday', block: 'AM', staffId: createdStaff[3].id, clientId: createdClients[3].id },
      { day: 'Friday', block: 'AM', staffId: createdStaff[4].id, clientId: createdClients[10].id },
      { day: 'Friday', block: 'AM', staffId: createdStaff[5].id, clientId: createdClients[8].id },
      
      // Friday PM
      { day: 'Friday', block: 'PM', staffId: createdStaff[0].id, clientId: createdClients[5].id },
      { day: 'Friday', block: 'PM', staffId: createdStaff[2].id, clientId: createdClients[1].id },
      { day: 'Friday', block: 'PM', staffId: createdStaff[3].id, clientId: createdClients[11].id },
      { day: 'Friday', block: 'PM', staffId: createdStaff[4].id, clientId: createdClients[14].id },
      { day: 'Friday', block: 'PM', staffId: createdStaff[7].id, clientId: createdClients[4].id },
    ];
    
    // Get the main schedule version
    const mainVersion = await prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      throw new Error('Main schedule version not found');
    }
    
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
        // Skip if assignment conflicts with availability or unique constraints
        console.log(`⚠️  Skipped assignment due to conflict: ${error.message}`);
      }
    }
    console.log(`✅ Created ${assignmentCount} assignments`);
    
    // Create sample group sessions
    console.log('\n👥 Creating sample group sessions...');
    
    const sampleGroupSessions = [
      {
        day: 'Monday',
        block: 'AM',
        staffId: createdStaff[6].id, // Maria Garcia
        location: 'East Branch',
        clients: [createdClients[1].id, createdClients[7].id] // Taylor Martinez, Riley Johnson
      },
      {
        day: 'Wednesday',
        block: 'PM',
        staffId: createdStaff[7].id, // Robert Taylor
        location: 'North Center',
        clients: [createdClients[5].id, createdClients[9].id] // Jamie Chen, Avery Lee
      },
      {
        day: 'Friday',
        block: 'AM',
        staffId: createdStaff[6].id, // Maria Garcia
        location: 'East Branch',
        clients: [createdClients[1].id, createdClients[7].id, createdClients[11].id] // 3 clients
      }
    ];
    
    let groupSessionCount = 0;
    for (const groupData of sampleGroupSessions) {
      try {
        // Create the group session
        const groupSession = await prisma.groupSession.create({
          data: {
            day: groupData.day,
            block: groupData.block,
            staffId: groupData.staffId,
            versionId: mainVersion.id,
            location: groupData.location,
            maxSize: 4
          }
        });
        
        // Add clients to the group
        for (const clientId of groupData.clients) {
          await prisma.groupSessionClient.create({
            data: {
              groupSessionId: groupSession.id,
              clientId: clientId
            }
          });
          
          // Create assignment for each client in the group
          await prisma.assignment.create({
            data: {
              day: groupData.day,
              block: groupData.block,
              staffId: groupData.staffId,
              clientId: clientId,
              versionId: mainVersion.id,
              isGroup: true,
              groupSessionId: groupSession.id
            }
          });
        }
        
        groupSessionCount++;
        console.log(`✅ Created group session for ${groupData.day} ${groupData.block} with ${groupData.clients.length} clients`);
      } catch (error) {
        console.log(`⚠️  Skipped group session due to conflict: ${error.message}`);
      }
    }
    
    console.log('\n🎉 Seed completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ${createdStaff.length} staff members`);
    console.log(`   - ${createdClients.length} clients`);
    console.log(`   - ${assignmentCount} assignments`);
    console.log(`   - ${groupSessionCount} group sessions`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();