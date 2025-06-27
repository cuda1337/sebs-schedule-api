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