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
        clientStates: dailyState.clientStates || []
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
        clientStates
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
      case 'change-session-location':
        return await handleChangeSessionLocation(req, res, date);
      case 'disband-group-session':
        return await handleDisbandGroupSession(req, res, date);
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
      clientStates: []
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

  // Get all staff and clients
  const allStaff = await prisma.staff.findMany({
    where: { active: true }
  });
  const allClients = await prisma.client.findMany();

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
        reviewed: false,
        lastModified: new Date(),
        changeType: undefined
      });
    }
    
    sessionMap.get(sessionKey).clientIds.push(assignment.clientId.toString());
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
    const dayAvailability = staffAvailability[dayOfWeek] || {};
    
    // AM Position
    if (dayAvailability.AM) {
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
        location: staff.locations[0] || 'Unknown'
      });
    }

    // PM Position
    if (dayAvailability.PM) {
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
        location: staff.locations[0] || 'Unknown'
      });
    }
  }

  // Build client states
  for (const client of allClients) {
    const clientAvailability = client.availability || {};
    const dayAvailability = clientAvailability[dayOfWeek];
    
    if (dayAvailability && (dayAvailability.AM || dayAvailability.PM)) {
      const timeSlot = dayAvailability.AM ? 'AM' : 'PM';
      const assigned = sessions.some(s => s.clientIds.includes(client.id.toString()));
      
      clientStates.push({
        clientId: client.id.toString(),
        clientName: client.name,
        position: assigned 
          ? { type: 'assigned', sessionId: sessions.find(s => 
              s.clientIds.includes(client.id.toString())
            )?.sessionId }
          : { type: 'unassigned' },
        scheduledTimeSlot: timeSlot,
        location: client.locations[0] || 'Unknown'
      });
    }
  }

  const initialState = {
    date,
    staffPositions,
    sessions,
    clientStates
  };

  // Save to database
  await prisma.dailyScheduleState.create({
    data: {
      date: new Date(date),
      staffPositions: initialState.staffPositions,
      sessions: initialState.sessions,
      clientStates: initialState.clientStates
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

// Action handlers (placeholder implementations)
async function handleMoveStaff(req, res, date) {
  const { staffId, fromPosition, toPosition } = req.body;
  return res.json({ message: 'Staff moved successfully' });
}

async function handleMoveClient(req, res, date) {
  const { clientId, fromPosition, toPosition } = req.body;
  return res.json({ message: 'Client moved successfully' });
}

async function handleCreateSession(req, res, date) {
  const { timeSlot, location } = req.body;
  return res.json({ message: 'Session created successfully' });
}

async function handleAddStaffToSession(req, res, date) {
  return res.json({ message: 'Staff added to session' });
}

async function handleRemoveStaffFromSession(req, res, date) {
  return res.json({ message: 'Staff removed from session' });
}

async function handleAddClientToSession(req, res, date) {
  return res.json({ message: 'Client added to session' });
}

async function handleRemoveClientFromSession(req, res, date) {
  return res.json({ message: 'Client removed from session' });
}

async function handleChangeSessionLocation(req, res, date) {
  return res.json({ message: 'Session location changed' });
}

async function handleDisbandGroupSession(req, res, date) {
  return res.json({ message: 'Group session disbanded' });
}

module.exports = router;