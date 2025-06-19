const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get lunch schedule for a specific date and location
router.get('/', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ error: 'Date and location are required' });
    }

    // Use raw SQL to match production schema (only existing columns)
    const lunchSchedule = await prisma.$queryRaw`
      SELECT id, date, location, "createdBy", "createdAt"
      FROM "LunchSchedule" 
      WHERE date = ${new Date(date)}::date AND location = ${location}
    `;

    // Get groups directly from production schema (no time blocks)
    let groups = [];
    if (lunchSchedule.length > 0) {
      const scheduleId = lunchSchedule[0].id;
      
      try {
        groups = await prisma.$queryRaw`
          SELECT lg.id, lg."primaryStaff", lg.helpers, lg."clientIds", lg.color
          FROM "LunchGroup" lg
          WHERE lg."lunchScheduleId" = ${scheduleId}
          ORDER BY lg.id
        `;
      } catch (error) {
        console.log('Error loading lunch groups:', error);
        groups = [];
      }
    }

    if (lunchSchedule.length > 0) {
      // Transform the data to frontend format
      const schedule = lunchSchedule[0];
      
      // Convert groups to the expected format with client details
      const groupsWithClientDetails = [];
      for (const group of groups) {
        const clientIds = group.clientIds || [];
        const clients = [];
        
        // Get client details for each client ID in the group
        for (const clientId of clientIds) {
          try {
            const clientDetails = await prisma.$queryRaw`
              SELECT id, name, locations
              FROM "Client"
              WHERE id = ${clientId}
            `;
            
            if (clientDetails.length > 0) {
              clients.push({
                id: clientDetails[0].id,
                name: clientDetails[0].name,
                locations: clientDetails[0].locations || [],
                hasAfternoonSession: false // Default for now since we don't store this in production
              });
            }
          } catch (error) {
            console.log(`Error loading client ${clientId}:`, error);
          }
        }
        
        groupsWithClientDetails.push({
          id: group.id.toString(),
          primaryStaff: group.primaryStaff || '',
          helpers: group.helpers || [],
          roomLocation: '', // Not stored in production schema
          groupName: '', // Not stored in production schema
          color: group.color || '#3B82F6',
          clients: clients
        });
      }

      const transformedSchedule = {
        id: schedule.id,
        date: schedule.date,
        location: schedule.location,
        isFinalized: false, // Default until we implement in production schema
        finalizedBy: null,
        timeBlocks: [
          {
            id: 'default-lunch',
            startTime: '12:30',
            endTime: '13:00',
            label: 'Lunch',
            groups: groupsWithClientDetails
          }
        ],
        overrides: {
          manuallyMovedToAvailable: [],
          manualStayWithStaff: [],
          excludedClients: []
        },
        createdBy: schedule.createdBy,
        createdAt: schedule.createdAt
      };
      
      return res.json(transformedSchedule);
    }

    // Return default structure if no schedule exists
    return res.json({
      id: null,
      date,
      location,
      isFinalized: false,
      timeBlocks: [
        {
          id: 'default-lunch',
          startTime: '12:30',
          endTime: '13:00',
          label: 'Lunch',
          groups: []
        }
      ],
      overrides: {
        manuallyMovedToAvailable: [],
        manualStayWithStaff: [],
        excludedClients: []
      },
      createdBy: null,
      createdAt: null
    });

  } catch (error) {
    console.error('Error fetching lunch schedule:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch lunch schedule',
      details: error.message,
      query: { date, location }
    });
  }
});

// Create or update lunch schedule
router.post('/', async (req, res) => {
  try {
    const { date, location, timeBlocks, createdBy } = req.body;

    if (!date || !location || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use raw SQL to avoid Prisma schema issues
    const existingSchedule = await prisma.$queryRaw`
      SELECT id FROM "LunchSchedule" 
      WHERE date = ${new Date(date)}::date AND location = ${location}
    `;

    let scheduleId;

    if (existingSchedule.length > 0) {
      // Update existing schedule
      scheduleId = existingSchedule[0].id;
      
      // Delete existing groups for this schedule
      await prisma.$executeRaw`
        DELETE FROM "LunchGroup" WHERE "lunchScheduleId" = ${scheduleId}
      `;
    } else {
      // Create new schedule (using production schema columns only)
      const result = await prisma.$queryRaw`
        INSERT INTO "LunchSchedule" (date, location, "createdBy")
        VALUES (${new Date(date)}::date, ${location}, ${createdBy})
        RETURNING id
      `;
      scheduleId = result[0].id;
    }

    // Create groups directly (production DB doesn't have LunchTimeBlock)
    const processedTimeBlocks = timeBlocks || [
      {
        startTime: '12:30',
        endTime: '13:00',
        label: 'Lunch',
        groups: []
      }
    ];

    // For now, just save all groups to the first time block's groups
    const firstTimeBlock = processedTimeBlocks[0];
    if (firstTimeBlock && firstTimeBlock.groups) {
      for (const group of firstTimeBlock.groups) {
        try {
          // Extract client IDs for the current production database schema
          const clientIds = (group.clients || []).map(client => client.clientId || client.id);
          
          console.log('Creating group with data:', { 
            scheduleId, 
            primaryStaff: group.primaryStaff || '', 
            helpers: group.helpers || [],
            clientIds,
            color: group.color || '#3B82F6'
          });
          
          const groupResult = await prisma.$queryRaw`
            INSERT INTO "LunchGroup" ("lunchScheduleId", "primaryStaff", helpers, "clientIds", color)
            VALUES (${scheduleId}, ${group.primaryStaff || ''}, ${JSON.stringify(group.helpers || [])}::jsonb, 
                    ${JSON.stringify(clientIds)}::jsonb, ${group.color || '#3B82F6'})
            RETURNING id
          `;
          
          console.log('Group created successfully:', groupResult[0]);
        } catch (groupError) {
          console.error('Error creating group:', groupError);
          throw groupError;
        }
      }
    }

    // Fetch the created/updated schedule (using production schema fields)
    const updatedSchedule = await prisma.$queryRaw`
      SELECT id, date, location, "createdBy", "createdAt"
      FROM "LunchSchedule" 
      WHERE id = ${scheduleId}
    `;

    const transformedSchedule = {
      id: updatedSchedule[0].id,
      date: updatedSchedule[0].date,
      location: updatedSchedule[0].location,
      isFinalized: false, // Default until implemented in production
      finalizedBy: null,
      timeBlocks: processedTimeBlocks,
      overrides: {
        manuallyMovedToAvailable: [],
        manualStayWithStaff: [],
        excludedClients: []
      },
      createdBy: updatedSchedule[0].createdBy,
      createdAt: updatedSchedule[0].createdAt
    };

    res.json(transformedSchedule);
  } catch (error) {
    console.error('Error saving lunch schedule:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to save lunch schedule',
      details: error.message,
      requestBody: { date, location, createdBy }
    });
  }
});

// Debug endpoint to test if route is working
router.get('/test-debug', async (req, res) => {
  res.json({ 
    message: 'Enhanced lunch schedule routes are working!', 
    timestamp: new Date().toISOString(),
    path: req.path,
    query: req.query
  });
});

// Get available clients for lunch (those with AM assignments but not in lunch groups yet)
router.get('/available-clients', async (req, res) => {
  console.log('🔍 Available clients endpoint hit!', req.query);
  
  // Simplified response for debugging
  res.json({
    message: 'Available clients endpoint is working!',
    timestamp: new Date().toISOString(),
    query: req.query,
    availableClients: [],
    shouldStayWithStaff: [],
    overrides: {
      manuallyMovedToAvailable: [],
      manualStayWithStaff: [],
      excludedClients: []
    }
  });
});

module.exports = router;