const express = require('express');
const router = express.Router();

// Get all schedule versions
router.get('/schedule-versions', async (req, res) => {
  try {
    const versions = await req.prisma.scheduleVersion.findMany({
      where: { status: 'active' },
      orderBy: [
        { type: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        _count: {
          select: {
            assignments: true,
            groupSessions: true,
            changeLogs: true
          }
        }
      }
    });
    res.json(versions);
  } catch (error) {
    console.error('Error fetching schedule versions:', error);
    res.status(500).json({ error: 'Failed to fetch schedule versions' });
  }
});

// Get schedule version by ID
router.get('/schedule-versions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const version = await req.prisma.scheduleVersion.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            assignments: true,
            groupSessions: true,
            changeLogs: true
          }
        }
      }
    });
    
    if (!version) {
      return res.status(404).json({ error: 'Schedule version not found' });
    }
    
    res.json(version);
  } catch (error) {
    console.error('Error fetching schedule version:', error);
    res.status(500).json({ error: 'Failed to fetch schedule version' });
  }
});

// Create new schedule version
router.post('/schedule-versions', async (req, res) => {
  try {
    const { name, type, startDate, description, sourceVersionId } = req.body;
    
    // Validate type
    if (!['hypothetical', 'planned'].includes(type)) {
      return res.status(400).json({ error: 'Invalid schedule type. Must be "hypothetical" or "planned"' });
    }
    
    // Create the new version
    const newVersion = await req.prisma.scheduleVersion.create({
      data: {
        name,
        type,
        startDate: startDate ? new Date(startDate) : null,
        description,
        createdBy: 'user', // TODO: Get from auth
        status: 'active'
      }
    });
    
    // If sourceVersionId is provided, copy assignments from that version
    if (sourceVersionId) {
      const sourceAssignments = await req.prisma.assignment.findMany({
        where: { versionId: parseInt(sourceVersionId) },
        include: {
          groupSession: true
        }
      });
      
      // Group assignments by group session
      const groupSessionMap = new Map();
      const individualAssignments = [];
      
      for (const assignment of sourceAssignments) {
        if (assignment.isGroup && assignment.groupSessionId) {
          if (!groupSessionMap.has(assignment.groupSessionId)) {
            groupSessionMap.set(assignment.groupSessionId, {
              groupSession: assignment.groupSession,
              assignments: []
            });
          }
          groupSessionMap.get(assignment.groupSessionId).assignments.push(assignment);
        } else {
          individualAssignments.push(assignment);
        }
      }
      
      // Copy group sessions first
      const groupSessionIdMap = new Map();
      for (const [oldGroupId, groupData] of groupSessionMap) {
        const newGroupSession = await req.prisma.groupSession.create({
          data: {
            day: groupData.groupSession.day,
            block: groupData.groupSession.block,
            staffId: groupData.groupSession.staffId,
            versionId: newVersion.id,
            location: groupData.groupSession.location,
            maxSize: groupData.groupSession.maxSize
          }
        });
        groupSessionIdMap.set(oldGroupId, newGroupSession.id);
        
        // Create group session clients and assignments
        for (const assignment of groupData.assignments) {
          await req.prisma.groupSessionClient.create({
            data: {
              groupSessionId: newGroupSession.id,
              clientId: assignment.clientId
            }
          });
          
          await req.prisma.assignment.create({
            data: {
              day: assignment.day,
              block: assignment.block,
              staffId: assignment.staffId,
              clientId: assignment.clientId,
              versionId: newVersion.id,
              isGroup: true,
              groupSessionId: newGroupSession.id
            }
          });
        }
      }
      
      // Copy individual assignments
      for (const assignment of individualAssignments) {
        await req.prisma.assignment.create({
          data: {
            day: assignment.day,
            block: assignment.block,
            staffId: assignment.staffId,
            clientId: assignment.clientId,
            versionId: newVersion.id,
            isGroup: false
          }
        });
      }
    }
    
    res.status(201).json(newVersion);
  } catch (error) {
    console.error('Error creating schedule version:', error);
    res.status(500).json({ error: 'Failed to create schedule version' });
  }
});

// Commit planned schedule to main
router.post('/schedule-versions/:id/commit', async (req, res) => {
  try {
    const { id } = req.params;
    const versionId = parseInt(id);
    
    // Get the version to commit
    const versionToCommit = await req.prisma.scheduleVersion.findUnique({
      where: { id: versionId }
    });
    
    if (!versionToCommit) {
      return res.status(404).json({ error: 'Schedule version not found' });
    }
    
    if (versionToCommit.type !== 'planned') {
      return res.status(400).json({ error: 'Only planned schedules can be committed to main' });
    }
    
    // Get main version
    const mainVersion = await req.prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      return res.status(500).json({ error: 'Main schedule version not found' });
    }
    
    // Start transaction
    const result = await req.prisma.$transaction(async (prisma) => {
      // Get all assignments from planned version
      const plannedAssignments = await prisma.assignment.findMany({
        where: { versionId: versionId },
        include: {
          staff: true,
          client: true,
          groupSession: {
            include: {
              clients: {
                include: {
                  client: true
                }
              }
            }
          }
        }
      });
      
      // Get all current main assignments
      const currentAssignments = await prisma.assignment.findMany({
        where: { versionId: mainVersion.id }
      });
      
      // Delete all current main assignments
      await prisma.assignment.deleteMany({
        where: { versionId: mainVersion.id }
      });
      
      // Delete all current main group sessions
      await prisma.groupSession.deleteMany({
        where: { versionId: mainVersion.id }
      });
      
      // Track changes for change log
      const changes = [];
      
      // Create map of current assignments for comparison
      const currentMap = new Map();
      currentAssignments.forEach(a => {
        currentMap.set(`${a.day}-${a.block}-${a.staffId}-${a.clientId}`, a);
      });
      
      // Copy all assignments from planned to main
      const groupSessionMap = new Map();
      
      for (const assignment of plannedAssignments) {
        // Handle group sessions
        if (assignment.isGroup && assignment.groupSessionId) {
          if (!groupSessionMap.has(assignment.groupSessionId)) {
            // Create new group session in main
            const newGroupSession = await prisma.groupSession.create({
              data: {
                day: assignment.groupSession.day,
                block: assignment.groupSession.block,
                staffId: assignment.groupSession.staffId,
                versionId: mainVersion.id,
                location: assignment.groupSession.location,
                maxSize: assignment.groupSession.maxSize
              }
            });
            groupSessionMap.set(assignment.groupSessionId, newGroupSession.id);
            
            // Add all clients to the group
            for (const gc of assignment.groupSession.clients) {
              await prisma.groupSessionClient.create({
                data: {
                  groupSessionId: newGroupSession.id,
                  clientId: gc.clientId
                }
              });
            }
          }
          
          // Create assignment with new group session ID
          await prisma.assignment.create({
            data: {
              day: assignment.day,
              block: assignment.block,
              staffId: assignment.staffId,
              clientId: assignment.clientId,
              versionId: mainVersion.id,
              isGroup: true,
              groupSessionId: groupSessionMap.get(assignment.groupSessionId)
            }
          });
        } else {
          // Create individual assignment
          await prisma.assignment.create({
            data: {
              day: assignment.day,
              block: assignment.block,
              staffId: assignment.staffId,
              clientId: assignment.clientId,
              versionId: mainVersion.id,
              isGroup: false
            }
          });
        }
        
        // Track change
        const key = `${assignment.day}-${assignment.block}-${assignment.staffId}-${assignment.clientId}`;
        const previousAssignment = currentMap.get(key);
        
        if (!previousAssignment) {
          // New assignment
          changes.push({
            versionId: versionId,
            changeType: 'assignment_added',
            entityType: 'assignment',
            day: assignment.day,
            block: assignment.block,
            staffId: assignment.staffId,
            clientId: assignment.clientId,
            newValue: {
              staff: assignment.staff.name,
              client: assignment.client.name,
              isGroup: assignment.isGroup
            },
            committedToMain: true,
            committedAt: new Date(),
            createdBy: 'user' // TODO: Get from auth
          });
        }
        currentMap.delete(key);
      }
      
      // Track deletions
      for (const [key, assignment] of currentMap) {
        changes.push({
          versionId: versionId,
          changeType: 'assignment_removed',
          entityType: 'assignment',
          entityId: assignment.id,
          day: assignment.day,
          block: assignment.block,
          staffId: assignment.staffId,
          clientId: assignment.clientId,
          previousValue: {
            staffId: assignment.staffId,
            clientId: assignment.clientId
          },
          committedToMain: true,
          committedAt: new Date(),
          createdBy: 'user' // TODO: Get from auth
        });
      }
      
      // Create change log entries
      if (changes.length > 0) {
        await prisma.changeLog.createMany({
          data: changes
        });
      }
      
      // Update version status
      await prisma.scheduleVersion.update({
        where: { id: versionId },
        data: { status: 'committed' }
      });
      
      return { changes: changes.length };
    });
    
    res.json({ 
      message: 'Schedule committed successfully', 
      changesApplied: result.changes 
    });
  } catch (error) {
    console.error('Error committing schedule:', error);
    res.status(500).json({ error: 'Failed to commit schedule' });
  }
});

module.exports = router;