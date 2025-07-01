const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/daily-schedule-state?date=2025-01-27
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const states = await prisma.dailyAssignmentState.findMany({
      where: {
        date: new Date(date)
      },
      include: {
        currentStaff: true,
        assignment: {
          include: {
            staff: true,
            client: true
          }
        }
      }
    });

    res.json(states);
  } catch (error) {
    console.error('Error fetching daily assignment states:', error);
    res.status(500).json({ error: 'Failed to fetch schedule states' });
  }
});

// PUT /api/daily-schedule-state
router.put('/', async (req, res) => {
  try {
    const { date, assignmentId, currentStaffId } = req.body;

    if (!date || !assignmentId) {
      return res.status(400).json({ error: 'Date and assignmentId are required' });
    }

    const state = await prisma.dailyAssignmentState.upsert({
      where: {
        date_assignmentId: {
          date: new Date(date),
          assignmentId: parseInt(assignmentId)
        }
      },
      update: {
        currentStaffId: currentStaffId ? parseInt(currentStaffId) : null
      },
      create: {
        date: new Date(date),
        assignmentId: parseInt(assignmentId),
        currentStaffId: currentStaffId ? parseInt(currentStaffId) : null
      },
      include: {
        currentStaff: true,
        assignment: {
          include: {
            staff: true,
            client: true
          }
        }
      }
    });

    res.json(state);
  } catch (error) {
    console.error('Error updating daily assignment state:', error);
    res.status(500).json({ error: 'Failed to update schedule state' });
  }
});

// PUT /api/daily-schedule-state/swap
// Atomic swap endpoint - swap staff between two assignments
router.put('/swap', async (req, res) => {
  try {
    const { date, swap1, swap2 } = req.body;
    
    if (!date || !swap1 || !swap2) {
      return res.status(400).json({ 
        error: 'Missing required fields: date, swap1, and swap2' 
      });
    }
    
    // Use a transaction to ensure both updates happen atomically
    const result = await prisma.$transaction(async (tx) => {
      // Update first assignment
      const state1 = await tx.dailyAssignmentState.upsert({
        where: {
          date_assignmentId: {
            date: new Date(date),
            assignmentId: parseInt(swap1.assignmentId)
          }
        },
        update: {
          currentStaffId: swap1.staffId ? parseInt(swap1.staffId) : null
        },
        create: {
          date: new Date(date),
          assignmentId: parseInt(swap1.assignmentId),
          currentStaffId: swap1.staffId ? parseInt(swap1.staffId) : null
        },
        include: {
          currentStaff: true,
          assignment: {
            include: {
              staff: true,
              client: true
            }
          }
        }
      });
      
      // Update second assignment
      const state2 = await tx.dailyAssignmentState.upsert({
        where: {
          date_assignmentId: {
            date: new Date(date),
            assignmentId: parseInt(swap2.assignmentId)
          }
        },
        update: {
          currentStaffId: swap2.staffId ? parseInt(swap2.staffId) : null
        },
        create: {
          date: new Date(date),
          assignmentId: parseInt(swap2.assignmentId),
          currentStaffId: swap2.staffId ? parseInt(swap2.staffId) : null
        },
        include: {
          currentStaff: true,
          assignment: {
            include: {
              staff: true,
              client: true
            }
          }
        }
      });
      
      return [state1, state2];
    });
    
    // Log the swap for debugging
    console.log(`[DailyScheduleState] Atomic swap completed for date ${date}:`, {
      swap1: { assignmentId: swap1.assignmentId, staffId: swap1.staffId },
      swap2: { assignmentId: swap2.assignmentId, staffId: swap2.staffId }
    });
    
    res.json(result);
  } catch (error) {
    console.error('[DailyScheduleState] Swap error:', error);
    res.status(500).json({ 
      error: 'Failed to swap staff assignments',
      details: error.message 
    });
  }
});

// DELETE /api/daily-schedule-state/:date
// Used for "Reset Schedule" functionality
router.delete('/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const deleted = await prisma.dailyAssignmentState.deleteMany({
      where: {
        date: new Date(date)
      }
    });

    res.json({ 
      message: 'Daily assignment states cleared', 
      count: deleted.count 
    });
  } catch (error) {
    console.error('Error clearing daily assignment states:', error);
    res.status(500).json({ error: 'Failed to clear schedule states' });
  }
});

module.exports = router;