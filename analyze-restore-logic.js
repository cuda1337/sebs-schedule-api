#!/usr/bin/env node

const XLSX = require('xlsx');
const path = require('path');

async function analyzeRestoreLogic() {
  try {
    console.log('🔍 Analyzing Restore Logic Issues\n');
    
    // Read backup file
    const backupPath = path.join(__dirname, 'SEBS-Database-Backup(3).xlsx');
    const workbook = XLSX.readFile(backupPath);
    
    // Parse all sheets
    const data = {};
    workbook.SheetNames.forEach(sheetName => {
      data[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    });
    
    console.log('=== BACKUP CONTENTS ===');
    console.log(`Staff: ${data.Staff?.length || 0} records`);
    console.log(`Clients: ${data.Clients?.length || 0} records`);
    console.log(`Schedule Versions: ${data.ScheduleVersions?.length || 0} records`);
    console.log(`Assignments: ${data.Assignments?.length || 0} records`);
    
    // Analyze version structure
    console.log('\n=== VERSION ANALYSIS ===');
    if (data.ScheduleVersions) {
      data.ScheduleVersions.forEach(v => {
        const assignmentCount = data.Assignments.filter(a => a.versionId === v.id).length;
        console.log(`Version ${v.id}: "${v.name}" (${v.type})`);
        console.log(`  - Created: ${v.createdAt}`);
        console.log(`  - Assignments: ${assignmentCount}`);
        console.log(`  - Has status field: ${v.status ? 'Yes' : 'No'}`);
      });
    }
    
    // Simulate the restore ID mapping
    console.log('\n=== SIMULATED RESTORE MAPPING ===');
    const versionIdMapping = {};
    let newId = 1;
    
    console.log('When database auto-assigns new IDs:');
    data.ScheduleVersions.forEach(v => {
      versionIdMapping[v.id] = newId;
      console.log(`  Old ID ${v.id} → New ID ${newId} (${v.name})`);
      newId++;
    });
    
    // Check assignment mappability
    console.log('\n=== ASSIGNMENT MAPPING CHECK ===');
    let successfulMappings = 0;
    let failedMappings = 0;
    const unmappedVersions = new Set();
    
    data.Assignments.forEach(a => {
      if (versionIdMapping[a.versionId]) {
        successfulMappings++;
      } else {
        failedMappings++;
        unmappedVersions.add(a.versionId);
      }
    });
    
    console.log(`✅ Mappable assignments: ${successfulMappings}`);
    console.log(`❌ Unmappable assignments: ${failedMappings}`);
    
    if (unmappedVersions.size > 0) {
      console.log(`\n⚠️  Assignments reference these version IDs that aren't in ScheduleVersions:`);
      console.log(`   ${[...unmappedVersions].join(', ')}`);
    }
    
    // Identify the specific issue
    console.log('\n=== DIAGNOSIS ===');
    
    if (data.ScheduleVersions.length === 10 && successfulMappings === data.Assignments.length) {
      console.log('✅ All version IDs are properly mapped in theory.');
      console.log('The issue must be in the actual restore implementation:');
      console.log('  1. Transaction might be timing out before assignments are restored');
      console.log('  2. Staff/Client ID mappings might be failing');
      console.log('  3. Database constraints might be preventing assignment creation');
    } else if (failedMappings > 0) {
      console.log('❌ Some assignments reference non-existent version IDs');
      console.log('This would cause those assignments to be skipped during restore');
    }
    
    // Check for potential staff/client mapping issues
    console.log('\n=== STAFF/CLIENT ID RANGES ===');
    const staffIds = new Set(data.Staff.map(s => s.id));
    const clientIds = new Set(data.Clients.map(c => c.id));
    const assignmentStaffIds = new Set(data.Assignments.map(a => a.staffId));
    const assignmentClientIds = new Set(data.Assignments.map(a => a.clientId));
    
    const missingStaff = [...assignmentStaffIds].filter(id => !staffIds.has(id));
    const missingClients = [...assignmentClientIds].filter(id => !clientIds.has(id));
    
    if (missingStaff.length > 0) {
      console.log(`⚠️  Assignments reference staff IDs not in backup: ${missingStaff.join(', ')}`);
    }
    if (missingClients.length > 0) {
      console.log(`⚠️  Assignments reference client IDs not in backup: ${missingClients.join(', ')}`);
    }
    
    console.log(`\nStaff ID range: ${Math.min(...staffIds)} - ${Math.max(...staffIds)}`);
    console.log(`Client ID range: ${Math.min(...clientIds)} - ${Math.max(...clientIds)}`);
    
    // Summary recommendation
    console.log('\n=== RECOMMENDATIONS ===');
    console.log('1. The backup data structure looks correct');
    console.log('2. Version ID mapping should work in theory');
    console.log('3. Check the restore logs on the server for specific errors');
    console.log('4. Consider using the /restore-assignments-only endpoint for testing');
    console.log('5. The transaction timeout (3 minutes) might be too short for 315 assignments');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run analysis
analyzeRestoreLogic();