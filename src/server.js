const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const scheduleVersionRoutes = require('./routes/scheduleVersion.routes');
const groupSessionRoutes = require('./routes/groupSession.routes');
const supervisorRoutes = require('./routes/supervisor.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const { authMiddleware, optionalAuth } = require('./middleware/auth');

// Try to load daily override routes if they exist
let dailyOverrideRoutes;
try {
  dailyOverrideRoutes = require('./routes/dailyOverride.routes');
} catch (err) {
  console.log('Daily override routes not found, skipping...');
}

require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma Client
const prisma = new PrismaClient();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Add prisma to request object for routes
app.use((req, res, next) => {
  req.prisma = prisma;
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no authentication required)
app.use('/api/auth', authRoutes);

// User management routes (authentication required)
app.use('/api/users', userRoutes);

// Apply optional authentication to all other routes
// This allows the app to work with or without login
app.use(optionalAuth);

// Client routes
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, locations, authorizedHours, availability } = req.body;
    
    // Check for duplicate name
    const existingClient = await prisma.client.findFirst({
      where: { 
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });
    
    if (existingClient) {
      return res.status(400).json({ error: 'A client with this name already exists' });
    }
    
    const client = await prisma.client.create({
      data: {
        name,
        locations,
        authorizedHours: authorizedHours || 0,
        availability: availability || {}
      }
    });
    res.status(201).json(client);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, locations, authorizedHours, availability } = req.body;
    
    const client = await prisma.client.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(locations && { locations }),
        ...(authorizedHours !== undefined && { authorizedHours }),
        ...(availability && { availability })
      }
    });
    res.json(client);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

// Staff routes
app.get('/api/staff', async (req, res) => {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { name, locations, availability } = req.body;
    
    // Check for duplicate name
    const existingStaff = await prisma.staff.findFirst({
      where: { 
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });
    
    if (existingStaff) {
      return res.status(400).json({ error: 'A staff member with this name already exists' });
    }
    
    const staff = await prisma.staff.create({
      data: {
        name,
        locations,
        availability: availability || {}
      }
    });
    res.status(201).json(staff);
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, locations, availability } = req.body;
    
    const staff = await prisma.staff.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(locations && { locations }),
        ...(availability && { availability })
      }
    });
    res.json(staff);
  } catch (error) {
    console.error('Error updating staff:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

app.delete('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.staff.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// Helper function to create change log entries
const createChangeLogEntry = async (changeType, versionId, assignment, previousAssignment = null) => {
  try {
    // Only create change logs for main schedule changes
    const version = await prisma.scheduleVersion.findUnique({
      where: { id: versionId }
    });
    
    if (!version || version.type !== 'main') {
      return; // Skip change log for non-main schedules
    }
    
    const changeLogData = {
      versionId,
      changeType,
      entityType: 'assignment',
      entityId: assignment.id || null,
      day: assignment.day,
      block: assignment.block,
      staffId: assignment.staffId,
      clientId: assignment.clientId,
      newValue: {
        staffId: assignment.staffId,
        clientId: assignment.clientId,
        day: assignment.day,
        block: assignment.block,
        plannedDate: assignment.plannedDate
      },
      previousValue: previousAssignment ? {
        staffId: previousAssignment.staffId,
        clientId: previousAssignment.clientId,
        day: previousAssignment.day,
        block: previousAssignment.block,
        plannedDate: previousAssignment.plannedDate
      } : null,
      committedToMain: true,
      committedAt: new Date(),
      createdBy: 'system', // Could be enhanced to track actual user
      notes: null
    };
    
    await prisma.changeLog.create({
      data: changeLogData
    });
    
    console.log(`📝 Created change log: ${changeType} for assignment ${assignment.staffId} → ${assignment.clientId} (${assignment.day} ${assignment.block})`);
  } catch (error) {
    console.error('Failed to create change log entry:', error);
    // Don't throw error here to avoid breaking the main operation
  }
};

// Assignment routes
app.get('/api/assignments', async (req, res) => {
  try {
    const { versionId } = req.query;
    
    // Default to main version if not specified
    let version = versionId ? parseInt(versionId) : null;
    if (!version) {
      const mainVersion = await prisma.scheduleVersion.findFirst({
        where: { type: 'main', status: 'active' }
      });
      version = mainVersion?.id || 1;
    }
    
    const assignments = await prisma.assignment.findMany({
      where: { versionId: version },
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
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const { day, block, staffId, clientId, versionId, isGroup, groupSessionId, plannedDate } = req.body;
    
    // Get version or default to main
    let version = versionId ? parseInt(versionId) : null;
    if (!version) {
      const mainVersion = await prisma.scheduleVersion.findFirst({
        where: { type: 'main', status: 'active' }
      });
      version = mainVersion?.id || 1;
    }
    
    // Check for conflicts within the version
    const existingStaffAssignment = await prisma.assignment.findFirst({
      where: {
        versionId: version,
        day,
        block,
        staffId,
        // For group sessions, staff can have multiple assignments
        isGroup: isGroup ? false : undefined
      }
    });
    
    if (existingStaffAssignment && !isGroup) {
      return res.status(400).json({ 
        error: 'Staff member is already assigned to another client at this time' 
      });
    }
    
    const existingClientAssignment = await prisma.assignment.findFirst({
      where: {
        versionId: version,
        day,
        block,
        clientId
      }
    });
    
    if (existingClientAssignment) {
      return res.status(400).json({ 
        error: 'Client already has a staff member assigned at this time' 
      });
    }
    
    const assignment = await prisma.assignment.create({
      data: { 
        day, 
        block, 
        staffId, 
        clientId,
        versionId: version,
        isGroup: isGroup || false,
        groupSessionId,
        ...(plannedDate && { plannedDate })
      },
      include: {
        staff: true,
        client: true,
        groupSession: true
      }
    });
    
    // Create change log entry for main schedule changes
    await createChangeLogEntry('assignment_added', version, assignment);
    
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

app.put('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { day, block, staffId, clientId, plannedDate } = req.body;
    
    // Get current assignment
    const currentAssignment = await prisma.assignment.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!currentAssignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    // Check for conflicts if changing time/people (only if those fields are provided)
    const updatingStaff = staffId !== undefined && currentAssignment.staffId !== staffId;
    const updatingDay = day !== undefined && currentAssignment.day !== day;
    const updatingBlock = block !== undefined && currentAssignment.block !== block;
    
    if (updatingStaff || updatingDay || updatingBlock) {
      const staffConflict = await prisma.assignment.findFirst({
        where: {
          day: day || currentAssignment.day,
          block: block || currentAssignment.block,
          staffId: staffId || currentAssignment.staffId,
          NOT: { id: parseInt(id) }
        }
      });
      
      if (staffConflict) {
        return res.status(400).json({ 
          error: 'Staff member is already assigned at this time' 
        });
      }
    }
    
    const updatingClient = clientId !== undefined && currentAssignment.clientId !== clientId;
    
    if (updatingClient || updatingDay || updatingBlock) {
      const clientConflict = await prisma.assignment.findFirst({
        where: {
          day: day || currentAssignment.day,
          block: block || currentAssignment.block,
          clientId: clientId || currentAssignment.clientId,
          NOT: { id: parseInt(id) }
        }
      });
      
      if (clientConflict) {
        return res.status(400).json({ 
          error: 'Client already has an assignment at this time' 
        });
      }
    }
    
    const assignment = await prisma.assignment.update({
      where: { id: parseInt(id) },
      data: { 
        ...(day !== undefined && { day }), 
        ...(block !== undefined && { block }), 
        ...(staffId !== undefined && { staffId }), 
        ...(clientId !== undefined && { clientId }),
        ...(plannedDate !== undefined && { plannedDate })
      },
      include: {
        staff: true,
        client: true
      }
    });
    
    // Create change log entry for main schedule changes
    await createChangeLogEntry('assignment_modified', assignment.versionId, assignment, currentAssignment);
    
    res.json(assignment);
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

app.delete('/api/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get assignment before deleting for change log
    const assignmentToDelete = await prisma.assignment.findUnique({
      where: { id: parseInt(id) },
      include: {
        staff: true,
        client: true
      }
    });
    
    if (!assignmentToDelete) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    
    await prisma.assignment.delete({
      where: { id: parseInt(id) }
    });
    
    // Create change log entry for main schedule changes
    await createChangeLogEntry('assignment_removed', assignmentToDelete.versionId, assignmentToDelete);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// Bulk assignment endpoint for drag-drop operations
app.post('/api/assignments/bulk', async (req, res) => {
  try {
    const { assignments } = req.body; // Array of assignments to create
    
    // Validate all assignments first
    for (const assignment of assignments) {
      const { day, block, staffId, clientId } = assignment;
      
      const staffConflict = await prisma.assignment.findUnique({
        where: {
          day_block_staffId: { day, block, staffId }
        }
      });
      
      if (staffConflict) {
        return res.status(400).json({ 
          error: `Staff member ${staffId} is already assigned on ${day} ${block}` 
        });
      }
      
      const clientConflict = await prisma.assignment.findUnique({
        where: {
          day_block_clientId: { day, block, clientId }
        }
      });
      
      if (clientConflict) {
        return res.status(400).json({ 
          error: `Client ${clientId} already has an assignment on ${day} ${block}` 
        });
      }
    }
    
    // Create all assignments
    const createdAssignments = await prisma.$transaction(
      assignments.map(assignment => 
        prisma.assignment.create({
          data: assignment,
          include: {
            staff: true,
            client: true
          }
        })
      )
    );
    
    res.status(201).json(createdAssignments);
  } catch (error) {
    console.error('Error creating bulk assignments:', error);
    res.status(500).json({ error: 'Failed to create assignments' });
  }
});

// Change log routes
app.get('/api/change-logs', async (req, res) => {
  try {
    const { versionId, committedOnly, limit = 50 } = req.query;
    
    const where = {};
    if (versionId) where.versionId = parseInt(versionId);
    if (committedOnly === 'true') where.committedToMain = true;
    
    const changeLogs = await prisma.changeLog.findMany({
      where,
      include: {
        staff: true,
        client: true,
        version: true
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });
    
    res.json(changeLogs);
  } catch (error) {
    console.error('Error fetching change logs:', error);
    res.status(500).json({ error: 'Failed to fetch change logs' });
  }
});

// Swap clients between assignments
app.post('/api/assignments/swap', async (req, res) => {
  try {
    const { sourceAssignmentId, targetClientId, versionId } = req.body;
    
    // Get the source assignment
    const sourceAssignment = await prisma.assignment.findUnique({
      where: { id: parseInt(sourceAssignmentId) },
      include: { staff: true, client: true }
    });
    
    if (!sourceAssignment) {
      return res.status(404).json({ error: 'Source assignment not found' });
    }
    
    // Check if target client is currently assigned somewhere
    const targetAssignment = await prisma.assignment.findFirst({
      where: {
        clientId: parseInt(targetClientId),
        versionId: sourceAssignment.versionId
      },
      include: { staff: true, client: true }
    });
    
    // Get target client info
    const targetClient = await prisma.client.findUnique({
      where: { id: parseInt(targetClientId) }
    });
    
    const result = await prisma.$transaction(async (tx) => {
      let updatedAssignments = [];
      let changeLogEntries = [];
      
      if (targetAssignment) {
        // Cross-staff swap: swap clients between two assignments
        await tx.assignment.update({
          where: { id: sourceAssignment.id },
          data: { clientId: parseInt(targetClientId) }
        });
        
        await tx.assignment.update({
          where: { id: targetAssignment.id },
          data: { clientId: sourceAssignment.clientId }
        });
        
        updatedAssignments = [sourceAssignment.id, targetAssignment.id];
        
        // Create change log entry for cross-staff swap (main schedule only)
        if (sourceAssignment.versionId === 1) { // Assuming version 1 is main
          await tx.changeLog.create({
            data: {
              versionId: sourceAssignment.versionId,
              changeType: 'client_swapped',
              entityType: 'assignment',
              entityId: sourceAssignment.id,
              day: sourceAssignment.day,
              block: sourceAssignment.block,
              staffId: sourceAssignment.staffId,
              clientId: parseInt(targetClientId),
              previousValue: {
                clientName: sourceAssignment.client?.name,
                clientId: sourceAssignment.clientId,
                targetStaffName: targetAssignment.staff?.name,
                targetStaffId: targetAssignment.staffId,
                targetClientName: targetAssignment.client?.name,
                targetClientId: targetAssignment.clientId
              },
              newValue: {
                clientName: targetClient?.name,
                clientId: parseInt(targetClientId),
                targetStaffName: targetAssignment.staff?.name,
                targetStaffId: targetAssignment.staffId,
                targetClientName: sourceAssignment.client?.name,
                targetClientId: sourceAssignment.clientId
              },
              committedToMain: true,
              committedAt: new Date(),
              createdBy: 'user',
              notes: `Cross-staff swap: ${sourceAssignment.staff?.name} ↔ ${targetAssignment.staff?.name}`
            }
          });
        }
      } else {
        // Simple swap: replace client in existing assignment
        await tx.assignment.update({
          where: { id: sourceAssignment.id },
          data: { clientId: parseInt(targetClientId) }
        });
        
        updatedAssignments = [sourceAssignment.id];
        
        // Create change log entry for simple swap (main schedule only)
        if (sourceAssignment.versionId === 1) { // Assuming version 1 is main
          await tx.changeLog.create({
            data: {
              versionId: sourceAssignment.versionId,
              changeType: 'client_swapped',
              entityType: 'assignment',
              entityId: sourceAssignment.id,
              day: sourceAssignment.day,
              block: sourceAssignment.block,
              staffId: sourceAssignment.staffId,
              clientId: parseInt(targetClientId),
              previousValue: {
                clientName: sourceAssignment.client?.name,
                clientId: sourceAssignment.clientId
              },
              newValue: {
                clientName: targetClient?.name,
                clientId: parseInt(targetClientId)
              },
              committedToMain: true,
              committedAt: new Date(),
              createdBy: 'user'
            }
          });
        }
      }
      
      return { updatedAssignments, hasConflict: !!targetAssignment, targetAssignment };
    });
    
    res.json({
      success: true,
      message: 'Client swap completed',
      updatedAssignments: result.updatedAssignments,
      hasConflict: result.hasConflict,
      targetAssignment: result.targetAssignment
    });
    
  } catch (error) {
    console.error('Error swapping clients:', error);
    res.status(500).json({ error: 'Failed to swap clients' });
  }
});

// Check for assignment conflicts before swap
app.post('/api/assignments/check-conflict', async (req, res) => {
  try {
    const { clientId, versionId } = req.body;
    
    const existingAssignment = await prisma.assignment.findFirst({
      where: {
        clientId: parseInt(clientId),
        versionId: parseInt(versionId || 1)
      },
      include: {
        staff: true,
        client: true
      }
    });
    
    res.json({
      hasConflict: !!existingAssignment,
      conflictInfo: existingAssignment ? {
        staffName: existingAssignment.staff?.name,
        day: existingAssignment.day,
        block: existingAssignment.block,
        assignmentId: existingAssignment.id
      } : null
    });
    
  } catch (error) {
    console.error('Error checking conflict:', error);
    res.status(500).json({ error: 'Failed to check conflict' });
  }
});

// Update change log review status
app.patch('/api/change-logs/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewed, reviewedBy } = req.body;
    
    const changeLog = await prisma.changeLog.update({
      where: { id: parseInt(id) },
      data: {
        reviewed: reviewed,
        reviewedAt: reviewed ? new Date() : null,
        reviewedBy: reviewed ? (reviewedBy || 'user') : null
      },
      include: {
        staff: true,
        client: true,
        version: true
      }
    });
    
    res.json(changeLog);
  } catch (error) {
    console.error('Error updating change log review status:', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

// Clear change log route
app.delete('/api/change-logs', async (req, res) => {
  try {
    const { committedOnly } = req.query;
    
    const where = {};
    if (committedOnly === 'true') where.committedToMain = true;
    
    const result = await prisma.changeLog.deleteMany({
      where
    });
    
    res.json({ 
      message: `Cleared ${result.count} change log entries`,
      deletedCount: result.count 
    });
  } catch (error) {
    console.error('Error clearing change logs:', error);
    res.status(500).json({ error: 'Failed to clear change logs' });
  }
});

// Debug endpoint to check staff
app.get('/api/debug/staff', async (req, res) => {
  try {
    const allStaff = await prisma.staff.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    
    res.json({
      totalStaff: allStaff.length,
      staff: allStaff
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mount schedule version routes
// Webhook routes
app.use('/api/webhooks', require('./routes/webhook.routes'));

app.use('/api', scheduleVersionRoutes);
app.use('/api', groupSessionRoutes);
app.use('/api', supervisorRoutes);
if (dailyOverrideRoutes) {
  app.use('/api', dailyOverrideRoutes);
}

// Start server
const startServer = async () => {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('YOUR_PASSWORD')) {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
    } else {
      console.log('⚠️  No database configured - running in demo mode');
      console.log('   Set DATABASE_URL in .env to connect to database');
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`   Frontend: http://localhost:5173`);
      console.log(`   Backend: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.log('💡 Try updating the DATABASE_URL in your .env file');
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});