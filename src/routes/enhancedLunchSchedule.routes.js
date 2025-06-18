const express = require('express');
const { PrismaClient } = require('@prisma/client');

// For now, disable override functionality until database migration is applied
const OVERRIDE_COLUMNS_ENABLED = false;

const router = express.Router();
const prisma = new PrismaClient();

// Get lunch schedule for a specific date and location
router.get('/', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ error: 'Date and location are required' });
    }

    // Try to get lunch schedule with OLD schema (direct groups relation)
    let lunchSchedule = null;
    try {
      lunchSchedule = await prisma.lunchSchedule.findUnique({
        where: {
          date_location: {
            date: new Date(date),
            location: location
          }
        },
        include: {
          groups: true
        }
      });
    } catch (error) {
      console.log('No existing lunch schedule found:', error.message);
    }

    // Transform old format to new format for frontend compatibility
    if (lunchSchedule) {
      const transformedSchedule = {
        id: lunchSchedule.id,
        date: lunchSchedule.date,
        location: lunchSchedule.location,
        isFinalized: lunchSchedule.isFinalized || false,
        finalizedBy: lunchSchedule.finalizedBy,
        timeBlocks: [
          {
            id: 'lunch-' + lunchSchedule.id,
            startTime: '12:30',
            endTime: '13:00', 
            label: 'Lunch',
            groups: lunchSchedule.groups.map(group => ({
              id: 'group-' + group.id,
              primaryStaff: group.primaryStaff || '',
              helpers: group.helpers || [],
              roomLocation: group.roomLocation || '',
              groupName: group.groupName || `Group ${group.id}`,
              color: group.color || '#3B82F6',
              clients: group.clientIds ? group.clientIds.map((clientId, index) => ({
                id: clientId,
                name: `Client ${clientId}`, // Would need to fetch actual names
                locations: [location],
                hasAfternoonSession: false
              })) : []
            }))
          }
        ],
        overrides: {
          manuallyMovedToAvailable: [],
          manualStayWithStaff: [],
          excludedClients: []
        },
        createdBy: lunchSchedule.createdBy,
        createdAt: lunchSchedule.createdAt
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
    res.status(500).json({ error: 'Failed to fetch lunch schedule' });
  }
});

// Create or update lunch schedule
router.post('/', async (req, res) => {
  try {
    const { date, location, timeBlocks, createdBy } = req.body;

    if (!date || !location || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Transform new format to old format for database storage
    const groups = [];
    if (timeBlocks && timeBlocks.length > 0) {
      timeBlocks.forEach(timeBlock => {
        if (timeBlock.groups) {
          timeBlock.groups.forEach(group => {
            groups.push({
              primaryStaff: group.primaryStaff || '',
              helpers: group.helpers || [],
              clientIds: group.clients ? group.clients.map(c => c.id || c.clientId) : [],
              color: group.color || '#3B82F6',
              groupName: group.groupName || '',
              roomLocation: group.roomLocation || ''
            });
          });
        }
      });
    }

    // Check if lunch schedule already exists
    const existingSchedule = await prisma.lunchSchedule.findUnique({
      where: {
        date_location: {
          date: new Date(date),
          location
        }
      }
    });

    let lunchSchedule;

    if (existingSchedule) {
      // Update existing schedule
      lunchSchedule = await prisma.lunchSchedule.update({
        where: { id: existingSchedule.id },
        data: {
          modifiedBy: createdBy,
          modifiedAt: new Date(),
          groups: {
            deleteMany: {}, // Remove all existing groups
            create: groups
          }
        },
        include: {
          groups: true
        }
      });
    } else {
      // Create new schedule
      lunchSchedule = await prisma.lunchSchedule.create({
        data: {
          date: new Date(date),
          location,
          createdBy: createdBy,
          groups: {
            create: groups
          }
        },
        include: {
          groups: true
        }
      });
    }

    // Transform back to frontend format
    const transformedSchedule = {
      id: lunchSchedule.id,
      date: lunchSchedule.date,
      location: lunchSchedule.location,
      isFinalized: lunchSchedule.isFinalized || false,
      finalizedBy: lunchSchedule.finalizedBy,
      timeBlocks: [
        {
          id: 'lunch-' + lunchSchedule.id,
          startTime: '12:30',
          endTime: '13:00',
          label: 'Lunch',
          groups: lunchSchedule.groups.map(group => ({
            id: 'group-' + group.id,
            primaryStaff: group.primaryStaff || '',
            helpers: group.helpers || [],
            roomLocation: group.roomLocation || '',
            groupName: group.groupName || `Group ${group.id}`,
            color: group.color || '#3B82F6',
            clients: group.clientIds ? group.clientIds.map((clientId, index) => ({
              id: clientId,
              name: `Client ${clientId}`,
              locations: [location],
              hasAfternoonSession: false
            })) : []
          }))
        }
      ],
      overrides: {
        manuallyMovedToAvailable: [],
        manualStayWithStaff: [],
        excludedClients: []
      },
      createdBy: lunchSchedule.createdBy,
      createdAt: lunchSchedule.createdAt
    };

    res.json(transformedSchedule);
  } catch (error) {
    console.error('Error saving lunch schedule:', error);
    res.status(500).json({ error: 'Failed to save lunch schedule' });
  }
});

module.exports = router;