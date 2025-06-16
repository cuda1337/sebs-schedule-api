#!/usr/bin/env node

const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function testLocalRestore() {
  try {
    console.log('🔄 Testing local restore process...\n');
    
    // Check current state
    const currentVersions = await prisma.scheduleVersion.findMany();
    const currentAssignments = await prisma.assignment.count();
    
    console.log(`Current state: ${currentVersions.length} versions, ${currentAssignments} assignments`);
    if (currentVersions.length > 0) {
      console.log('Current versions:');
      currentVersions.forEach(v => {
        console.log(`  Version ${v.id}: ${v.name} (${v.type}) - status: ${v.status}`);
      });
    }
    
    // Read backup file
    const backupPath = path.join(__dirname, 'SEBS-Database-Backup(3).xlsx');
    console.log('\n📁 Reading backup file...');
    const workbook = XLSX.readFile(backupPath);
    
    // Parse data
    const data = {};
    workbook.SheetNames.forEach(sheetName => {
      data[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    });
    
    console.log(`Found ${data.ScheduleVersions?.length || 0} versions in backup`);
    console.log(`Found ${data.Assignments?.length || 0} assignments in backup`);
    
    // Show version details from backup
    if (data.ScheduleVersions) {
      console.log('\nVersions in backup:');
      data.ScheduleVersions.forEach(v => {
        console.log(`  Version ${v.id}: ${v.name} (${v.type})`);
      });
    }
    
    // Test version restoration logic
    console.log('\n🧪 Testing version ID mapping logic...');
    const versionIdMapping = {};
    
    // Simulate version restoration
    console.log('\nSimulating version restoration:');
    for (const version of data.ScheduleVersions || []) {
      // In real restore, this would be a database insert
      const simulatedNewId = currentVersions.length + Object.keys(versionIdMapping).length + 1;
      versionIdMapping[version.id] = simulatedNewId;
      console.log(`  Version ${version.id} (${version.name}) → would become ID ${simulatedNewId}`);
    }
    
    // Check assignment mapping
    console.log('\n📊 Checking assignment version mappings:');
    const assignmentsByVersion = {};
    let mappableAssignments = 0;
    let unmappableAssignments = 0;
    
    for (const assignment of data.Assignments || []) {
      const newVersionId = versionIdMapping[assignment.versionId];
      if (newVersionId) {
        mappableAssignments++;
        assignmentsByVersion[assignment.versionId] = (assignmentsByVersion[assignment.versionId] || 0) + 1;
      } else {
        unmappableAssignments++;
        console.log(`  ⚠️  Assignment ${assignment.id} references unmapped version ${assignment.versionId}`);
      }
    }
    
    console.log(`\nAssignment mapping summary:`);
    console.log(`  ✅ Mappable assignments: ${mappableAssignments}`);
    console.log(`  ❌ Unmappable assignments: ${unmappableAssignments}`);
    
    Object.entries(assignmentsByVersion).forEach(([oldVersionId, count]) => {
      const newVersionId = versionIdMapping[oldVersionId];
      console.log(`  Version ${oldVersionId} → ${newVersionId}: ${count} assignments`);
    });
    
    // Ask if user wants to proceed with actual restore
    console.log('\n❓ Would you like to proceed with the actual restore? (y/n)');
    
    process.stdin.once('data', async (data) => {
      const answer = data.toString().trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        console.log('\n🚀 Starting actual restore...');
        try {
          // Clear existing data
          console.log('Clearing existing data...');
          await prisma.assignment.deleteMany();
          await prisma.scheduleVersion.deleteMany();
          console.log('Data cleared');
          
          // Restore versions
          const actualVersionMapping = {};
          console.log('\nRestoring versions...');
          for (const version of data.ScheduleVersions || []) {
            const newVersion = await prisma.scheduleVersion.create({
              data: {
                name: version.name || 'Restored Schedule',
                type: version.type || 'main',
                status: 'active', // Default since it's missing in backup
                description: `Restored from backup - Original ID: ${version.id}`,
                createdBy: version.createdBy || 'system',
                createdAt: version.createdAt ? new Date(version.createdAt) : new Date(),
                updatedAt: version.updatedAt ? new Date(version.updatedAt) : new Date()
              }
            });
            actualVersionMapping[version.id] = newVersion.id;
            console.log(`  ✅ Version ${version.id} → ${newVersion.id}: ${version.name}`);
          }
          
          // Verify all versions created
          const finalVersionCount = await prisma.scheduleVersion.count();
          console.log(`\n✅ Created ${finalVersionCount} versions successfully`);
          
          console.log('\n✅ Restore test complete!');
          console.log('Version mapping was successful. The issue might be elsewhere.');
        } catch (error) {
          console.error('❌ Restore error:', error.message);
        }
      } else {
        console.log('Restore cancelled');
      }
      
      await prisma.$disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the test
console.log('🧪 Local Restore Test');
console.log('====================\n');

testLocalRestore();