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

    // Try to get lunch schedule with production schema (timeBlocks relation)
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
          timeBlocks: {
            include: {
              groups: true
            }
          }
        }
      });
    } catch (error) {
      console.log('No existing lunch schedule found:', error.message);
    }

    // Transform production format to frontend format
    if (lunchSchedule) {
      const transformedSchedule = {
        id: lunchSchedule.id,
        date: lunchSchedule.date,
        location: lunchSchedule.location,
        isFinalized: lunchSchedule.isFinalized || false,
        finalizedBy: lunchSchedule.finalizedBy,
        timeBlocks: lunchSchedule.timeBlocks || [
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

    // Transform frontend format to production database format
    const processedTimeBlocks = timeBlocks || [
      {
        startTime: '12:30',
        endTime: '13:00',
        label: 'Lunch',
        groups: []
      }
    ];

    // Check if lunch schedule already exists (handle missing override columns)
    let existingSchedule = null;
    try {
      existingSchedule = await prisma.lunchSchedule.findUnique({
        where: {
          date_location: {
            date: new Date(date),
            location
          }
        }
      });
    } catch (error) {
      if (error.code === 'P2022' && error.meta?.column?.includes('manuallyMoved')) {
        console.log('Override columns not available in database, continuing without them');
        existingSchedule = null;
      } else {
        throw error;
      }
    }

    let lunchSchedule;

    if (existingSchedule) {
      // Update existing schedule
      lunchSchedule = await prisma.lunchSchedule.update({
        where: { id: existingSchedule.id },
        data: {
          modifiedBy: createdBy,
          modifiedAt: new Date(),
          timeBlocks: {
            deleteMany: {}, // Remove all existing time blocks
            create: processedTimeBlocks.map(tb => ({
              startTime: tb.startTime,
              endTime: tb.endTime,
              label: tb.label,
              groups: {
                create: (tb.groups || []).map(group => ({
                  primaryStaff: group.primaryStaff || '',
                  helpers: group.helpers || [],
                  roomLocation: group.roomLocation || '',
                  groupName: group.groupName || '',
                  color: group.color || '#3B82F6'
                }))
              }
            }))
          }
        },
        include: {
          timeBlocks: {
            include: {
              groups: true
            }
          }
        }
      });
    } else {
      // Create new schedule
      lunchSchedule = await prisma.lunchSchedule.create({
        data: {
          date: new Date(date),
          location,
          createdBy: createdBy,
          timeBlocks: {
            create: processedTimeBlocks.map(tb => ({
              startTime: tb.startTime,
              endTime: tb.endTime,
              label: tb.label,
              groups: {
                create: (tb.groups || []).map(group => ({
                  primaryStaff: group.primaryStaff || '',
                  helpers: group.helpers || [],
                  roomLocation: group.roomLocation || '',
                  groupName: group.groupName || '',
                  color: group.color || '#3B82F6'
                }))
              }
            }))
          }
        },
        include: {
          timeBlocks: {
            include: {
              groups: true
            }
          }
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
      timeBlocks: lunchSchedule.timeBlocks || [
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