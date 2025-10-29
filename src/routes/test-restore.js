const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Simple test restore without transaction
router.post('/simple-restore', async (req, res) => {
  try {
    console.log('Starting simple restore test...');
    
    // Step 1: Check if we have staff and clients
    const staffCount = await prisma.staff.count();
    const clientCount = await prisma.client.count();
    const versionCount = await prisma.scheduleVersion.count();
    
    console.log(`Current data: ${staffCount} staff, ${clientCount} clients, ${versionCount} versions`);
    
    if (staffCount === 0 || clientCount === 0) {
      return res.status(400).json({ error: 'Need staff and clients before creating assignments' });
    }
    
    // Step 2: Get the main schedule version
    const mainVersion = await prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      return res.status(400).json({ error: 'No main schedule version found' });
    }
    
    console.log(`Using main version: ${mainVersion.id} (${mainVersion.name})`);
    
    // Step 3: Clear existing assignments
    // First delete DailyAssignmentState to avoid foreign key constraint violation
    await prisma.dailyAssignmentState.deleteMany({});
    const deletedCount = await prisma.assignment.deleteMany({});
    console.log(`Deleted ${deletedCount.count} existing assignments`);
    
    // Step 4: Create a few test assignments manually
    const firstStaff = await prisma.staff.findFirst();
    const firstClient = await prisma.client.findFirst();
    const secondStaff = await prisma.staff.findMany({ skip: 1, take: 1 });
    const secondClient = await prisma.client.findMany({ skip: 1, take: 1 });
    
    if (!firstStaff || !firstClient) {
      return res.status(400).json({ error: 'Need at least one staff and one client' });
    }
    
    console.log(`Creating test assignments with staff ${firstStaff.id} and client ${firstClient.id}`);
    
    // Create test assignments one by one
    const testAssignments = [];
    
    try {
      const assignment1 = await prisma.assignment.create({
        data: {
          staffId: firstStaff.id,
          clientId: firstClient.id,
          day: 'Monday',
          block: 'AM',
          versionId: mainVersion.id,
          isGroup: false
        }
      });
      testAssignments.push(assignment1);
      console.log(`Created assignment 1: ${assignment1.id}`);
      
      if (secondStaff.length > 0 && secondClient.length > 0) {
        const assignment2 = await prisma.assignment.create({
          data: {
            staffId: secondStaff[0].id,
            clientId: secondClient[0].id,
            day: 'Monday',
            block: 'PM',
            versionId: mainVersion.id,
            isGroup: false
          }
        });
        testAssignments.push(assignment2);
        console.log(`Created assignment 2: ${assignment2.id}`);
      }
      
    } catch (error) {
      console.error('Error creating test assignments:', error);
      return res.status(500).json({ 
        error: 'Failed to create test assignments',
        details: error.message 
      });
    }
    
    // Step 5: Verify assignments were created
    const finalCount = await prisma.assignment.count();
    console.log(`Final assignment count: ${finalCount}`);
    
    res.json({
      success: true,
      message: `Created ${testAssignments.length} test assignments`,
      assignments: testAssignments.map(a => ({
        id: a.id,
        staffId: a.staffId,
        clientId: a.clientId,
        day: a.day,
        block: a.block,
        versionId: a.versionId
      })),
      finalCount
    });
    
  } catch (error) {
    console.error('Simple restore test failed:', error);
    res.status(500).json({ 
      error: 'Simple restore test failed',
      details: error.message 
    });
  }
});

module.exports = router;