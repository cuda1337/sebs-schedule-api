const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Debug endpoint - simple test
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 Debug lunch schedule endpoint hit');
    
    // Simple database test
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%Lunch%'
      ORDER BY table_name
    `;
    
    res.json({
      success: true,
      message: 'Debug endpoint working',
      timestamp: new Date().toISOString(),
      tables: tables
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

// Simple lunch schedule get (with error handling)
router.get('/', async (req, res) => {
  try {
    console.log('🍽️ Enhanced lunch schedule endpoint hit');
    console.log('Query params:', req.query);
    
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ 
        error: 'Date and location are required',
        received: { date, location }
      });
    }

    console.log('Attempting to find lunch schedule for:', { date, location });

    // Check if we can access the database at all
    const tableCheck = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'LunchSchedule'
    `;
    
    console.log('LunchSchedule table exists:', tableCheck[0]?.count > 0);

    // Try to find existing lunch schedule
    let lunchSchedule;
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
      
      console.log('Existing lunch schedule found:', !!lunchSchedule);
    } catch (findError) {
      console.error('Error finding lunch schedule:', findError);
      return res.status(500).json({
        error: 'Database query failed',
        details: findError.message,
        code: findError.code
      });
    }

    if (!lunchSchedule) {
      console.log('Creating default lunch schedule...');
      // Create default lunch schedule with default time block
      try {
        lunchSchedule = await prisma.lunchSchedule.create({
          data: {
            date: new Date(date),
            location: location,
            createdBy: 'system',
            timeBlocks: {
              create: {
                startTime: '12:30',
                endTime: '13:00',
                label: 'Lunch'
              }
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
        
        console.log('Default lunch schedule created successfully');
      } catch (createError) {
        console.error('Error creating lunch schedule:', createError);
        return res.status(500).json({
          error: 'Failed to create default lunch schedule',
          details: createError.message,
          code: createError.code
        });
      }
    }

    console.log('Returning lunch schedule:', {
      id: lunchSchedule.id,
      timeBlockCount: lunchSchedule.timeBlocks?.length || 0
    });

    res.json(lunchSchedule);
  } catch (error) {
    console.error('Lunch schedule endpoint error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch lunch schedule',
      details: error.message,
      code: error.code || 'UNKNOWN',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;