const express = require('express');
const router = express.Router();

// Get all overrides or overrides for a specific date
router.get('/daily-overrides', async (req, res) => {
  try {
    const { date } = req.query;
    
    // If no date provided, return all overrides
    if (!date) {
      try {
        const allOverrides = await req.prisma.dailyOverride.findMany({
          where: {
            status: 'active'
          },
          include: {
            originalStaff: true,
            originalClient: true,
            newStaff: true,
            newClient: true
          },
          orderBy: { createdAt: 'desc' }
        });
        return res.json(allOverrides);
      } catch (dbError) {
        console.error('Database error:', dbError);
        // If table doesn't exist yet, return empty array
        if (dbError.code === 'P2021') {
          return res.json([]);
        } else {
          throw dbError;
        }
      }
    }
    
    // Parse the date and get start/end of day
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    // Clean up old overrides (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    await req.prisma.dailyOverride.updateMany({
      where: {
        date: { lt: sevenDaysAgo },
        status: 'active'
      },
      data: { status: 'expired' }
    });
    
    // Get overrides for the requested date
    let overrides = [];
    try {
      overrides = await req.prisma.dailyOverride.findMany({
        where: {
          date: {
            gte: startOfDay,
            lte: endOfDay
          },
          status: 'active'
        },
        include: {
          originalStaff: true,
          originalClient: true,
          newStaff: true,
          newClient: true
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // If table doesn't exist yet, return empty array
      if (dbError.code === 'P2021') {
        overrides = [];
      } else {
        throw dbError;
      }
    }
    
    res.json(overrides);
  } catch (error) {
    console.error('Error fetching daily overrides:', error);
    res.status(500).json({ error: 'Failed to fetch daily overrides' });
  }
});

// Create a new override
router.post('/daily-overrides', async (req, res) => {
  try {
    const { 
      date, 
      type, 
      day, 
      block, 
      originalStaffId, 
      originalClientId,
      newStaffId,
      newClientId,
      newClientName, // Add support for one-time session client names
      reason,
      createdBy
    } = req.body;
    
    // Validate required fields
    if (!date || !type || !day || !block || !reason) {
      return res.status(400).json({ 
        error: 'Missing required fields: date, type, day, block, reason' 
      });
    }
    
    // Validate type
    if (!['callout', 'cancellation', 'reassignment', 'add_session', 'delete_session', 'one-time-session'].includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid type. Must be: callout, cancellation, reassignment, add_session, delete_session, or one-time-session' 
      });
    }
    
    // Type-specific validation
    if (type === 'callout' && !originalStaffId) {
      return res.status(400).json({ error: 'Staff ID required for callout' });
    }
    if (type === 'cancellation' && !originalClientId) {
      return res.status(400).json({ error: 'Client ID required for cancellation' });
    }
    if (type === 'reassignment' && (!originalStaffId && !originalClientId) && (!newStaffId && !newClientId)) {
      return res.status(400).json({ 
        error: 'Either original assignment or new assignment required for reassignment' 
      });
    }
    if (type === 'add_session') {
      // For add_session, we just need the reason field to contain the names
      // IDs can be null for custom names
    }
    if (type === 'delete_session' && (!originalStaffId || !originalClientId)) {
      return res.status(400).json({ 
        error: 'Both original staff and client IDs required for delete_session' 
      });
    }
    if (type === 'one-time-session' && !newClientName) {
      return res.status(400).json({ 
        error: 'Client name required for one-time session' 
      });
    }
    
    // Create the override
    const overrideData = {
      date: new Date(date),
      type,
      day,
      block,
      originalStaffId: originalStaffId || null,
      originalClientId: originalClientId || null,
      newStaffId: newStaffId || null,
      newClientId: newClientId || null,
      reason,
      createdBy: createdBy || 'system'
    };

    // For one-time sessions, store client name in reason with special format
    if (type === 'one-time-session') {
      overrideData.reason = `One-time session|${newClientName}|${reason || 'One-time session added'}`;
    }

    const override = await req.prisma.dailyOverride.create({
      data: overrideData,
      include: {
        originalStaff: true,
        originalClient: true,
        newStaff: true,
        newClient: true
      }
    });
    
    // Find the main schedule version for change log
    const mainVersion = await req.prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    // Log the change (only if main version exists)
    if (mainVersion) {
      await req.prisma.changeLog.create({
        data: {
          versionId: mainVersion.id, // Use actual main version ID
          changeType: `daily_override_${type}`,
        entityType: 'daily_override',
        entityId: override.id,
        day,
        block,
        staffId: originalStaffId || newStaffId || null,
        clientId: originalClientId || newClientId || null,
        newValue: {
          type,
          reason,
          date: date,
          newStaffId,
          newClientId
        },
        createdBy: createdBy || 'system',
        notes: `Daily override: ${reason}`
      }
    });
    }
    
    res.status(201).json(override);
  } catch (error) {
    console.error('Error creating daily override:', error);
    res.status(500).json({ error: 'Failed to create daily override' });
  }
});

// Update an override
router.put('/daily-overrides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, newStaffId, newClientId, status } = req.body;
    
    const override = await req.prisma.dailyOverride.update({
      where: { id: parseInt(id) },
      data: {
        ...(reason && { reason }),
        ...(newStaffId !== undefined && { newStaffId }),
        ...(newClientId !== undefined && { newClientId }),
        ...(status && { status })
      },
      include: {
        originalStaff: true,
        originalClient: true,
        newStaff: true,
        newClient: true
      }
    });
    
    res.json(override);
  } catch (error) {
    console.error('Error updating daily override:', error);
    res.status(500).json({ error: 'Failed to update daily override' });
  }
});

// Delete an override
router.delete('/daily-overrides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await req.prisma.dailyOverride.delete({
      where: { id: parseInt(id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting daily override:', error);
    res.status(500).json({ error: 'Failed to delete daily override' });
  }
});

// Clear all overrides for a specific date
router.delete('/daily-overrides', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }
    
    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
    
    await req.prisma.dailyOverride.deleteMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error clearing daily overrides:', error);
    res.status(500).json({ error: 'Failed to clear daily overrides' });
  }
});

module.exports = router;