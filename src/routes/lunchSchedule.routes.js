const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get lunch schedule for a specific date and location
router.get('/', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ 
        error: 'Date and location are required' 
      });
    }

    let lunchSchedule;
    try {
      lunchSchedule = await prisma.lunchSchedule.findUnique({
        where: {
          date_location: {
            date: new Date(date),
            location
          }
        },
        include: {
          timeBlocks: {
            include: {
              groups: {
                include: {
                  clients: {
                    include: {
                      client: true
                    }
                  }
                }
              }
            }
          }
        }
      });
    } catch (error) {
      // If the new schema doesn't work, try the old schema
      if (error.message.includes('Unknown field')) {
        console.log('Using fallback schema without timeBlocks/groups');
        lunchSchedule = await prisma.lunchSchedule.findUnique({
          where: {
            date_location: {
              date: new Date(date),
              location
            }
          }
        });
      } else {
        throw error;
      }
    }

    if (!lunchSchedule) {
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
    }

    // Transform the data to match expected frontend format
    const transformedSchedule = {
      ...lunchSchedule,
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
      }
    };

    res.json(transformedSchedule);
  } catch (error) {
    console.error('Error fetching lunch schedule:', error);
    res.status(500).json({ error: 'Failed to fetch lunch schedule' });
  }
});

// Create or update lunch schedule
router.post('/', async (req, res) => {
  try {
    const { 
      date, 
      location, 
      timePeriod = '12:30-1:00', 
      groups = [], 
      createdBy,
      modifiedBy 
    } = req.body;

    if (!date || !location) {
      return res.status(400).json({ 
        error: 'Date and location are required' 
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
          timePeriod,
          modifiedBy: modifiedBy || createdBy,
          modifiedAt: new Date(),
          groups: {
            deleteMany: {}, // Remove all existing groups
            create: groups.map(group => ({
              primaryStaff: group.primaryStaff || '',
              helpers: group.helpers || [],
              clientIds: group.clientIds || [],
              color: group.color || '#3B82F6'
            }))
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
          timePeriod,
          createdBy: createdBy || 'system',
          groups: {
            create: groups.map(group => ({
              primaryStaff: group.primaryStaff || '',
              helpers: group.helpers || [],
              clientIds: group.clientIds || [],
              color: group.color || '#3B82F6'
            }))
          }
        },
        include: {
          groups: true
        }
      });
    }

    res.json({
      ...lunchSchedule,
      groups: lunchSchedule.groups.map(group => ({
        ...group,
        helpers: Array.isArray(group.helpers) ? group.helpers : [],
        clientIds: Array.isArray(group.clientIds) ? group.clientIds : []
      }))
    });
  } catch (error) {
    console.error('Error saving lunch schedule:', error);
    res.status(500).json({ error: 'Failed to save lunch schedule' });
  }
});

// Delete lunch schedule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.lunchSchedule.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting lunch schedule:', error);
    res.status(500).json({ error: 'Failed to delete lunch schedule' });
  }
});

// Get clients available for lunch (from AM assignments)
router.get('/available-clients', async (req, res) => {
  try {
    const { date, location, versionId = 1 } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ 
        error: 'Date and location are required' 
      });
    }

    // Convert date to day of week
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

    // Get all AM assignments for this day and location
    const amAssignments = await prisma.assignment.findMany({
      where: {
        versionId: parseInt(versionId),
        day: dayOfWeek,
        block: 'AM',
        client: {
          locations: {
            has: location
          }
        }
      },
      include: {
        client: true,
        staff: true
      },
      distinct: ['clientId'] // Only unique clients
    });

    // Get canceled clients for this date
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    const canceledClients = await prisma.dailyOverride.findMany({
      where: {
        type: 'cancellation',
        date: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: 'active'
      },
      select: {
        originalClientId: true
      }
    });

    const canceledClientIds = new Set(
      canceledClients.map(c => c.originalClientId).filter(id => id !== null)
    );

    // Return client data, excluding canceled clients
    const availableClients = amAssignments
      .filter(assignment => !canceledClientIds.has(assignment.clientId))
      .map(assignment => ({
        id: assignment.clientId,
        name: assignment.client.name,
        initials: assignment.client.name.split(' ').map(n => n[0]).join(''),
        location: assignment.client.locations?.[0] || location
      }));

    res.json(availableClients);
  } catch (error) {
    console.error('Error fetching available clients:', error);
    res.status(500).json({ error: 'Failed to fetch available clients' });
  }
});

module.exports = router;