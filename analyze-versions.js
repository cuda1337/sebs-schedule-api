const XLSX = require('xlsx');
const path = require('path');

// Path to the backup file
const backupPath = path.join(__dirname, 'SEBS-Database-Backup(3).xlsx');

console.log('Analyzing schedule versions in backup file...\n');

try {
  // Read the Excel file
  const workbook = XLSX.readFile(backupPath);
  
  // Get ScheduleVersions data
  const versionsData = XLSX.utils.sheet_to_json(workbook.Sheets['ScheduleVersions']);
  const assignmentsData = XLSX.utils.sheet_to_json(workbook.Sheets['Assignments']);
  
  console.log('=== SCHEDULE VERSIONS ===');
  console.log(`Total versions in backup: ${versionsData.length}\n`);
  
  // Show all versions
  versionsData.forEach(version => {
    console.log(`Version ${version.id}:`);
    console.log(`  Name: ${version.name}`);
    console.log(`  Type: ${version.type}`);
    console.log(`  Created By: ${version.createdBy}`);
    console.log(`  Created At: ${version.createdAt}`);
    console.log('');
  });
  
  console.log('=== ASSIGNMENT DISTRIBUTION BY VERSION ===');
  
  // Count assignments per version
  const assignmentsByVersion = {};
  assignmentsData.forEach(assignment => {
    const versionId = assignment.versionId;
    if (!assignmentsByVersion[versionId]) {
      assignmentsByVersion[versionId] = {
        count: 0,
        staffIds: new Set(),
        clientIds: new Set(),
        dayBlocks: new Set()
      };
    }
    assignmentsByVersion[versionId].count++;
    assignmentsByVersion[versionId].staffIds.add(assignment.staffId);
    assignmentsByVersion[versionId].clientIds.add(assignment.clientId);
    assignmentsByVersion[versionId].dayBlocks.add(`${assignment.day}-${assignment.block}`);
  });
  
  // Display assignment distribution
  Object.keys(assignmentsByVersion).sort((a, b) => Number(a) - Number(b)).forEach(versionId => {
    const stats = assignmentsByVersion[versionId];
    const versionInfo = versionsData.find(v => v.id == versionId);
    console.log(`\nVersion ${versionId} (${versionInfo ? versionInfo.name : 'MISSING IN BACKUP!'}):`);
    console.log(`  Total Assignments: ${stats.count}`);
    console.log(`  Unique Staff: ${stats.staffIds.size}`);
    console.log(`  Unique Clients: ${stats.clientIds.size}`);
    console.log(`  Day/Block Coverage: ${stats.dayBlocks.size} slots`);
  });
  
  console.log('\n=== POTENTIAL ISSUES ===');
  
  // Check for orphaned assignments
  const versionIdsInAssignments = new Set(assignmentsData.map(a => a.versionId));
  const versionIdsInVersions = new Set(versionsData.map(v => v.id));
  
  const orphanedVersionIds = [...versionIdsInAssignments].filter(id => !versionIdsInVersions.has(id));
  if (orphanedVersionIds.length > 0) {
    console.log(`⚠️  WARNING: Assignments reference version IDs that don't exist in ScheduleVersions: ${orphanedVersionIds.join(', ')}`);
  }
  
  // Check version ID range
  const minVersionId = Math.min(...versionsData.map(v => v.id));
  const maxVersionId = Math.max(...versionsData.map(v => v.id));
  console.log(`\nVersion ID range: ${minVersionId} to ${maxVersionId}`);
  
  if (maxVersionId > versionsData.length) {
    console.log(`⚠️  WARNING: Version IDs are not sequential. This will cause mapping issues during restore!`);
    console.log(`   - Backup has ${versionsData.length} versions but max ID is ${maxVersionId}`);
    console.log(`   - When restored, new IDs will be 1-${versionsData.length}, breaking assignments with higher version IDs`);
  }
  
} catch (error) {
  console.error('Error analyzing backup file:', error);
}