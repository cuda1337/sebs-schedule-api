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

// Debug endpoint to see what assignments exist
router.get('/debug-assignments', async (req, res) => {
  try {
    // First check all assignments without any filters
    const totalAssignments = await prisma.assignment.count();
    console.log(`📋 Total assignments in database: ${totalAssignments}`);
    
    // Get all assignments grouped by day
    const allAssignments = await prisma.assignment.findMany({
      // Remove versionId filter to see all assignments
    
      include: {
        client: {
          select: {
            id: true,
            name: true,
            locations: true
          }
        },
        staff: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { day: 'asc' },
        { block: 'asc' }
      ]
    });

    const summary = {};
    allAssignments.forEach(assignment => {
      const key = `${assignment.day}-${assignment.block}`;
      if (!summary[key]) {
        summary[key] = {
          day: assignment.day,
          block: assignment.block,
          count: 0,
          locations: new Set(),
          sampleClients: []
        };
      }
      summary[key].count++;
      if (assignment.client?.locations) {
        assignment.client.locations.forEach(loc => summary[key].locations.add(loc));
      }
      if (summary[key].sampleClients.length < 3) {
        summary[key].sampleClients.push({
          name: assignment.client?.name,
          locations: assignment.client?.locations
        });
      }
    });

    // Convert locations Set to Array for JSON
    Object.keys(summary).forEach(key => {
      summary[key].locations = Array.from(summary[key].locations);
    });

    res.json({
      totalCount: totalAssignments,
      foundAssignments: allAssignments.length,
      summary,
      sampleAssignments: allAssignments.slice(0, 5).map(a => ({
        id: a.id,
        day: a.day,
        block: a.block,
        versionId: a.versionId,
        clientName: a.client?.name,
        staffName: a.staff?.name,
        locations: a.client?.locations
      }))
    });

  } catch (error) {
    console.error('Error in debug assignments:', error);
    res.status(500).json({ error: error.message });
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
    
    // Find clients who have AM assignments on this day at this location
    const amAssignments = await prisma.assignment.findMany({
      where: {
        day: dayOfWeek,
        block: 'AM',
        versionId: 1 // Main schedule
      },
      include: {
        client: true,
        staff: true
      }
    });

    console.log(`📋 Found ${amAssignments.length} AM assignments for ${dayOfWeek}`);

    // Filter assignments by location and process overrides
    const targetDate = new Date(date);
    const dailyOverrides = await prisma.dailyOverride.findMany({
      where: {
        date: targetDate,
        day: dayOfWeek,
        block: 'AM'
      },
      include: {
        originalClient: true,
        newClient: true,
        originalStaff: true,
        newStaff: true
      }
    });

    console.log(`📋 Found ${dailyOverrides.length} daily overrides for ${date}`);

    // Build a map of effective assignments considering overrides
    const effectiveAssignments = new Map();
    
    // Start with base assignments
    amAssignments.forEach(assignment => {
      const clientLocations = assignment.client?.locations || [];
      if (clientLocations.includes(location)) {
        effectiveAssignments.set(assignment.clientId, {
          clientId: assignment.clientId,
          client: assignment.client,
          staff: assignment.staff,
          isActive: true
        });
      }
    });

    // Apply overrides
    dailyOverrides.forEach(override => {
      if (override.type === 'cancellation' && override.originalClientId) {
        // Client cancelled - remove from available
        effectiveAssignments.delete(override.originalClientId);
      } else if (override.type === 'reassignment' && override.originalClientId && override.newClientId) {
        // Client was reassigned - original client is no longer assigned
        effectiveAssignments.delete(override.originalClientId);
        // New client is now assigned (if they're at this location)
        if (override.newClient) {
          const newClientLocations = override.newClient.locations || [];
          if (newClientLocations.includes(location)) {
            effectiveAssignments.set(override.newClientId, {
              clientId: override.newClientId,
              client: override.newClient,
              staff: override.newStaff || override.originalStaff,
              isActive: true
            });
          }
        }
      }
    });

    // Check for PM assignments to determine hasAfternoonSession
    const pmAssignments = await prisma.assignment.findMany({
      where: {
        day: dayOfWeek,
        block: 'PM',
        versionId: 1,
        clientId: {
          in: Array.from(effectiveAssignments.keys())
        }
      }
    });

    const clientsWithPM = new Set(pmAssignments.map(a => a.clientId));

    // Build final available clients list
    const availableClients = Array.from(effectiveAssignments.values()).map(assignment => ({
      id: assignment.clientId,
      name: assignment.client.name,
      locations: assignment.client.locations || [],
      hasAfternoonSession: clientsWithPM.has(assignment.clientId),
      staff: assignment.staff ? [assignment.staff.name] : []
    }));

    const result = {
      availableClients: availableClients,
      shouldStayWithStaff: [], // Can be enhanced later for auto-categorization
      overrides: {
        manuallyMovedToAvailable: [],
        manualStayWithStaff: [],
        excludedClients: []
      }
    };

    console.log(`📋 Returning ${result.availableClients.length} available clients`);
    
    // Add debug info
    console.log(`📋 Debug info:`);
    console.log(`   - Day: ${dayOfWeek}`);
    console.log(`   - Location: ${location}`);
    console.log(`   - AM assignments found: ${amAssignments.length}`);
    console.log(`   - Daily overrides: ${dailyOverrides.length}`);
    console.log(`   - Effective assignments: ${effectiveAssignments.size}`);
    
    // If no clients found, add a helpful debug response
    if (result.availableClients.length === 0) {
      // Check if we have any assignments for this day regardless of location
      const anyDayAssignments = await prisma.assignment.findMany({
        where: {
          day: dayOfWeek,
          block: 'AM',
          versionId: 1
        },
        include: {
          client: true,
          staff: true
        }
      });
      
      console.log(`📋 Debug: Found ${anyDayAssignments.length} total AM assignments for ${dayOfWeek} (any location)`);
      
      // If we have assignments but not for this location, that's the issue
      if (anyDayAssignments.length > 0) {
        const locationsFound = [...new Set(anyDayAssignments.flatMap(a => a.client?.locations || []))];
        console.log(`📋 Debug: Locations with assignments: ${locationsFound.join(', ')}`);
        
        // Include clients from specific location or if no location restriction
        const locationFilteredClients = anyDayAssignments
          .filter(a => a.client)
          .filter(assignment => {
            const clientLocations = assignment.client?.locations || [];
            // Include if client has the target location OR if location filtering is 'all'
            return clientLocations.includes(location) || 
                   location === 'all' || 
                   clientLocations.length === 0;
          })
          .map(assignment => ({
            id: assignment.clientId,
            name: assignment.client.name,
            locations: assignment.client.locations || [],
            hasAfternoonSession: false, // We'll check PM separately
            staff: assignment.staff ? [assignment.staff.name] : []
          }));
          
        // Check for PM sessions for these clients
        if (locationFilteredClients.length > 0) {
          const pmAssignments = await prisma.assignment.findMany({
            where: {
              day: dayOfWeek,
              block: 'PM',
              versionId: 1,
              clientId: {
                in: locationFilteredClients.map(c => c.id)
              }
            }
          });
          
          const clientsWithPM = new Set(pmAssignments.map(a => a.clientId));
          locationFilteredClients.forEach(client => {
            client.hasAfternoonSession = clientsWithPM.has(client.id);
          });
        }
          
        result.availableClients = locationFilteredClients;
        console.log(`📋 Debug: Including ${locationFilteredClients.length} clients for location '${location}'`);
      }
    }
    
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