const express = require('express');
const router = express.Router();

// Get all reassignments that need attention
router.get('/', async (req, res) => {
  try {
    const { status = 'pending', location, day, block } = req.query;
    
    const where = { status };
    if (location) where.location = location;
    if (day) where.day = day;
    if (block) where.block = block;
    
    const reassignments = await req.prisma.reassignmentNeeded.findMany({
      where,
      include: {
        client: true,
        originalStaff: true,
        plannedStaff: true
      },
      orderBy: [
        { day: 'asc' },
        { block: 'asc' },
        { deletedAt: 'desc' }
      ]
    });
    
    res.json(reassignments);
  } catch (error) {
    console.error('Error fetching reassignments:', error);
    res.status(500).json({ error: 'Failed to fetch reassignments' });
  }
});

// Get summary counts by location and day/block
router.get('/summary', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    
    // Get counts by location
    const locationCounts = await req.prisma.reassignmentNeeded.groupBy({
      by: ['location'],
      where: { status },
      _count: { id: true }
    });
    
    // Get counts by day/block
    const timeCounts = await req.prisma.reassignmentNeeded.groupBy({
      by: ['day', 'block'],
      where: { status },
      _count: { id: true }
    });
    
    res.json({
      byLocation: locationCounts.map(item => ({
        location: item.location,
        count: item._count.id
      })),
      byTimeBlock: timeCounts.map(item => ({
        day: item.day,
        block: item.block,
        count: item._count.id
      }))
    });
  } catch (error) {
    console.error('Error fetching reassignment summary:', error);
    res.status(500).json({ error: 'Failed to fetch reassignment summary' });
  }
});

// Create a new reassignment need
router.post('/', async (req, res) => {
  try {
    const {
      clientId,
      originalStaffId,
      originalStaffName,
      day,
      block,
      location,
      deletedBy
    } = req.body;
    
    // Check if this reassignment already exists
    const existing = await req.prisma.reassignmentNeeded.findFirst({
      where: {
        clientId,
        day,
        block,
        status: 'pending'
      }
    });
    
    if (existing) {
      return res.json(existing);
    }
    
    const reassignment = await req.prisma.reassignmentNeeded.create({
      data: {
        clientId,
        originalStaffId,
        originalStaffName,
        day,
        block,
        location,
        deletedBy: deletedBy || req.user?.name || 'system'
      },
      include: {
        client: true,
        originalStaff: true
      }
    });
    
    res.status(201).json(reassignment);
  } catch (error) {
    console.error('Error creating reassignment:', error);
    res.status(500).json({ error: 'Failed to create reassignment' });
  }
});

// Update reassignment (e.g., mark as planned)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, plannedStaffId, plannedDate } = req.body;
    
    const data = {};
    if (status) data.status = status;
    if (plannedStaffId !== undefined) data.plannedStaffId = plannedStaffId;
    if (plannedDate !== undefined) data.plannedDate = plannedDate ? new Date(plannedDate) : null;
    
    const reassignment = await req.prisma.reassignmentNeeded.update({
      where: { id: parseInt(id) },
      data,
      include: {
        client: true,
        originalStaff: true,
        plannedStaff: true
      }
    });
    
    res.json(reassignment);
  } catch (error) {
    console.error('Error updating reassignment:', error);
    res.status(500).json({ error: 'Failed to update reassignment' });
  }
});

// Dismiss a reassignment
router.post('/:id/dismiss', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const reassignment = await req.prisma.reassignmentNeeded.update({
      where: { id: parseInt(id) },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
        dismissedBy: req.user?.name || 'system',
        dismissalReason: reason
      }
    });
    
    res.json(reassignment);
  } catch (error) {
    console.error('Error dismissing reassignment:', error);
    res.status(500).json({ error: 'Failed to dismiss reassignment' });
  }
});

// Check and auto-update reassignments based on new assignments
router.post('/check-assignments', async (req, res) => {
  try {
    // Get all pending reassignments
    const pendingReassignments = await req.prisma.reassignmentNeeded.findMany({
      where: { status: 'pending' }
    });
    
    const updates = [];
    
    for (const reassignment of pendingReassignments) {
      // Check if there's now a main assignment for this client/day/block
      const mainAssignment = await req.prisma.assignment.findFirst({
        where: {
          clientId: reassignment.clientId,
          day: reassignment.day,
          block: reassignment.block,
          version: {
            type: 'main',
            status: 'active'
          }
        }
      });
      
      if (mainAssignment) {
        // Mark as reassigned
        const updated = await req.prisma.reassignmentNeeded.update({
          where: { id: reassignment.id },
          data: { status: 'reassigned' }
        });
        updates.push(updated);
      }
      
      // Check if there's a planned assignment
      const plannedAssignment = await req.prisma.assignment.findFirst({
        where: {
          clientId: reassignment.clientId,
          day: reassignment.day,
          block: reassignment.block,
          version: {
            type: 'planned',
            status: 'active'
          }
        },
        include: {
          staff: true,
          version: true
        }
      });
      
      if (plannedAssignment && reassignment.status === 'pending') {
        // Update with planned info
        const updated = await req.prisma.reassignmentNeeded.update({
          where: { id: reassignment.id },
          data: {
            status: 'planned',
            plannedStaffId: plannedAssignment.staffId,
            plannedDate: plannedAssignment.version.startDate
          }
        });
        updates.push(updated);
      }
    }
    
    res.json({
      checked: pendingReassignments.length,
      updated: updates.length,
      updates
    });
  } catch (error) {
    console.error('Error checking assignments:', error);
    res.status(500).json({ error: 'Failed to check assignments' });
  }
});

module.exports = router;