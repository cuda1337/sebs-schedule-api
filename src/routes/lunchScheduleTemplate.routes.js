const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all templates for a location
router.get('/location/:location', async (req, res) => {
  try {
    const { location } = req.params;
    
    const templates = await prisma.lunchScheduleTemplate.findMany({
      where: { location },
      orderBy: {
        dayOfWeek: 'asc'
      }
    });
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching lunch templates:', error);
    res.status(500).json({ error: 'Failed to fetch lunch templates' });
  }
});

// Get a specific template
router.get('/:location/:dayOfWeek', async (req, res) => {
  try {
    const { location, dayOfWeek } = req.params;
    
    const template = await prisma.lunchScheduleTemplate.findUnique({
      where: {
        location_dayOfWeek: {
          location,
          dayOfWeek
        }
      }
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error fetching lunch template:', error);
    res.status(500).json({ error: 'Failed to fetch lunch template' });
  }
});

// Create or update a template
router.put('/:location/:dayOfWeek', async (req, res) => {
  try {
    const { location, dayOfWeek } = req.params;
    const { groups, unassignedClientIds, timeStart, timeEnd } = req.body;
    const createdBy = req.body.createdBy || 'user';
    
    // Validate the groups structure
    if (!Array.isArray(groups)) {
      return res.status(400).json({ error: 'Groups must be an array' });
    }
    
    // Check if template exists
    const existing = await prisma.lunchScheduleTemplate.findUnique({
      where: {
        location_dayOfWeek: {
          location,
          dayOfWeek
        }
      }
    });
    
    let template;
    if (existing) {
      // Update existing template
      template = await prisma.lunchScheduleTemplate.update({
        where: {
          id: existing.id
        },
        data: {
          groups: groups,
          unassignedClientIds: unassignedClientIds || [],
          timeStart: timeStart || '12:30',
          timeEnd: timeEnd || '1:00',
          updatedAt: new Date()
        }
      });
    } else {
      // Create new template
      template = await prisma.lunchScheduleTemplate.create({
        data: {
          location,
          dayOfWeek,
          groups: groups,
          unassignedClientIds: unassignedClientIds || [],
          timeStart: timeStart || '12:30',
          timeEnd: timeEnd || '1:00',
          createdBy
        }
      });
    }
    
    res.json(template);
  } catch (error) {
    console.error('Error saving lunch template:', error);
    res.status(500).json({ error: 'Failed to save lunch template' });
  }
});

// Delete a template
router.delete('/:location/:dayOfWeek', async (req, res) => {
  try {
    const { location, dayOfWeek } = req.params;
    
    const existing = await prisma.lunchScheduleTemplate.findUnique({
      where: {
        location_dayOfWeek: {
          location,
          dayOfWeek
        }
      }
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    await prisma.lunchScheduleTemplate.delete({
      where: {
        id: existing.id
      }
    });
    
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting lunch template:', error);
    res.status(500).json({ error: 'Failed to delete lunch template' });
  }
});

// Get available clients for a template (from weekly schedule AM assignments)
router.get('/:location/:dayOfWeek/available-clients', async (req, res) => {
  try {
    const { location, dayOfWeek } = req.params;
    
    // Get all AM assignments for this location and day
    const assignments = await prisma.assignment.findMany({
      where: {
        location,
        day: dayOfWeek,
        block: 'AM',
        versionId: 1 // Main schedule
      },
      include: {
        client: true,
        staff: true
      }
    });
    
    // Extract unique clients
    const clientsMap = new Map();
    assignments.forEach(assignment => {
      if (assignment.client && !clientsMap.has(assignment.client.id)) {
        clientsMap.set(assignment.client.id, {
          ...assignment.client,
          assignedStaff: assignment.staff
        });
      }
    });
    
    const clients = Array.from(clientsMap.values());
    
    res.json({
      clients,
      totalAssignments: assignments.length
    });
  } catch (error) {
    console.error('Error fetching available clients:', error);
    res.status(500).json({ error: 'Failed to fetch available clients' });
  }
});

module.exports = router;