import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/schedule-groups
router.get('/', async (req: Request, res: Response) => {
  try {
    return await handleGet(req, res, req.query);
  } catch (error) {
    console.error('Schedule Groups API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/schedule-groups
router.post('/', async (req: Request, res: Response) => {
  try {
    return await handlePost(req, res);
  } catch (error) {
    console.error('Schedule Groups API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PUT /api/schedule-groups/:groupId
router.put('/:groupId', async (req: Request, res: Response) => {
  try {
    return await handlePut(req, res, req.params);
  } catch (error) {
    console.error('Schedule Groups API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /api/schedule-groups/:groupId
router.delete('/:groupId', async (req: Request, res: Response) => {
  try {
    return await handleDelete(req, res, req.params);
  } catch (error) {
    console.error('Schedule Groups API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

async function handleGet(req: Request, res: Response, query: any) {
  const { date, timeBlock, action } = query;

  // Get groups by date
  if (date && !timeBlock && !action) {
    const groups = await prisma.scheduleGroup.findMany({
      where: { date: new Date(date) },
      include: {
        members: true
      },
      orderBy: [
        { timeBlock: 'asc' },
        { name: 'asc' }
      ]
    });
    return res.json(groups);
  }

  // Get groups by date and time block
  if (date && timeBlock && !action) {
    const groups = await prisma.scheduleGroup.findMany({
      where: { 
        date: new Date(date),
        timeBlock: timeBlock 
      },
      include: {
        members: true
      },
      orderBy: { name: 'asc' }
    });
    return res.json(groups);
  }

  // Get available staff for group creation
  if (action === 'available-staff' && date && timeBlock) {
    const { location } = query;
    
    // Get all staff
    const allStaff = await prisma.staff.findMany({
      where: { active: true }
    });

    // Get staff already assigned to groups on this date/timeBlock
    const groupAssignments = await prisma.scheduleGroup.findMany({
      where: {
        date: new Date(date),
        timeBlock: timeBlock
      },
      select: { staffId: true }
    });

    const assignedStaffIds = new Set(groupAssignments.map(g => g.staffId));

    // Filter available staff
    const availableStaff = allStaff.filter(staff => {
      // Not already assigned to a group
      if (assignedStaffIds.has(staff.id)) return false;
      
      // Check availability for this day/time
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
      const availabilityKey = `${dayOfWeek}-${timeBlock}`;
      if (!staff.availability || !staff.availability[availabilityKey as keyof typeof staff.availability]) return false;
      
      // Check location if specified
      if (location && location !== 'all') {
        if (!staff.locations || !staff.locations.includes(location)) return false;
      }
      
      return true;
    });

    return res.json(availableStaff);
  }

  // Get group options for context menu
  if (action === 'options' && date && timeBlock) {
    const groups = await prisma.scheduleGroup.findMany({
      where: { 
        date: new Date(date),
        timeBlock: timeBlock 
      },
      include: {
        members: true
      }
    });

    // Get staff names
    const staffIds = [...new Set(groups.map(g => g.staffId))];
    const staffMap = new Map();
    if (staffIds.length > 0) {
      const staff = await prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { id: true, name: true }
      });
      staff.forEach(s => staffMap.set(s.id, s.name));
    }

    const groupOptions = groups.map(group => ({
      id: group.id,
      name: group.name,
      currentSize: group.members.length,
      maxSize: group.maxClients,
      staffName: staffMap.get(group.staffId) || 'Unknown'
    }));

    return res.json(groupOptions);
  }

  return res.status(400).json({ error: 'Invalid query parameters' });
}

async function handlePost(req: Request, res: Response) {
  const { body } = req;
  const { groupId } = req.query;

  // Add client to existing group
  if (groupId) {
    const { clientId, originalStaffId, originalSessionId } = body;

    // Check if group exists and has space
    const group = await prisma.scheduleGroup.findUnique({
      where: { id: parseInt(groupId as string) },
      include: { members: true }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.members.length >= group.maxClients) {
      return res.status(400).json({ error: 'Group is full' });
    }

    // Check if client is already in this group
    const existingMember = group.members.find(m => m.clientId === clientId);
    if (existingMember) {
      return res.status(400).json({ error: 'Client is already in this group' });
    }

    const member = await prisma.scheduleGroupMember.create({
      data: {
        groupId: parseInt(groupId as string),
        clientId,
        originalStaffId,
        originalSessionId
      }
    });

    return res.json(member);
  }

  // Create new group
  const { 
    name, 
    timeBlock, 
    date, 
    staffId, 
    location, 
    maxClients, 
    initialClientId,
    originalStaffId,
    originalSessionId 
  } = body;

  // Validate required fields
  if (!name || !timeBlock || !date || !staffId || !location || !initialClientId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Check if staff is already assigned to a group at this time
  const existingGroup = await prisma.scheduleGroup.findFirst({
    where: {
      date: new Date(date),
      timeBlock: timeBlock,
      staffId: staffId
    }
  });

  if (existingGroup) {
    return res.status(400).json({ 
      error: 'Staff member is already assigned to a group at this time' 
    });
  }

  // Create group with initial client
  const result = await prisma.$transaction(async (tx) => {
    // Create the group
    const group = await tx.scheduleGroup.create({
      data: {
        name,
        timeBlock,
        date: new Date(date),
        staffId,
        location,
        maxClients: maxClients || 6,
        createdBy: 'user'
      }
    });

    // Add initial client
    await tx.scheduleGroupMember.create({
      data: {
        groupId: group.id,
        clientId: initialClientId,
        originalStaffId,
        originalSessionId
      }
    });

    // Return group with members
    return await tx.scheduleGroup.findUnique({
      where: { id: group.id },
      include: { members: true }
    });
  });

  return res.json(result);
}

async function handlePut(req: Request, res: Response, params: any) {
  const { groupId } = params;
  const { body } = req;

  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }

  const group = await prisma.scheduleGroup.update({
    where: { id: parseInt(groupId) },
    data: body,
    include: { members: true }
  });

  return res.json(group);
}

async function handleDelete(req: Request, res: Response, params: any) {
  const { groupId } = params;
  const { clientId } = req.query;

  if (!groupId) {
    return res.status(400).json({ error: 'Group ID is required' });
  }

  // Remove client from group
  if (clientId) {
    await prisma.scheduleGroupMember.deleteMany({
      where: {
        groupId: parseInt(groupId),
        clientId: parseInt(clientId as string)
      }
    });
    return res.json({ success: true });
  }

  // Delete entire group
  await prisma.scheduleGroup.delete({
    where: { id: parseInt(groupId) }
  });

  return res.json({ success: true });
}

export default router;