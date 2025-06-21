const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/daily-schedule - Get daily schedule state for a specific date
router.get('/', async (req, res) => {
  try {
    const { date, location } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      // If no daily state exists, build it from base schedule
      dailyState = await buildInitialDailyState(date, location);
    } else {
      // Transform database record to proper format
      dailyState = {
        date: date,
        staffPositions: dailyState.staffPositions || [],
        sessions: dailyState.sessions || [],
        clientStates: dailyState.clientStates || [],
        auditLog: dailyState.auditLog || []
      };
    }

    // Filter by location if specified
    if (location && location !== 'All Locations') {
      dailyState = filterStateByLocation(dailyState, location);
    }

    return res.json(dailyState);
  } catch (error) {
    console.error('Daily Schedule API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/daily-schedule - Update daily schedule state
router.put('/', async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const { staffPositions, sessions, clientStates } = req.body;

    const updatedState = await prisma.dailyScheduleState.upsert({
      where: { date: new Date(date) },
      update: {
        staffPositions,
        sessions,
        clientStates,
        updatedAt: new Date()
      },
      create: {
        date: new Date(date),
        staffPositions,
        sessions,
        clientStates,
        auditLog: []
      }
    });

    return res.json(updatedState);
  } catch (error) {
    console.error('Daily Schedule API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/daily-schedule - Handle various daily schedule actions
router.post('/', async (req, res) => {
  try {
    const { date } = req.query;
    const { action } = req.body;

    switch (action) {
      case 'move-staff':
        return await handleMoveStaff(req, res, date);
      case 'move-client':
        return await handleMoveClient(req, res, date);
      case 'create-session':
        return await handleCreateSession(req, res, date);
      case 'add-staff-to-session':
        return await handleAddStaffToSession(req, res, date);
      case 'remove-staff-from-session':
        return await handleRemoveStaffFromSession(req, res, date);
      case 'add-client-to-session':
        return await handleAddClientToSession(req, res, date);
      case 'remove-client-from-session':
        return await handleRemoveClientFromSession(req, res, date);
      case 'cancel-session':
        return await handleCancelSession(req, res, date);
      case 'mark-callout':
        return await handleMarkCallout(req, res, date);
      case 'change-staff-location':
        return await handleChangeStaffLocation(req, res, date);
      case 'add-staff-slot':
        return await handleAddStaffSlot(req, res, date);
      case 'add-to-group':
        return await handleAddToGroup(req, res, date);
      case 'assign-staff':
        return await handleAssignStaff(req, res, date);
      case 'assign-client':
        return await handleAssignClient(req, res, date);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Daily Schedule API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to build initial daily state from base schedule
async function buildInitialDailyState(date, location) {
  console.log('Building initial state for date:', date, 'location:', location);
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  console.log('Day of week:', dayOfWeek);
  
  // Get main schedule version
  const mainVersion = await prisma.scheduleVersion.findFirst({
    where: { type: 'main', status: 'active' }
  });

  if (!mainVersion) {
    console.log('No main schedule version found, returning empty state');
    return {
      date,
      staffPositions: [],
      sessions: [],
      clientStates: [],
      auditLog: []
    };
  }

  console.log('Main version found:', mainVersion.id);

  // Get base assignments for this day
  const assignments = await prisma.assignment.findMany({
    where: {
      versionId: mainVersion.id,
      day: dayOfWeek
    },
    include: {
      staff: true,
      client: true
    }
  });

  console.log(`Found ${assignments.length} assignments for ${dayOfWeek}`);
  
  if (assignments.length > 0) {
    console.log('Sample assignment:', assignments[0]);
  }

  // Get all staff and clients
  const allStaff = await prisma.staff.findMany({
    where: { active: true }
  });
  const allClients = await prisma.client.findMany();
  
  console.log(`Found ${allStaff.length} active staff and ${allClients.length} clients`);

  // Check for any daily overrides for this date
  const overrides = await prisma.dailyOverride.findMany({
    where: {
      date: new Date(date),
      status: 'active'
    },
    include: {
      originalStaff: true,
      originalClient: true,
      newStaff: true,
      newClient: true
    }
  });

  // Build initial state
  const staffPositions = [];
  const sessions = [];
  const clientStates = [];
  const assignedStaffIds = new Set();
  const assignedClientIds = new Set();

  // Process assignments into sessions
  const sessionMap = new Map();
  
  for (const assignment of assignments) {
    const sessionKey = `${assignment.day}-${assignment.block}-${assignment.staffId}`;
    
    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, {
        sessionId: `session-${assignment.day}-${assignment.block}-${assignment.staffId}`,
        clientIds: [],
        staffIds: [assignment.staffId.toString()],
        timeSlot: assignment.block,
        location: assignment.staff.locations[0] || 'Unknown',
        status: 'active',
        sessionType: 'individual',
        originalState: {
          clientIds: [],
          staffIds: [assignment.staffId.toString()],
          wasFromBaseSchedule: true
        },
        reviewed: false,
        lastModified: new Date(),
        changeType: undefined
      });
    }
    
    const session = sessionMap.get(sessionKey);
    session.clientIds.push(assignment.clientId.toString());
    session.originalState.clientIds.push(assignment.clientId.toString());
    
    // Determine session type
    if (session.clientIds.length > 1) {
      session.sessionType = 'group';
    }
    
    assignedStaffIds.add(assignment.staffId);
    assignedClientIds.add(assignment.clientId);
  }

  // Convert sessions map to array
  sessions.push(...sessionMap.values());

  // Apply overrides to sessions
  for (const override of overrides) {
    // Handle callouts, cancellations, reassignments
    applyOverrideToState(sessions, staffPositions, clientStates, override);
  }

  // Build staff positions (AM and PM separately)
  for (const staff of allStaff) {
    const staffAvailability = staff.availability || {};
    console.log(`Staff ${staff.name} availability:`, staffAvailability);
    
    // Check for different availability formats
    const dayAvailability = staffAvailability[dayOfWeek] || {};
    
    // Handle different availability data structures
    let hasAM = false;
    let hasPM = false;
    
    if (dayAvailability.AM || dayAvailability.am) {
      hasAM = true;
    } else if (staffAvailability[`${dayOfWeek}-AM`]) {
      hasAM = true;
    } else if (assignments.some(a => a.staffId === staff.id && a.block === 'AM')) {
      // If staff has AM assignments, they're available for AM
      hasAM = true;
    }
    
    if (dayAvailability.PM || dayAvailability.pm) {
      hasPM = true;
    } else if (staffAvailability[`${dayOfWeek}-PM`]) {
      hasPM = true;
    } else if (assignments.some(a => a.staffId === staff.id && a.block === 'PM')) {
      // If staff has PM assignments, they're available for PM
      hasPM = true;
    }
    
    console.log(`Staff ${staff.name} - AM: ${hasAM}, PM: ${hasPM}`);
    
    // AM Position
    if (hasAM) {
      const amAssigned = sessions.some(s => 
        s.timeSlot === 'AM' && s.staffIds.includes(staff.id.toString())
      );
      
      staffPositions.push({
        staffId: staff.id.toString(),
        staffName: staff.name,
        shift: 'AM',
        position: amAssigned 
          ? { type: 'assigned', sessionId: sessions.find(s => 
              s.timeSlot === 'AM' && s.staffIds.includes(staff.id.toString())
            )?.sessionId }
          : (staff.role === 'In Training' ? { type: 'training' } : { type: 'available' }),
        location: staff.locations[0] || 'Unknown',
        originalLocation: staff.locations[0] || 'Unknown'
      });
    }

    // PM Position
    if (hasPM) {
      const pmAssigned = sessions.some(s => 
        s.timeSlot === 'PM' && s.staffIds.includes(staff.id.toString())
      );
      
      staffPositions.push({
        staffId: staff.id.toString(),
        staffName: staff.name,
        shift: 'PM',
        position: pmAssigned 
          ? { type: 'assigned', sessionId: sessions.find(s => 
              s.timeSlot === 'PM' && s.staffIds.includes(staff.id.toString())
            )?.sessionId }
          : (staff.role === 'In Training' ? { type: 'training' } : { type: 'available' }),
        location: staff.locations[0] || 'Unknown',
        originalLocation: staff.locations[0] || 'Unknown'
      });
    }
  }

  // Build client states
  for (const client of allClients) {
    const clientAvailability = client.availability || {};
    console.log(`Client ${client.name} availability:`, clientAvailability);
    
    const dayAvailability = clientAvailability[dayOfWeek] || {};
    
    // Handle different availability data structures
    let hasAM = false;
    let hasPM = false;
    
    if (dayAvailability.AM || dayAvailability.am) {
      hasAM = true;
    } else if (clientAvailability[`${dayOfWeek}-AM`]) {
      hasAM = true;
    } else if (assignments.some(a => a.clientId === client.id && a.block === 'AM')) {
      // If client has AM assignments, they're available for AM
      hasAM = true;
    }
    
    if (dayAvailability.PM || dayAvailability.pm) {
      hasPM = true;
    } else if (clientAvailability[`${dayOfWeek}-PM`]) {
      hasPM = true;
    } else if (assignments.some(a => a.clientId === client.id && a.block === 'PM')) {
      // If client has PM assignments, they're available for PM
      hasPM = true;
    }
    
    console.log(`Client ${client.name} - AM: ${hasAM}, PM: ${hasPM}`);
    
    // Check AM availability
    if (hasAM) {
      const amAssigned = sessions.some(s => 
        s.timeSlot === 'AM' && s.clientIds.includes(client.id.toString())
      );
      
      clientStates.push({
        clientId: client.id.toString(),
        clientName: client.name,
        shift: 'AM',
        position: amAssigned 
          ? { type: 'assigned', sessionId: sessions.find(s => 
              s.timeSlot === 'AM' && s.clientIds.includes(client.id.toString())
            )?.sessionId }
          : { type: 'unassigned' },
        location: client.locations[0] || 'Unknown'
      });
    }
    
    // Check PM availability
    if (hasPM) {
      const pmAssigned = sessions.some(s => 
        s.timeSlot === 'PM' && s.clientIds.includes(client.id.toString())
      );
      
      clientStates.push({
        clientId: client.id.toString(),
        clientName: client.name,
        shift: 'PM',
        position: pmAssigned 
          ? { type: 'assigned', sessionId: sessions.find(s => 
              s.timeSlot === 'PM' && s.clientIds.includes(client.id.toString())
            )?.sessionId }
          : { type: 'unassigned' },
        location: client.locations[0] || 'Unknown'
      });
    }
  }

  const initialState = {
    date,
    staffPositions,
    sessions,
    clientStates,
    auditLog: []
  };

  console.log('Built initial state:');
  console.log('- Staff positions:', staffPositions.length);
  console.log('- Sessions:', sessions.length);
  console.log('- Client states:', clientStates.length);
  
  if (staffPositions.length > 0) {
    console.log('Sample staff position:', staffPositions[0]);
  }
  if (sessions.length > 0) {
    console.log('Sample session:', sessions[0]);
  }
  if (clientStates.length > 0) {
    console.log('Sample client state:', clientStates[0]);
  }

  // Save to database
  await prisma.dailyScheduleState.create({
    data: {
      date: new Date(date),
      staffPositions: initialState.staffPositions,
      sessions: initialState.sessions,
      clientStates: initialState.clientStates,
      auditLog: []
    }
  });

  return initialState;
}

// Helper function to apply overrides to the state
function applyOverrideToState(sessions, staffPositions, clientStates, override) {
  // This would contain the logic to modify sessions based on overrides
  // For now, keeping it simple as the new system will replace overrides
  console.log('Applying override:', override.type, override);
}

// Helper function to filter state by location
function filterStateByLocation(state, location) {
  return {
    ...state,
    staffPositions: state.staffPositions.filter(sp => 
      sp.location === location || sp.location === 'All'
    ),
    sessions: state.sessions.filter(s => s.location === location),
    clientStates: state.clientStates.filter(cs => cs.location === location)
  };
}

// Helper function to add audit log entry
async function addAuditEntry(date, action, details, userId = 'system') {
  const dailyState = await prisma.dailyScheduleState.findUnique({
    where: { date: new Date(date) }
  });

  if (!dailyState) return;

  const auditLog = dailyState.auditLog || [];
  auditLog.push({
    timestamp: new Date(),
    action,
    details,
    userId
  });

  await prisma.dailyScheduleState.update({
    where: { date: new Date(date) },
    data: { auditLog }
  });
}

// Action handler: Assign staff to a time slot or session
async function handleAssignStaff(req, res, date) {
  try {
    const { staffId, targetSessionId, timeSlot, location } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      dailyState = await buildInitialDailyState(date, location);
    }

    let staffPositions = dailyState.staffPositions || [];
    let sessions = dailyState.sessions || [];
    const auditLog = dailyState.auditLog || [];

    // Find the staff position
    const staffPosIndex = staffPositions.findIndex(sp => 
      sp.staffId === staffId && sp.shift === timeSlot
    );

    if (staffPosIndex === -1) {
      return res.status(404).json({ error: 'Staff position not found' });
    }

    const staffPos = staffPositions[staffPosIndex];
    const previousPosition = { ...staffPos.position };

    // If assigning to existing session
    if (targetSessionId) {
      const sessionIndex = sessions.findIndex(s => s.sessionId === targetSessionId);
      if (sessionIndex === -1) {
        return res.status(404).json({ error: 'Target session not found' });
      }

      const session = sessions[sessionIndex];
      
      // Check staff limit (max 3)
      if (session.staffIds.length >= 3) {
        return res.status(400).json({ error: 'Session already has maximum staff (3)' });
      }

      // Remove staff from previous session if assigned
      if (staffPos.position.type === 'assigned' && staffPos.position.sessionId) {
        const prevSessionIndex = sessions.findIndex(s => s.sessionId === staffPos.position.sessionId);
        if (prevSessionIndex !== -1) {
          sessions[prevSessionIndex].staffIds = sessions[prevSessionIndex].staffIds.filter(id => id !== staffId);
          sessions[prevSessionIndex].lastModified = new Date();
          
          // If session has no staff, mark as needs_staff
          if (sessions[prevSessionIndex].staffIds.length === 0) {
            sessions[prevSessionIndex].status = 'needs_staff';
          }
        }
      }

      // Add staff to new session
      if (!session.staffIds.includes(staffId)) {
        session.staffIds.push(staffId);
        session.lastModified = new Date();
        session.status = 'active';
        
        // Update session type if needed
        if (session.staffIds.length > 1) {
          session.sessionType = 'multi_staff';
        }
      }

      // Update staff position
      staffPos.position = { type: 'assigned', sessionId: targetSessionId };

    } else {
      // Creating new session with just the staff
      const newSessionId = `session-${Date.now()}-${staffId}`;
      const newSession = {
        sessionId: newSessionId,
        clientIds: [],
        staffIds: [staffId],
        timeSlot: timeSlot,
        location: staffPos.location,
        status: 'needs_clients',
        sessionType: 'individual',
        originalState: {
          clientIds: [],
          staffIds: [],
          wasFromBaseSchedule: false
        },
        reviewed: false,
        lastModified: new Date()
      };

      sessions.push(newSession);
      staffPos.position = { type: 'assigned', sessionId: newSessionId };
    }

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'assign-staff',
      details: {
        staffId,
        staffName: staffPos.staffName,
        previousPosition,
        newPosition: staffPos.position,
        targetSessionId
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        staffPositions,
        sessions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Staff assigned successfully',
      staffPosition: staffPos,
      sessions
    });

  } catch (error) {
    console.error('Error assigning staff:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Assign client to a session
async function handleAssignClient(req, res, date) {
  try {
    const { clientId, targetSessionId, timeSlot } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let clientStates = dailyState.clientStates || [];
    let sessions = dailyState.sessions || [];
    const auditLog = dailyState.auditLog || [];

    // Find the client state
    const clientStateIndex = clientStates.findIndex(cs => 
      cs.clientId === clientId && cs.shift === timeSlot
    );

    if (clientStateIndex === -1) {
      return res.status(404).json({ error: 'Client state not found' });
    }

    const clientState = clientStates[clientStateIndex];
    const previousPosition = { ...clientState.position };

    // Find target session
    const sessionIndex = sessions.findIndex(s => s.sessionId === targetSessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Target session not found' });
    }

    const session = sessions[sessionIndex];

    // Check client limit (max 8 for group sessions)
    if (session.sessionType === 'group' && session.clientIds.length >= 8) {
      return res.status(400).json({ error: 'Group session already has maximum clients (8)' });
    }

    // Check session type compatibility
    if (session.clientIds.length > 0 && session.staffIds.length > 1) {
      return res.status(400).json({ error: 'Cannot add multiple clients to multi-staff session' });
    }

    // Remove client from previous session if assigned
    if (clientState.position.type === 'assigned' && clientState.position.sessionId) {
      const prevSessionIndex = sessions.findIndex(s => s.sessionId === clientState.position.sessionId);
      if (prevSessionIndex !== -1) {
        sessions[prevSessionIndex].clientIds = sessions[prevSessionIndex].clientIds.filter(id => id !== clientId);
        sessions[prevSessionIndex].lastModified = new Date();
      }
    }

    // Add client to new session
    if (!session.clientIds.includes(clientId)) {
      session.clientIds.push(clientId);
      session.lastModified = new Date();
      
      // Update session type if needed
      if (session.clientIds.length > 1 && session.staffIds.length === 1) {
        session.sessionType = 'group';
      }
    }

    // Update client position
    clientState.position = { type: 'assigned', sessionId: targetSessionId };

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'assign-client',
      details: {
        clientId,
        clientName: clientState.clientName,
        previousPosition,
        newPosition: clientState.position,
        targetSessionId
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        clientStates,
        sessions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Client assigned successfully',
      clientState,
      session
    });

  } catch (error) {
    console.error('Error assigning client:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Create new session
async function handleCreateSession(req, res, date) {
  try {
    const { timeSlot, location } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      dailyState = await buildInitialDailyState(date, location);
    }

    let sessions = dailyState.sessions || [];
    const auditLog = dailyState.auditLog || [];

    const newSessionId = `session-${Date.now()}`;
    const newSession = {
      sessionId: newSessionId,
      clientIds: [],
      staffIds: [],
      timeSlot: timeSlot,
      location: location || 'Unknown',
      status: 'needs_staff',
      sessionType: 'individual',
      originalState: {
        clientIds: [],
        staffIds: [],
        wasFromBaseSchedule: false
      },
      reviewed: false,
      lastModified: new Date()
    };

    sessions.push(newSession);

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'create-session',
      details: {
        sessionId: newSessionId,
        timeSlot,
        location
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Session created successfully',
      session: newSession
    });

  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Add staff to existing session
async function handleAddStaffToSession(req, res, date) {
  try {
    const { sessionId, staffId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    let staffPositions = dailyState.staffPositions || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Check staff limit
    if (session.staffIds.length >= 3) {
      return res.status(400).json({ error: 'Session already has maximum staff (3)' });
    }

    // Check session type compatibility
    if (session.clientIds.length > 1) {
      return res.status(400).json({ error: 'Cannot add multiple staff to group session' });
    }

    // Find staff position
    const staffPosIndex = staffPositions.findIndex(sp => 
      sp.staffId === staffId && sp.shift === session.timeSlot
    );

    if (staffPosIndex === -1) {
      return res.status(404).json({ error: 'Staff not available for this time slot' });
    }

    const staffPos = staffPositions[staffPosIndex];

    // Remove from previous session if assigned
    if (staffPos.position.type === 'assigned' && staffPos.position.sessionId) {
      const prevSessionIndex = sessions.findIndex(s => s.sessionId === staffPos.position.sessionId);
      if (prevSessionIndex !== -1) {
        sessions[prevSessionIndex].staffIds = sessions[prevSessionIndex].staffIds.filter(id => id !== staffId);
        if (sessions[prevSessionIndex].staffIds.length === 0) {
          sessions[prevSessionIndex].status = 'needs_staff';
        }
      }
    }

    // Add staff to session
    if (!session.staffIds.includes(staffId)) {
      session.staffIds.push(staffId);
      session.lastModified = new Date();
      session.sessionType = session.staffIds.length > 1 ? 'multi_staff' : 'individual';
    }

    // Update staff position
    staffPos.position = { type: 'assigned', sessionId };

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'add-staff-to-session',
      details: {
        sessionId,
        staffId,
        staffName: staffPos.staffName
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        staffPositions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Staff added to session',
      session
    });

  } catch (error) {
    console.error('Error adding staff to session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Remove staff from session
async function handleRemoveStaffFromSession(req, res, date) {
  try {
    const { sessionId, staffId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    let staffPositions = dailyState.staffPositions || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Remove staff from session
    session.staffIds = session.staffIds.filter(id => id !== staffId);
    session.lastModified = new Date();

    // Update session status
    if (session.staffIds.length === 0) {
      session.status = 'needs_staff';
    }

    // Update session type
    if (session.staffIds.length <= 1) {
      session.sessionType = 'individual';
    }

    // Update staff position
    const staffPosIndex = staffPositions.findIndex(sp => 
      sp.staffId === staffId && sp.shift === session.timeSlot
    );

    if (staffPosIndex !== -1) {
      staffPositions[staffPosIndex].position = { type: 'available' };
    }

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'remove-staff-from-session',
      details: {
        sessionId,
        staffId
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        staffPositions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Staff removed from session',
      session
    });

  } catch (error) {
    console.error('Error removing staff from session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Add client to existing session
async function handleAddClientToSession(req, res, date) {
  try {
    const { sessionId, clientId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    let clientStates = dailyState.clientStates || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Check compatibility
    if (session.staffIds.length > 1 && session.clientIds.length > 0) {
      return res.status(400).json({ error: 'Multi-staff sessions can only have one client' });
    }

    if (session.clientIds.length >= 8) {
      return res.status(400).json({ error: 'Session already has maximum clients (8)' });
    }

    // Find client state
    const clientStateIndex = clientStates.findIndex(cs => 
      cs.clientId === clientId && cs.shift === session.timeSlot
    );

    if (clientStateIndex === -1) {
      return res.status(404).json({ error: 'Client not available for this time slot' });
    }

    const clientState = clientStates[clientStateIndex];

    // Remove from previous session if assigned
    if (clientState.position.type === 'assigned' && clientState.position.sessionId) {
      const prevSessionIndex = sessions.findIndex(s => s.sessionId === clientState.position.sessionId);
      if (prevSessionIndex !== -1) {
        sessions[prevSessionIndex].clientIds = sessions[prevSessionIndex].clientIds.filter(id => id !== clientId);
      }
    }

    // Add client to session
    if (!session.clientIds.includes(clientId)) {
      session.clientIds.push(clientId);
      session.lastModified = new Date();
      
      if (session.clientIds.length > 1 && session.staffIds.length === 1) {
        session.sessionType = 'group';
      }
    }

    // Update client position
    clientState.position = { type: 'assigned', sessionId };

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'add-client-to-session',
      details: {
        sessionId,
        clientId,
        clientName: clientState.clientName
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        clientStates,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Client added to session',
      session
    });

  } catch (error) {
    console.error('Error adding client to session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Remove client from session
async function handleRemoveClientFromSession(req, res, date) {
  try {
    const { sessionId, clientId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    let clientStates = dailyState.clientStates || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Remove client from session
    session.clientIds = session.clientIds.filter(id => id !== clientId);
    session.lastModified = new Date();

    // Update session type
    if (session.clientIds.length <= 1) {
      session.sessionType = 'individual';
    }

    // Update client position
    const clientStateIndex = clientStates.findIndex(cs => 
      cs.clientId === clientId && cs.shift === session.timeSlot
    );

    if (clientStateIndex !== -1) {
      clientStates[clientStateIndex].position = { type: 'unassigned' };
    }

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'remove-client-from-session',
      details: {
        sessionId,
        clientId
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        clientStates,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Client removed from session',
      session
    });

  } catch (error) {
    console.error('Error removing client from session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Cancel session
async function handleCancelSession(req, res, date) {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    let staffPositions = dailyState.staffPositions || [];
    let clientStates = dailyState.clientStates || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Update session status
    session.status = 'cancelled';
    session.lastModified = new Date();

    // Update all staff positions
    for (const staffId of session.staffIds) {
      const staffPosIndex = staffPositions.findIndex(sp => 
        sp.staffId === staffId && sp.shift === session.timeSlot
      );
      if (staffPosIndex !== -1) {
        staffPositions[staffPosIndex].position = { type: 'available' };
      }
    }

    // Update all client states
    for (const clientId of session.clientIds) {
      const clientStateIndex = clientStates.findIndex(cs => 
        cs.clientId === clientId && cs.shift === session.timeSlot
      );
      if (clientStateIndex !== -1) {
        clientStates[clientStateIndex].position = { type: 'cancelled' };
      }
    }

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'cancel-session',
      details: {
        sessionId,
        staffIds: session.staffIds,
        clientIds: session.clientIds
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        staffPositions,
        clientStates,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Session cancelled',
      session
    });

  } catch (error) {
    console.error('Error cancelling session:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Mark staff as callout
async function handleMarkCallout(req, res, date) {
  try {
    const { staffId, shift, reason } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let staffPositions = dailyState.staffPositions || [];
    let sessions = dailyState.sessions || [];
    const auditLog = dailyState.auditLog || [];

    // Find staff position
    const staffPosIndex = staffPositions.findIndex(sp => 
      sp.staffId === staffId && sp.shift === shift
    );

    if (staffPosIndex === -1) {
      return res.status(404).json({ error: 'Staff position not found' });
    }

    const staffPos = staffPositions[staffPosIndex];

    // If staff was assigned, update session
    if (staffPos.position.type === 'assigned' && staffPos.position.sessionId) {
      const sessionIndex = sessions.findIndex(s => s.sessionId === staffPos.position.sessionId);
      if (sessionIndex !== -1) {
        const session = sessions[sessionIndex];
        
        // Don't remove staff from session, just mark their position as callout
        // This preserves the original assignment visually
        session.status = session.staffIds.length > 1 ? 'active' : 'needs_staff';
        session.lastModified = new Date();
      }
    }

    // Update staff position to callout
    staffPos.position = { 
      type: 'callout', 
      sessionId: staffPos.position.sessionId, // Preserve original session assignment
      calloutReason: reason 
    };

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'mark-callout',
      details: {
        staffId,
        staffName: staffPos.staffName,
        shift,
        reason,
        originalSessionId: staffPos.position.sessionId
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        staffPositions,
        sessions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Staff marked as callout',
      staffPosition: staffPos
    });

  } catch (error) {
    console.error('Error marking callout:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Change staff location for the day
async function handleChangeStaffLocation(req, res, date) {
  try {
    const { staffId, shift, newLocation } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let staffPositions = dailyState.staffPositions || [];
    const auditLog = dailyState.auditLog || [];

    // Find staff position
    const staffPosIndex = staffPositions.findIndex(sp => 
      sp.staffId === staffId && sp.shift === shift
    );

    if (staffPosIndex === -1) {
      return res.status(404).json({ error: 'Staff position not found' });
    }

    const staffPos = staffPositions[staffPosIndex];
    const previousLocation = staffPos.location;

    // Update location
    staffPos.location = newLocation;

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'change-staff-location',
      details: {
        staffId,
        staffName: staffPos.staffName,
        shift,
        previousLocation,
        newLocation
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        staffPositions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Staff location updated',
      staffPosition: staffPos
    });

  } catch (error) {
    console.error('Error changing staff location:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Add staff slot to session (for multi-staff)
async function handleAddStaffSlot(req, res, date) {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Check constraints
    if (session.staffIds.length >= 3) {
      return res.status(400).json({ error: 'Session already has maximum staff slots (3)' });
    }

    if (session.clientIds.length > 1) {
      return res.status(400).json({ error: 'Cannot add staff slot to group session' });
    }

    // Session is ready for additional staff
    session.sessionType = 'multi_staff';
    session.lastModified = new Date();

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'add-staff-slot',
      details: {
        sessionId,
        currentStaffCount: session.staffIds.length
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Staff slot added to session',
      session
    });

  } catch (error) {
    console.error('Error adding staff slot:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Action handler: Add group fields to session
async function handleAddToGroup(req, res, date) {
  try {
    const { sessionId } = req.body;
    const userId = req.user?.id || 'system';

    let dailyState = await prisma.dailyScheduleState.findUnique({
      where: { date: new Date(date) }
    });

    if (!dailyState) {
      return res.status(404).json({ error: 'Daily schedule not found' });
    }

    let sessions = dailyState.sessions || [];
    const auditLog = dailyState.auditLog || [];

    // Find the session
    const sessionIndex = sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessions[sessionIndex];

    // Check constraints
    if (session.staffIds.length > 1) {
      return res.status(400).json({ error: 'Cannot convert multi-staff session to group' });
    }

    if (session.clientIds.length >= 8) {
      return res.status(400).json({ error: 'Session already has maximum clients (8)' });
    }

    // Update session type
    session.sessionType = 'group';
    session.lastModified = new Date();

    // Add audit entry
    auditLog.push({
      timestamp: new Date(),
      action: 'add-to-group',
      details: {
        sessionId,
        currentClientCount: session.clientIds.length
      },
      userId
    });

    // Update database
    await prisma.dailyScheduleState.update({
      where: { date: new Date(date) },
      data: {
        sessions,
        auditLog,
        updatedAt: new Date()
      }
    });

    return res.json({ 
      message: 'Session converted to group',
      session
    });

  } catch (error) {
    console.error('Error adding to group:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Placeholder handlers for move operations (not used in new system)
async function handleMoveStaff(req, res, date) {
  return res.status(400).json({ error: 'Use assign-staff action instead' });
}

async function handleMoveClient(req, res, date) {
  return res.status(400).json({ error: 'Use assign-client action instead' });
}

// DEBUG: Simple endpoint to check if we can find assignments
router.get('/debug', async (req, res) => {
  try {
    const { date } = req.query;
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    
    const mainVersion = await prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      return res.json({ error: 'No main schedule version found' });
    }
    
    const assignments = await prisma.assignment.findMany({
      where: {
        versionId: mainVersion.id,
        day: dayOfWeek
      },
      include: {
        staff: true,
        client: true
      }
    });
    
    const allStaff = await prisma.staff.findMany({
      where: { active: true }
    });
    
    const allClients = await prisma.client.findMany();
    
    return res.json({
      debug: {
        date,
        dayOfWeek,
        mainVersionId: mainVersion.id,
        assignmentsFound: assignments.length,
        assignments: assignments.slice(0, 3), // First 3 assignments
        totalStaff: allStaff.length,
        totalClients: allClients.length
      }
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;