const express = require('express');
const router = express.Router();

// Create group session
router.post('/group-sessions', async (req, res) => {
  try {
    const { day, block, staffId, versionId, location, clientIds } = req.body;
    
    // Validate inputs
    if (!day || !block || !staffId || !location || !clientIds || clientIds.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get version or default to main
    let version = versionId ? parseInt(versionId) : null;
    if (!version) {
      const mainVersion = await req.prisma.scheduleVersion.findFirst({
        where: { type: 'main', status: 'active' }
      });
      version = mainVersion?.id || 1;
    }
    
    // Check staff availability
    const staff = await req.prisma.staff.findUnique({
      where: { id: staffId }
    });
    
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    
    const availabilityKey = `${day}-${block}`;
    if (!staff.availability[availabilityKey]) {
      return res.status(400).json({ error: 'Staff member is not available at this time' });
    }
    
    // Check if staff already has assignments at this time
    const existingAssignment = await req.prisma.assignment.findFirst({
      where: {
        versionId: version,
        day,
        block,
        staffId
      }
    });
    
    if (existingAssignment) {
      return res.status(400).json({ error: 'Staff member already has an assignment at this time' });
    }
    
    // Check client availability and conflicts
    const clients = await req.prisma.client.findMany({
      where: { id: { in: clientIds } }
    });
    
    if (clients.length !== clientIds.length) {
      return res.status(400).json({ error: 'One or more clients not found' });
    }
    
    // Check each client's availability and conflicts
    for (const client of clients) {
      if (!client.availability[availabilityKey]) {
        return res.status(400).json({ error: `Client ${client.name} is not available at this time` });
      }
      
      const clientConflict = await req.prisma.assignment.findFirst({
        where: {
          versionId: version,
          day,
          block,
          clientId: client.id
        }
      });
      
      if (clientConflict) {
        return res.status(400).json({ error: `Client ${client.name} already has an assignment at this time` });
      }
      
      // Check if client is at the same location
      if (!client.locations.includes(location)) {
        return res.status(400).json({ error: `Client ${client.name} is not at location ${location}` });
      }
    }
    
    // Create group session in transaction
    const result = await req.prisma.$transaction(async (prisma) => {
      // Create group session
      const groupSession = await prisma.groupSession.create({
        data: {
          day,
          block,
          staffId,
          versionId: version,
          location,
          maxSize: Math.max(4, clientIds.length) // Allow at least the current number of clients
        }
      });
      
      // Create assignments and group session clients
      const assignments = [];
      for (const clientId of clientIds) {
        // Add client to group session
        await prisma.groupSessionClient.create({
          data: {
            groupSessionId: groupSession.id,
            clientId
          }
        });
        
        // Create assignment
        const assignment = await prisma.assignment.create({
          data: {
            day,
            block,
            staffId,
            clientId,
            versionId: version,
            isGroup: true,
            groupSessionId: groupSession.id
          },
          include: {
            staff: true,
            client: true
          }
        });
        
        assignments.push(assignment);
      }
      
      return { groupSession, assignments };
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating group session:', error);
    res.status(500).json({ error: 'Failed to create group session' });
  }
});

// Update group session
router.put('/group-sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { location, clientIds } = req.body;
    const groupSessionId = parseInt(id);
    
    // Get existing group session
    const groupSession = await req.prisma.groupSession.findUnique({
      where: { id: groupSessionId },
      include: {
        clients: {
          include: {
            client: true
          }
        }
      }
    });
    
    if (!groupSession) {
      return res.status(404).json({ error: 'Group session not found' });
    }
    
    // Validate new clients if provided
    if (clientIds && clientIds.length > 0) {
      const clients = await req.prisma.client.findMany({
        where: { id: { in: clientIds } }
      });
      
      if (clients.length !== clientIds.length) {
        return res.status(400).json({ error: 'One or more clients not found' });
      }
      
      // Check each client's availability and location
      const availabilityKey = `${groupSession.day}-${groupSession.block}`;
      for (const client of clients) {
        if (!client.availability[availabilityKey]) {
          return res.status(400).json({ error: `Client ${client.name} is not available at this time` });
        }
        
        // Check location if updating location
        const checkLocation = location || groupSession.location;
        if (!client.locations.includes(checkLocation)) {
          return res.status(400).json({ error: `Client ${client.name} is not at location ${checkLocation}` });
        }
        
        // Check for conflicts (excluding current group session assignments)
        const clientConflict = await req.prisma.assignment.findFirst({
          where: {
            versionId: groupSession.versionId,
            day: groupSession.day,
            block: groupSession.block,
            clientId: client.id,
            NOT: {
              groupSessionId: groupSessionId
            }
          }
        });
        
        if (clientConflict) {
          return res.status(400).json({ error: `Client ${client.name} already has an assignment at this time` });
        }
      }
    }
    
    // Update in transaction
    const result = await req.prisma.$transaction(async (prisma) => {
      // Update group session location if provided
      const updatedGroupSession = await prisma.groupSession.update({
        where: { id: groupSessionId },
        data: {
          ...(location && { location }),
          ...(clientIds && { maxSize: Math.max(4, clientIds.length) })
        }
      });
      
      // If clientIds provided, update the client list
      if (clientIds) {
        // Remove all existing clients
        await prisma.groupSessionClient.deleteMany({
          where: { groupSessionId }
        });
        
        // Delete existing assignments
        await prisma.assignment.deleteMany({
          where: { groupSessionId }
        });
        
        // Add new clients and create assignments
        const assignments = [];
        for (const clientId of clientIds) {
          // Add client to group session
          await prisma.groupSessionClient.create({
            data: {
              groupSessionId,
              clientId
            }
          });
          
          // Create assignment
          const assignment = await prisma.assignment.create({
            data: {
              day: groupSession.day,
              block: groupSession.block,
              staffId: groupSession.staffId,
              clientId,
              versionId: groupSession.versionId,
              isGroup: true,
              groupSessionId
            },
            include: {
              staff: true,
              client: true
            }
          });
          
          assignments.push(assignment);
        }
        
        return { groupSession: updatedGroupSession, assignments };
      }
      
      // If only location updated, return existing assignments
      const existingAssignments = await prisma.assignment.findMany({
        where: { groupSessionId },
        include: {
          staff: true,
          client: true
        }
      });
      
      return { groupSession: updatedGroupSession, assignments: existingAssignments };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error updating group session:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    // Return the actual error message for debugging
    res.status(500).json({
      error: 'Failed to update group session',
      details: error.message
    });
  }
});

// Add client to existing group session
router.post('/group-sessions/:id/clients', async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId } = req.body;
    const groupSessionId = parseInt(id);
    
    // Get group session
    const groupSession = await req.prisma.groupSession.findUnique({
      where: { id: groupSessionId },
      include: {
        clients: true
      }
    });
    
    if (!groupSession) {
      return res.status(404).json({ error: 'Group session not found' });
    }
    
    // Check if group is full
    if (groupSession.clients.length >= groupSession.maxSize) {
      return res.status(400).json({ error: 'Group session is full' });
    }
    
    // Check if client is already in group
    if (groupSession.clients.some(gc => gc.clientId === clientId)) {
      return res.status(400).json({ error: 'Client is already in this group session' });
    }
    
    // Check client availability and location
    const client = await req.prisma.client.findUnique({
      where: { id: clientId }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    const availabilityKey = `${groupSession.day}-${groupSession.block}`;
    if (!client.availability[availabilityKey]) {
      return res.status(400).json({ error: 'Client is not available at this time' });
    }
    
    if (!client.locations.includes(groupSession.location)) {
      return res.status(400).json({ error: `Client is not at location ${groupSession.location}` });
    }
    
    // Check for conflicts
    const existingAssignment = await req.prisma.assignment.findFirst({
      where: {
        versionId: groupSession.versionId,
        day: groupSession.day,
        block: groupSession.block,
        clientId
      }
    });
    
    if (existingAssignment) {
      return res.status(400).json({ error: 'Client already has an assignment at this time' });
    }
    
    // Add client to group
    const result = await req.prisma.$transaction(async (prisma) => {
      // Add to group session
      await prisma.groupSessionClient.create({
        data: {
          groupSessionId,
          clientId
        }
      });
      
      // Create assignment
      const assignment = await prisma.assignment.create({
        data: {
          day: groupSession.day,
          block: groupSession.block,
          staffId: groupSession.staffId,
          clientId,
          versionId: groupSession.versionId,
          isGroup: true,
          groupSessionId
        },
        include: {
          staff: true,
          client: true
        }
      });
      
      return assignment;
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding client to group session:', error);
    res.status(500).json({ error: 'Failed to add client to group session' });
  }
});

// Remove client from group session
router.delete('/group-sessions/:id/clients/:clientId', async (req, res) => {
  try {
    const { id, clientId } = req.params;
    const groupSessionId = parseInt(id);
    const clientIdInt = parseInt(clientId);
    
    // Get group session
    const groupSession = await req.prisma.groupSession.findUnique({
      where: { id: groupSessionId },
      include: {
        clients: true
      }
    });
    
    if (!groupSession) {
      return res.status(404).json({ error: 'Group session not found' });
    }
    
    // Check if client is in group
    if (!groupSession.clients.some(gc => gc.clientId === clientIdInt)) {
      return res.status(400).json({ error: 'Client is not in this group session' });
    }
    
    // Remove client from group
    await req.prisma.$transaction(async (prisma) => {
      // Remove from group session
      await prisma.groupSessionClient.deleteMany({
        where: {
          groupSessionId,
          clientId: clientIdInt
        }
      });
      
      // Delete assignment
      await prisma.assignment.deleteMany({
        where: {
          groupSessionId,
          clientId: clientIdInt
        }
      });
      
      // If this was the last client, delete the group session
      if (groupSession.clients.length === 1) {
        await prisma.groupSession.delete({
          where: { id: groupSessionId }
        });
      }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing client from group session:', error);
    res.status(500).json({ error: 'Failed to remove client from group session' });
  }
});

// Delete entire group session
router.delete('/group-sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const groupSessionId = parseInt(id);
    
    // Delete in transaction
    await req.prisma.$transaction(async (prisma) => {
      // Delete all assignments for this group
      await prisma.assignment.deleteMany({
        where: { groupSessionId }
      });
      
      // Delete all group session clients
      await prisma.groupSessionClient.deleteMany({
        where: { groupSessionId }
      });
      
      // Delete the group session
      await prisma.groupSession.delete({
        where: { id: groupSessionId }
      });
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting group session:', error);
    res.status(500).json({ error: 'Failed to delete group session' });
  }
});

module.exports = router;