// Test the enhanced lunch schedule API directly
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLunchScheduleAPI() {
  try {
    console.log('🧪 Testing enhanced lunch schedule API...');
    
    // Test 1: Check if tables exist
    console.log('1. Checking if tables exist...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('LunchSchedule', 'LunchTimeBlock', 'LunchGroup', 'LunchGroupClient')
      ORDER BY table_name
    `;
    console.log('Tables found:', tables);
    
    // Test 2: Try to create a basic lunch schedule
    console.log('2. Creating test lunch schedule...');
    const testDate = new Date('2025-06-18');
    const testLocation = 'Morristown';
    
    // First, try to delete any existing test data
    try {
      await prisma.lunchSchedule.deleteMany({
        where: {
          date: testDate,
          location: testLocation
        }
      });
      console.log('   Cleaned up existing test data');
    } catch (err) {
      console.log('   No existing test data to clean up');
    }
    
    // Create new lunch schedule
    const lunchSchedule = await prisma.lunchSchedule.create({
      data: {
        date: testDate,
        location: testLocation,
        createdBy: 'test-user',
        timeBlocks: {
          create: {
            startTime: '12:30',
            endTime: '13:00',
            label: 'Test Lunch'
          }
        }
      },
      include: {
        timeBlocks: true
      }
    });
    
    console.log('✅ Test lunch schedule created:', lunchSchedule);
    
    // Test 3: Try to fetch the lunch schedule
    console.log('3. Fetching lunch schedule...');
    const fetchedSchedule = await prisma.lunchSchedule.findUnique({
      where: {
        date_location: {
          date: testDate,
          location: testLocation
        }
      },
      include: {
        timeBlocks: {
          include: {
            groups: {
              include: {
                clients: {
                  include: {
                    client: {
                      select: {
                        id: true,
                        name: true,
                        locations: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    
    console.log('✅ Fetched lunch schedule:', fetchedSchedule);
    
    console.log('🎉 All tests passed! Enhanced lunch schedule API is working.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testLunchScheduleAPI();