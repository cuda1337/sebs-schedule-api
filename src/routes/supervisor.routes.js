const express = require('express');
const router = express.Router();

// Get current supervisor for a client
router.get('/clients/:clientId/supervisor/current', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const currentSupervisor = await req.prisma.clientSupervisor.findFirst({
      where: {
        clientId: parseInt(clientId),
        endDate: null // Current supervisor has no end date
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });
    
    res.json(currentSupervisor);
  } catch (error) {
    console.error('Error fetching current supervisor:', error);
    res.status(500).json({ error: 'Failed to fetch current supervisor' });
  }
});

// Get supervisor history for a client
router.get('/clients/:clientId/supervisors', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const supervisors = await req.prisma.clientSupervisor.findMany({
      where: {
        clientId: parseInt(clientId)
      },
      orderBy: {
        effectiveDate: 'desc'
      }
    });
    
    res.json(supervisors);
  } catch (error) {
    console.error('Error fetching supervisor history:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor history' });
  }
});

// Get all unique supervisor names
router.get('/supervisors', async (req, res) => {
  try {
    const supervisors = await req.prisma.clientSupervisor.findMany({
      select: {
        supervisorName: true
      },
      distinct: ['supervisorName'],
      orderBy: {
        supervisorName: 'asc'
      }
    });
    
    const supervisorNames = supervisors.map(s => s.supervisorName);
    res.json(supervisorNames);
  } catch (error) {
    console.error('Error fetching supervisors:', error);
    res.status(500).json({ error: 'Failed to fetch supervisors' });
  }
});

// Set supervisor for client
router.post('/supervisors', async (req, res) => {
  try {
    const { clientId, supervisorName, effectiveDate } = req.body;
    
    if (!clientId || !supervisorName || !effectiveDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate client exists
    const client = await req.prisma.client.findUnique({
      where: { id: parseInt(clientId) }
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Parse effective date
    const effectiveDateObj = new Date(effectiveDate);
    
    await req.prisma.$transaction(async (prisma) => {
      // End any current supervisor assignment that would overlap
      const currentSupervisor = await prisma.clientSupervisor.findFirst({
        where: {
          clientId: parseInt(clientId),
          endDate: null,
          effectiveDate: {
            lte: effectiveDateObj
          }
        }
      });
      
      if (currentSupervisor) {
        // Set end date to the day before the new effective date
        const endDate = new Date(effectiveDateObj);
        endDate.setDate(endDate.getDate() - 1);
        
        await prisma.clientSupervisor.update({
          where: { id: currentSupervisor.id },
          data: { endDate }
        });
      }
      
      // Create new supervisor assignment
      const newSupervisor = await prisma.clientSupervisor.create({
        data: {
          clientId: parseInt(clientId),
          supervisorName: supervisorName.trim(),
          effectiveDate: effectiveDateObj,
          createdBy: 'system' // Could be enhanced to track actual user
        }
      });
      
      return newSupervisor;
    });
    
    // Fetch the created supervisor record
    const createdSupervisor = await req.prisma.clientSupervisor.findFirst({
      where: {
        clientId: parseInt(clientId),
        supervisorName: supervisorName.trim(),
        effectiveDate: effectiveDateObj
      }
    });
    
    res.status(201).json(createdSupervisor);
  } catch (error) {
    console.error('Error setting supervisor:', error);
    res.status(500).json({ error: 'Failed to set supervisor' });
  }
});

// Update supervisor record
router.put('/supervisors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisorName, effectiveDate } = req.body;
    
    const updateData = {};
    if (supervisorName) updateData.supervisorName = supervisorName.trim();
    if (effectiveDate) updateData.effectiveDate = new Date(effectiveDate);
    
    const updatedSupervisor = await req.prisma.clientSupervisor.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    res.json(updatedSupervisor);
  } catch (error) {
    console.error('Error updating supervisor:', error);
    res.status(500).json({ error: 'Failed to update supervisor' });
  }
});

// Remove supervisor (set end date)
router.delete('/clients/:clientId/supervisor', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { endDate } = req.body;
    
    const endDateObj = endDate ? new Date(endDate) : new Date();
    
    // Find current supervisor and set end date
    const currentSupervisor = await req.prisma.clientSupervisor.findFirst({
      where: {
        clientId: parseInt(clientId),
        endDate: null
      }
    });
    
    if (!currentSupervisor) {
      return res.status(404).json({ error: 'No current supervisor found' });
    }
    
    await req.prisma.clientSupervisor.update({
      where: { id: currentSupervisor.id },
      data: { endDate: endDateObj }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing supervisor:', error);
    res.status(500).json({ error: 'Failed to remove supervisor' });
  }
});

module.exports = router;