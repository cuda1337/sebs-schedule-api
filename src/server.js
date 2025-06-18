const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const scheduleVersionRoutes = require('./routes/scheduleVersion.routes');
const groupSessionRoutes = require('./routes/groupSession.routes');
const supervisorRoutes = require('./routes/supervisor.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const backupRoutes = require('./routes/backup.routes');
const { authMiddleware, optionalAuth } = require('./middleware/auth');
const { initDatabase } = require('./initDatabase');

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
// Allow both production and local development origins
const allowedOrigins = [
  'https://sebs-schedule-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
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

// Backup routes (no authentication required for emergency recovery)
app.use('/api/backup', backupRoutes);

// User management routes (authentication required)
app.use('/api/users', userRoutes);

// Webhook routes (BEFORE auth middleware - no authentication required)
app.use('/api/webhooks', require('./routes/webhook.routes'));

// Migration routes (BEFORE auth middleware - no authentication required)
app.use('/api/migrate', require('./routes/migrate.routes'));

// Enhanced lunch schedule routes (BEFORE auth middleware - no authentication required)
app.use('/api/enhanced-lunch-schedule', require('./routes/enhancedLunchSchedule.routes'));

// Debug lunch schedule routes (BEFORE auth middleware - no authentication required)
app.use('/api/debug-lunch', require('./routes/debug-lunch.routes'));

// Debug database schema routes (BEFORE auth middleware - no authentication required)
app.use('/api/debug-database', require('./routes/debug-database.routes'));

// Simple debug endpoint directly in server
app.get('/api/debug-schema', async (req, res) => {
  try {
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'LunchSchedule'
      ORDER BY ordinal_position;
    `;
    res.json({ lunchScheduleColumns: columns });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Debug endpoint to see saved lunch schedule data
app.get('/api/debug-lunch-data', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    // Get lunch schedules
    let schedules;
    if (date && location) {
      schedules = await prisma.$queryRaw`
        SELECT id, date, location, "isFinalized", "createdBy", "createdAt"
        FROM "LunchSchedule" 
        WHERE date = ${new Date(date)}::date AND location = ${location}
      `;
    } else {
      schedules = await prisma.$queryRaw`
        SELECT id, date, location, "isFinalized", "createdBy", "createdAt"
        FROM "LunchSchedule" 
        ORDER BY "createdAt" DESC LIMIT 5
      `;
    }

    // Get time blocks for these schedules
    const timeBlocks = await prisma.$queryRaw`
      SELECT tb.*, ls.location as schedule_location
      FROM "LunchTimeBlock" tb
      JOIN "LunchSchedule" ls ON ls.id = tb."lunchScheduleId"
      ORDER BY ls."createdAt" DESC, tb."startTime"
      LIMIT 10
    `;

    // Get groups for these time blocks  
    const groups = await prisma.$queryRaw`
      SELECT lg.*, tb."lunchScheduleId"
      FROM "LunchGroup" lg
      JOIN "LunchTimeBlock" tb ON tb.id = lg."timeBlockId"
      ORDER BY lg."createdAt" DESC
      LIMIT 10
    `;

    res.json({
      schedules,
      timeBlocks, 
      groups,
      query: { date, location }
    });
  } catch (error) {
    res.json({ error: error.message, stack: error.stack });
  }
});

// Test endpoint to check database schema
app.get('/api/admin/test-staff-schema', async (req, res) => {
  try {
    // Check what columns exist in the Staff table
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'Staff' 
      ORDER BY ordinal_position;
    `;
    
    // Try to get first staff record to see what fields are available
    const sampleStaff = await prisma.staff.findFirst();
    
    res.json({ 
      success: true, 
      columns: columns,
      sampleStaff: sampleStaff 
    });
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    res.status(500).json({ error: 'Failed to check schema', details: error.message });
  }
});

// Manual migration endpoint for emergency database updates (no auth required)
app.post('/api/admin/migrate-staff-fields', async (req, res) => {
  try {
    console.log('🔧 Running manual staff fields migration...');
    
    // Run the SQL migration directly
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
          -- Add role column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'role') THEN
              ALTER TABLE "Staff" ADD COLUMN "role" TEXT;
              RAISE NOTICE 'Added role column';
          END IF;
          
          -- Add testDate column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'testDate') THEN
              ALTER TABLE "Staff" ADD COLUMN "testDate" TEXT;
              RAISE NOTICE 'Added testDate column';
          END IF;
          
          -- Add active column if it doesn't exist
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Staff' AND column_name = 'active') THEN
              ALTER TABLE "Staff" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
              RAISE NOTICE 'Added active column';
          END IF;
      END $$;
    `;
    
    // Update existing records to have default role
    await prisma.$executeRaw`UPDATE "Staff" SET "role" = 'RBT' WHERE "role" IS NULL;`;
    
    console.log('✅ Staff fields migration completed successfully');
    res.json({ success: true, message: 'Staff table migration completed successfully' });
  } catch (error) {
    console.error('❌ Error running migration:', error);
    res.status(500).json({ error: 'Failed to run migration', details: error.message });
  }
});

// Force server restart to regenerate Prisma client
app.post('/api/admin/restart-server', async (req, res) => {
  try {
    console.log('🔄 Server restart requested to regenerate Prisma client...');
    res.json({ success: true, message: 'Server restarting to apply schema changes...' });
    
    // Close database connection and exit process
    // Render will automatically restart the service
    setTimeout(async () => {
      await prisma.$disconnect();
      process.exit(0);
    }, 1000);
  } catch (error) {
    console.error('❌ Error restarting server:', error);
    res.status(500).json({ error: 'Failed to restart server', details: error.message });
  }
});

// Authentication middleware
app.use(authMiddleware);

// Import reassignment routes
const reassignmentRoutes = require('./routes/reassignment.routes');
app.use('/api/reassignments', reassignmentRoutes);

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
    // Use raw SQL to get all fields including new ones
    const staff = await prisma.$queryRaw`
      SELECT * FROM "Staff" ORDER BY "name" ASC
    `;
    res.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

app.post('/api/staff', async (req, res) => {
  try {
    const { name, locations, availability, role, testDate, active } = req.body;
    
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
    
    // Try creating with new fields first
    try {
      const staff = await prisma.staff.create({
        data: {
          name,
          locations,
          availability: availability || {},
          role: role || 'RBT',
          testDate: testDate,
          active: active !== undefined ? active : true
        }
      });
      res.status(201).json(staff);
    } catch (prismaError) {
      // If that fails (likely due to missing columns), fall back to legacy fields only
      console.warn('New fields not available, using legacy create:', prismaError.message);
      const staff = await prisma.staff.create({
        data: {
          name,
          locations,
          availability: availability || {}
        }
      });
      res.status(201).json(staff);
    }
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

app.put('/api/staff/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, locations, availability, role, testDate, active } = req.body;
    
    console.log(`🔄 Updating staff ${id} with data:`, { name, locations, availability, role, testDate, active });
    
    // Use raw SQL to update with all fields including new ones
    await prisma.$executeRaw`
      UPDATE "Staff" 
      SET 
        "name" = COALESCE(${name}, "name"),
        "locations" = COALESCE(${locations}::text[], "locations"),
        "availability" = COALESCE(${availability}::jsonb, "availability"),
        "role" = COALESCE(${role}, "role"),
        "testDate" = COALESCE(${testDate}, "testDate"),
        "active" = COALESCE(${active}::boolean, "active"),
        "updatedAt" = NOW()
      WHERE "id" = ${parseInt(id)}
    `;
    
    // Get the updated record using raw SQL to include all fields
    const staff = await prisma.$queryRaw`
      SELECT * FROM "Staff" WHERE "id" = ${parseInt(id)}
    `;
    
    console.log(`✅ Staff ${id} updated successfully:`, staff[0]);
    res.json(staff[0]);
  } catch (error) {
    console.error('❌ Error updating staff:', error);
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

// Helper function to check and update reassignments when assignments are created
const checkAndUpdateReassignments = async (assignment) => {
  try {
    // Only check for main schedule assignments
    const version = await prisma.scheduleVersion.findUnique({
      where: { id: assignment.versionId }
    });
    
    if (!version || version.type !== 'main') {
      return; // Skip for non-main schedules
    }
    
    // Find any pending reassignments that match this assignment
    const matchingReassignments = await prisma.reassignmentNeeded.findMany({
      where: {
        clientId: assignment.clientId,
        day: assignment.day,
        block: assignment.block,
        status: { in: ['pending', 'planned'] }
      }
    });
    
    // Update matching reassignments to 'reassigned' status
    for (const reassignment of matchingReassignments) {
      await prisma.reassignmentNeeded.update({
        where: { id: reassignment.id },
        data: { status: 'reassigned' }
      });
      
      console.log(`✅ Auto-resolved reassignment: ${reassignment.client?.name || 'Client'} ${assignment.day} ${assignment.block}`);
    }
    
    // Also check for planned assignments that might indicate a reassignment is planned
    const plannedAssignments = await prisma.assignment.findMany({
      where: {
        clientId: assignment.clientId,
        day: assignment.day,
        block: assignment.block,
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
    
    // Update reassignments to show planned status if there are planned assignments
    for (const plannedAssignment of plannedAssignments) {
      const reassignments = await prisma.reassignmentNeeded.findMany({
        where: {
          clientId: assignment.clientId,
          day: assignment.day,
          block: assignment.block,
          status: 'pending'
        }
      });
      
      for (const reassignment of reassignments) {
        await prisma.reassignmentNeeded.update({
          where: { id: reassignment.id },
          data: {
            status: 'planned',
            plannedStaffId: plannedAssignment.staffId,
            plannedDate: plannedAssignment.version.startDate
          }
        });
      }
    }
    
  } catch (error) {
    console.error('Failed to check reassignments:', error);
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
    
    // Calculate staff counts for each client at each time slot
    const staffCounts = {};
    for (const assignment of assignments) {
      const key = `${assignment.clientId}-${assignment.day}-${assignment.block}`;
      staffCounts[key] = (staffCounts[key] || 0) + 1;
    }
    
    // Add staff count info to each assignment
    const assignmentsWithStaffCount = assignments.map(assignment => {
      const key = `${assignment.clientId}-${assignment.day}-${assignment.block}`;
      const totalStaffForClient = staffCounts[key] || 1;
      
      // Find the staff number for this specific assignment
      const sameClientAssignments = assignments.filter(a => 
        a.clientId === assignment.clientId && 
        a.day === assignment.day && 
        a.block === assignment.block
      ).sort((a, b) => a.id - b.id);
      
      const staffNumber = sameClientAssignments.findIndex(a => a.id === assignment.id) + 1;
      
      return {
        ...assignment,
        staffCount: {
          current: staffNumber,
          total: totalStaffForClient
        }
      };
    });
    
    res.json(assignmentsWithStaffCount);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

app.post('/api/assignments', async (req, res) => {
  try {
    const { day, block, staffId, clientId, versionId, isGroup, groupSessionId, plannedDate, overrideClientConflict } = req.body;
    
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
    
    if (existingClientAssignment && !overrideClientConflict) {
      // Count existing assignments for this client at this time
      const clientAssignmentCount = await prisma.assignment.count({
        where: {
          versionId: version,
          day,
          block,
          clientId
        }
      });
      
      // Only allow override if client has less than 2 staff assigned
      if (clientAssignmentCount >= 2) {
        return res.status(400).json({ 
          error: 'Client already has the maximum of 2 staff members assigned at this time' 
        });
      }
      
      return res.status(400).json({ 
        error: 'Client already has a staff member assigned at this time',
        requiresOverride: true,
        existingStaffCount: clientAssignmentCount
      });
    }
    
    // Check if this is a second staff assignment
    let isSecondStaffAssignment = false;
    if (overrideClientConflict) {
      const clientAssignmentCount = await prisma.assignment.count({
        where: {
          versionId: version,
          day,
          block,
          clientId
        }
      });
      isSecondStaffAssignment = clientAssignmentCount > 0;
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
    const changeType = isSecondStaffAssignment ? 'assignment_added_second_staff' : 'assignment_added';
    await createChangeLogEntry(changeType, version, assignment);
    
    // Check if this assignment resolves any pending reassignments
    await checkAndUpdateReassignments(assignment);
    
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
    const { needsReassignment } = req.query;
    
    // Get assignment before deleting for change log
    const assignmentToDelete = await prisma.assignment.findUnique({
      where: { id: parseInt(id) },
      include: {
        staff: true,
        client: true,
        version: true
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
    
    // If this was from main schedule and needs reassignment, track it
    if (assignmentToDelete.version.type === 'main' && needsReassignment === 'true') {
      // First check if the client already has an assignment at this time
      const existingAssignment = await prisma.assignment.findFirst({
        where: {
          clientId: assignmentToDelete.clientId,
          day: assignmentToDelete.day,
          block: assignmentToDelete.block,
          version: {
            type: 'main',
            status: 'active'
          }
        }
      });
      
      // Only create reassignment need if no other assignment exists for this client/time
      if (!existingAssignment) {
        await prisma.reassignmentNeeded.create({
          data: {
            clientId: assignmentToDelete.clientId,
            originalStaffId: assignmentToDelete.staffId,
            originalStaffName: assignmentToDelete.staff.name,
            day: assignmentToDelete.day,
            block: assignmentToDelete.block,
            location: assignmentToDelete.client.locations[0] || 'Unknown',
            deletedBy: req.user?.name || 'system'
          }
        });
      }
    }
    
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
        
        // Create TWO change log entries for cross-staff swap (main schedule only)
        if (sourceAssignment.versionId === 1) { // Assuming version 1 is main
          // Change log entry for source staff (Staff A: Client X → Client Y)
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
              createdBy: 'user',
              notes: `Cross-staff swap with ${targetAssignment.staff?.name}`
            }
          });
          
          // Change log entry for target staff (Staff B: Client Y → Client X) 
          await tx.changeLog.create({
            data: {
              versionId: sourceAssignment.versionId,
              changeType: 'client_swapped',
              entityType: 'assignment',
              entityId: targetAssignment.id,
              day: targetAssignment.day,
              block: targetAssignment.block,
              staffId: targetAssignment.staffId,
              clientId: sourceAssignment.clientId,
              previousValue: {
                clientName: targetAssignment.client?.name,
                clientId: targetAssignment.clientId
              },
              newValue: {
                clientName: sourceAssignment.client?.name,
                clientId: sourceAssignment.clientId
              },
              committedToMain: true,
              committedAt: new Date(),
              createdBy: 'user',
              notes: `Cross-staff swap with ${sourceAssignment.staff?.name}`
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

// Mount test routes for debugging
app.use('/api/test', require('./routes/test-restore'));

// Mount schedule version routes

app.use('/api', scheduleVersionRoutes);
app.use('/api', groupSessionRoutes);
app.use('/api', supervisorRoutes);
app.use('/api/lunch-schedules', require('./routes/lunchSchedule.routes'));
if (dailyOverrideRoutes) {
  app.use('/api', dailyOverrideRoutes);
}

// Start server
const startServer = async () => {
  try {
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('YOUR_PASSWORD')) {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      
      // Initialize database schema and admin user
      await initDatabase();
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