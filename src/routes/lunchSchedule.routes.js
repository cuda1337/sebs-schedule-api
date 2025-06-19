const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET lunch schedule for a specific date and location
router.get('/', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ 
        error: 'Date and location are required',
        message: 'Please provide both date and location query parameters'
      });
    }

    console.log(`📋 Getting lunch schedule for ${date} at ${location}`);

    const lunchSchedule = await prisma.lunchSchedule.findUnique({
      where: {
        date_location: {
          date: new Date(date),
          location: location
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
                  },
                  orderBy: {
                    displayOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      }
    });

    if (!lunchSchedule) {
      console.log(`📋 No lunch schedule found, returning default structure`);
      return res.json({
        message: 'No lunch schedule found for this date/location',
        data: {
          id: null,
          date,
          location,
          isFinalized: false,
          timeBlocks: [],
          createdBy: null,
          createdAt: null
        }
      });
    }

    console.log(`✅ Found lunch schedule with ${lunchSchedule.timeBlocks.length} time blocks`);
    res.json({
      message: 'Lunch schedule retrieved successfully',
      data: lunchSchedule
    });

  } catch (error) {
    console.error('❌ Error fetching lunch schedule:', error);
    res.status(500).json({ 
      error: 'Failed to fetch lunch schedule',
      details: error.message
    });
  }
});

// POST - Create or update lunch schedule
router.post('/', async (req, res) => {
  try {
    const { date, location, timeBlocks, createdBy } = req.body;

    if (!date || !location || !createdBy) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['date', 'location', 'createdBy']
      });
    }

    console.log(`📋 Creating/updating lunch schedule for ${date} at ${location} by ${createdBy}`);
    console.log(`📋 Time blocks provided:`, timeBlocks?.length || 0);

    // Check if lunch schedule already exists
    const existingSchedule = await prisma.lunchSchedule.findUnique({
      where: {
        date_location: {
          date: new Date(date),
          location: location
        }
      }
    });

    let lunchSchedule;

    if (existingSchedule) {
      console.log(`📋 Updating existing schedule ID ${existingSchedule.id}`);
      
      // Delete existing time blocks (cascade will handle groups and clients)
      await prisma.lunchTimeBlock.deleteMany({
        where: {
          lunchScheduleId: existingSchedule.id
        }
      });

      // Update the schedule with new time blocks
      lunchSchedule = await prisma.lunchSchedule.update({
        where: { id: existingSchedule.id },
        data: {
          lastModifiedBy: createdBy,
          lastModifiedAt: new Date(),
          timeBlocks: {
            create: (timeBlocks || []).map(tb => ({
              startTime: tb.startTime || '12:30',
              endTime: tb.endTime || '13:00',
              label: tb.label || 'Lunch',
              groups: {
                create: (tb.groups || []).map(group => ({
                  primaryStaff: group.primaryStaff || '',
                  helpers: Array.isArray(group.helpers) ? group.helpers : 
                           (typeof group.helpers === 'string' ? JSON.parse(group.helpers || '[]') : []),
                  roomLocation: group.roomLocation || '',
                  groupName: group.groupName || '',
                  color: group.color || '#3B82F6',
                  clients: {
                    create: (group.clients || []).map((client, index) => ({
                      clientId: client.clientId || client.id,
                      hasAfternoonSession: client.hasAfternoonSession || false,
                      displayOrder: index
                    }))
                  }
                }))
              }
            }))
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

    } else {
      console.log(`📋 Creating new lunch schedule`);
      
      lunchSchedule = await prisma.lunchSchedule.create({
        data: {
          date: new Date(date),
          location: location,
          createdBy: createdBy,
          timeBlocks: {
            create: (timeBlocks || []).map(tb => ({
              startTime: tb.startTime || '12:30',
              endTime: tb.endTime || '13:00',
              label: tb.label || 'Lunch',
              groups: {
                create: (tb.groups || []).map(group => ({
                  primaryStaff: group.primaryStaff || '',
                  helpers: Array.isArray(group.helpers) ? group.helpers : 
                           (typeof group.helpers === 'string' ? JSON.parse(group.helpers || '[]') : []),
                  roomLocation: group.roomLocation || '',
                  groupName: group.groupName || '',
                  color: group.color || '#3B82F6',
                  clients: {
                    create: (group.clients || []).map((client, index) => ({
                      clientId: client.clientId || client.id,
                      hasAfternoonSession: client.hasAfternoonSession || false,
                      displayOrder: index
                    }))
                  }
                }))
              }
            }))
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
    }

    console.log(`✅ Lunch schedule saved successfully with ID ${lunchSchedule.id}`);
    res.json({
      message: 'Lunch schedule saved successfully',
      data: lunchSchedule
    });

  } catch (error) {
    console.error('❌ Error saving lunch schedule:', error);
    res.status(500).json({ 
      error: 'Failed to save lunch schedule',
      details: error.message
    });
  }
});

// GET available clients for lunch schedule
router.get('/available-clients', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ 
        error: 'Date and location are required',
        message: 'Please provide both date and location query parameters'
      });
    }

    console.log(`📋 Getting available clients for ${date} at ${location}`);

    // Get day of week from date
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`📋 Day of week: ${dayOfWeek}`);
    
    // Find all clients (for now, we'll return all clients since we don't have assignment logic yet)
    const allClients = await prisma.client.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`📋 Found ${allClients.length} total clients`);

    // For testing, we'll return a simple structure
    // Later this can be enhanced with actual assignment logic
    const availableClients = allClients.map(client => ({
      id: client.id,
      name: client.name,
      locations: client.locations || [], // PostgreSQL arrays work directly
      hasAfternoonSession: false, // Default for testing
      staff: [] // Default for testing
    }));

    // For testing, return mock categories
    const result = {
      availableClients: availableClients.filter(c => 
        c.locations.includes(location) || c.locations.length === 0
      ),
      shouldStayWithStaff: [], // Will be populated with actual logic later
      overrides: {
        manuallyMovedToAvailable: [],
        manualStayWithStaff: [],
        excludedClients: []
      }
    };

    console.log(`📋 Returning ${result.availableClients.length} available clients`);
    res.json(result);

  } catch (error) {
    console.error('❌ Error fetching available clients:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available clients',
      details: error.message
    });
  }
});

// POST test data to create sample clients for testing
router.post('/test-data', async (req, res) => {
  try {
    console.log('🧪 Creating test clients and staff for lunch schedule testing...');

    // Create test clients (using PostgreSQL arrays)
    const testClients = [
      { name: 'Emma Thompson', locations: ['Morristown'], availability: {} },
      { name: 'Lucas Martinez', locations: ['Morristown', 'Oak Ridge'], availability: {} },
      { name: 'Sophia Chen', locations: ['Oak Ridge'], availability: {} },
      { name: 'Oliver Davis', locations: ['Morristown'], availability: {} },
      { name: 'Isabella Wilson', locations: ['In-Home'], availability: {} }
    ];

    const clients = await Promise.all(
      testClients.map(client => 
        prisma.client.create({ data: client })
      )
    );

    // Create test staff (using PostgreSQL arrays)
    const testStaff = [
      { name: 'Sarah Johnson', locations: ['Morristown'], availability: {} },
      { name: 'Mike Wilson', locations: ['Oak Ridge'], availability: {} },
      { name: 'Anna Rodriguez', locations: ['Morristown', 'Oak Ridge'], availability: {} }
    ];

    const staff = await Promise.all(
      testStaff.map(staffMember => 
        prisma.staff.create({ data: staffMember })
      )
    );

    console.log(`✅ Created ${clients.length} test clients and ${staff.length} test staff`);
    
    res.json({
      message: 'Test data created successfully',
      data: {
        clients: clients.length,
        staff: staff.length,
        clientNames: clients.map(c => c.name),
        staffNames: staff.map(s => s.name)
      }
    });

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    res.status(500).json({ 
      error: 'Failed to create test data',
      details: error.message
    });
  }
});

module.exports = router;