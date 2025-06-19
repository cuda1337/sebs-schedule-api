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
    const { date, location, timeBlocks, createdBy, excludedClients } = req.body;

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
          excludedClients: excludedClients ? excludedClients.map(client => client.id || client.clientId) : [],
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
                  startTime: group.startTime || '12:30',
                  endTime: group.endTime || '13:00',
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
          excludedClients: excludedClients ? excludedClients.map(client => client.id || client.clientId) : [],
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
                  startTime: group.startTime || '12:30',
                  endTime: group.endTime || '13:00',
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
        block: 'AM'
        // Remove versionId filter to include all assignment versions
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

    console.log(`📋 Found ${dailyOverrides.length} daily overrides for ${date}`);\n    \n    // Also check for overrides that don't specify a block (could be full day cancellations)\n    const allDayOverrides = await prisma.dailyOverride.findMany({\n      where: {\n        date: targetDate,\n        day: dayOfWeek,\n        OR: [\n          { block: null },\n          { block: 'Full Day' }\n        ]\n      },\n      include: {\n        originalClient: true,\n        newClient: true,\n        originalStaff: true,\n        newStaff: true\n      }\n    });\n    \n    console.log(`📋 Found ${allDayOverrides.length} all-day overrides for ${date}`);\n    \n    // Combine all overrides\n    const allOverrides = [...dailyOverrides, ...allDayOverrides];\n    console.log(`📋 Total overrides to process: ${allOverrides.length}`);

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
    allOverrides.forEach(override => {\n      console.log(`📋 Processing override: ${override.type} for client ${override.originalClientId}, block: ${override.block}`);
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
        // Remove versionId filter to include all PM assignments
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
    
    // If no clients found, provide helpful debug info
    if (result.availableClients.length === 0) {
      console.log(`📋 No clients with AM assignments found for ${dayOfWeek} at ${location}`);
      
      // Check if we have assignments for this day at other locations
      const anyDayAssignments = await prisma.assignment.findMany({
        where: {
          day: dayOfWeek,
          block: 'AM'
        },
        include: {
          client: true
        }
      });
      
      if (anyDayAssignments.length > 0) {
        const locationsFound = [...new Set(anyDayAssignments.flatMap(a => a.client?.locations || []))];
        console.log(`📋 Found ${anyDayAssignments.length} AM assignments for ${dayOfWeek} at locations: ${locationsFound.join(', ')}`);
        console.log(`📋 To see clients in lunch schedule, make sure they have AM assignments at ${location} on ${dayOfWeek}`);
      } else {
        console.log(`📋 No AM assignments found for ${dayOfWeek} at any location`);
        console.log(`📋 To use lunch schedule, first create AM assignments in the daily schedule`);
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

// PATCH finalize schedule
router.patch('/:id/finalize', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    
    if (isNaN(scheduleId)) {
      return res.status(400).json({ 
        error: 'Invalid schedule ID',
        message: 'Schedule ID must be a number'
      });
    }

    console.log(`🔒 Finalizing lunch schedule ID ${scheduleId}`);

    // Check if schedule exists
    const existingSchedule = await prisma.lunchSchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!existingSchedule) {
      return res.status(404).json({ 
        error: 'Schedule not found',
        message: `Lunch schedule with ID ${scheduleId} not found`
      });
    }

    // Update the schedule to finalized
    const finalizedSchedule = await prisma.lunchSchedule.update({
      where: { id: scheduleId },
      data: {
        isFinalized: true,
        finalizedBy: 'current-user', // TODO: Get from auth context
        finalizedAt: new Date()
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

    console.log(`✅ Successfully finalized lunch schedule ID ${scheduleId}`);
    
    res.json({
      message: 'Lunch schedule finalized successfully',
      data: finalizedSchedule
    });

  } catch (error) {
    console.error('❌ Error finalizing lunch schedule:', error);
    res.status(500).json({ 
      error: 'Failed to finalize lunch schedule',
      details: error.message
    });
  }
});

// PATCH unlock schedule
router.patch('/:id/unlock', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id);
    
    if (isNaN(scheduleId)) {
      return res.status(400).json({ 
        error: 'Invalid schedule ID',
        message: 'Schedule ID must be a number'
      });
    }

    console.log(`🔓 Unlocking lunch schedule ID ${scheduleId}`);

    // Check if schedule exists
    const existingSchedule = await prisma.lunchSchedule.findUnique({
      where: { id: scheduleId }
    });

    if (!existingSchedule) {
      return res.status(404).json({ 
        error: 'Schedule not found',
        message: `Lunch schedule with ID ${scheduleId} not found`
      });
    }

    // Update the schedule to unlocked
    const unlockedSchedule = await prisma.lunchSchedule.update({
      where: { id: scheduleId },
      data: {
        isFinalized: false,
        modifiedAfterFinalization: existingSchedule.isFinalized ? true : existingSchedule.modifiedAfterFinalization,
        lastModifiedBy: 'current-user', // TODO: Get from auth context
        lastModifiedAt: new Date()
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

    console.log(`✅ Successfully unlocked lunch schedule ID ${scheduleId}`);
    
    res.json({
      message: 'Lunch schedule unlocked successfully',
      data: unlockedSchedule
    });

  } catch (error) {
    console.error('❌ Error unlocking lunch schedule:', error);
    res.status(500).json({ 
      error: 'Failed to unlock lunch schedule',
      details: error.message
    });
  }
});

module.exports = router;