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

    // Use raw SQL to avoid Prisma schema issues with missing columns
    const lunchSchedule = await prisma.$queryRaw`
      SELECT id, date, location, "isFinalized", "finalizedBy", "createdBy", "createdAt"
      FROM "LunchSchedule" 
      WHERE date = ${new Date(date)}::date AND location = ${location}
    `;

    // Get time blocks if they exist
    let timeBlocks = [];
    if (lunchSchedule.length > 0) {
      const scheduleId = lunchSchedule[0].id;
      
      try {
        timeBlocks = await prisma.$queryRaw`
          SELECT tb.id, tb."startTime", tb."endTime", tb.label,
                 lg.id as group_id, lg."primaryStaff", lg.helpers, lg."roomLocation", 
                 lg."groupName", lg.color
          FROM "LunchTimeBlock" tb
          LEFT JOIN "LunchGroup" lg ON lg."timeBlockId" = tb.id
          WHERE tb."lunchScheduleId" = ${scheduleId}
          ORDER BY tb."startTime", lg.id
        `;
      } catch (error) {
        console.log('TimeBlocks table might not exist, using empty array');
        timeBlocks = [];
      }
    }

    if (lunchSchedule.length > 0) {
      // Transform the data to frontend format
      const schedule = lunchSchedule[0];
      
      // Get all clients for all groups in this schedule
      let groupClients = [];
      if (timeBlocks.length > 0) {
        try {
          groupClients = await prisma.$queryRaw`
            SELECT lgc.*, c.name as client_name, c.locations as client_locations,
                   lg.id as group_id
            FROM "LunchGroupClient" lgc
            JOIN "Client" c ON c.id = lgc."clientId"
            JOIN "LunchGroup" lg ON lg.id = lgc."lunchGroupId"
            JOIN "LunchTimeBlock" tb ON tb.id = lg."timeBlockId"
            WHERE tb."lunchScheduleId" = ${schedule.id}
            ORDER BY lgc."displayOrder", lgc."clientId"
          `;
        } catch (error) {
          console.log('Error loading lunch group clients:', error);
          groupClients = [];
        }
      }
      
      // Group the time blocks and their groups
      const groupedTimeBlocks = [];
      const timeBlockMap = new Map();
      
      timeBlocks.forEach(row => {
        if (!timeBlockMap.has(row.id)) {
          timeBlockMap.set(row.id, {
            id: row.id.toString(),
            startTime: row.startTime,
            endTime: row.endTime,
            label: row.label || 'Lunch',
            groups: []
          });
          groupedTimeBlocks.push(timeBlockMap.get(row.id));
        }
        
        if (row.group_id) {
          // Get clients for this specific group
          const groupClientList = groupClients
            .filter(gc => gc.group_id === row.group_id)
            .map(gc => ({
              id: gc.clientId,
              name: gc.client_name,
              locations: gc.client_locations || [],
              hasAfternoonSession: gc.hasAfternoonSession || false
            }));

          timeBlockMap.get(row.id).groups.push({
            id: row.group_id.toString(),
            primaryStaff: row.primaryStaff || '',
            helpers: row.helpers || [],
            roomLocation: row.roomLocation || '',
            groupName: row.groupName || '',
            color: row.color || '#3B82F6',
            clients: groupClientList
          });
        }
      });

      const transformedSchedule = {
        id: schedule.id,
        date: schedule.date,
        location: schedule.location,
        isFinalized: schedule.isFinalized || false,
        finalizedBy: schedule.finalizedBy,
        timeBlocks: groupedTimeBlocks.length > 0 ? groupedTimeBlocks : [
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
      
      await prisma.$executeRaw`
        UPDATE "LunchSchedule" 
        SET "lastModifiedBy" = ${createdBy}, "lastModifiedAt" = NOW()
        WHERE id = ${scheduleId}
      `;
      
      // Delete existing time blocks (cascade will delete groups)
      await prisma.$executeRaw`
        DELETE FROM "LunchTimeBlock" WHERE "lunchScheduleId" = ${scheduleId}
      `;
    } else {
      // Create new schedule
      const result = await prisma.$queryRaw`
        INSERT INTO "LunchSchedule" (date, location, "createdBy", "isFinalized")
        VALUES (${new Date(date)}::date, ${location}, ${createdBy}, false)
        RETURNING id
      `;
      scheduleId = result[0].id;
    }

    // Create time blocks and groups
    const processedTimeBlocks = timeBlocks || [
      {
        startTime: '12:30',
        endTime: '13:00',
        label: 'Lunch',
        groups: []
      }
    ];

    for (const timeBlock of processedTimeBlocks) {
      const timeBlockResult = await prisma.$queryRaw`
        INSERT INTO "LunchTimeBlock" ("lunchScheduleId", "startTime", "endTime", label)
        VALUES (${scheduleId}, ${timeBlock.startTime}, ${timeBlock.endTime}, ${timeBlock.label || 'Lunch'})
        RETURNING id
      `;
      
      const timeBlockId = timeBlockResult[0].id;
      
      // Create groups for this time block
      for (const group of (timeBlock.groups || [])) {
        await prisma.$executeRaw`
          INSERT INTO "LunchGroup" ("timeBlockId", "primaryStaff", helpers, "roomLocation", "groupName", color)
          VALUES (${timeBlockId}, ${group.primaryStaff || ''}, ${group.helpers || []}::text[], 
                  ${group.roomLocation || ''}, ${group.groupName || ''}, ${group.color || '#3B82F6'})
        `;
      }
    }

    // Fetch the created/updated schedule
    const updatedSchedule = await prisma.$queryRaw`
      SELECT id, date, location, "isFinalized", "finalizedBy", "createdBy", "createdAt"
      FROM "LunchSchedule" 
      WHERE id = ${scheduleId}
    `;

    const transformedSchedule = {
      id: updatedSchedule[0].id,
      date: updatedSchedule[0].date,
      location: updatedSchedule[0].location,
      isFinalized: updatedSchedule[0].isFinalized || false,
      finalizedBy: updatedSchedule[0].finalizedBy,
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
    res.status(500).json({ error: 'Failed to save lunch schedule' });
  }
});

module.exports = router;