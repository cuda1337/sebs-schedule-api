#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function checkCurrentState() {
  try {
    console.log('📊 Checking current database state...');
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/status');
    const status = await response.json();
    
    console.log('\nCurrent database state:');
    console.log(`  Staff: ${status.databaseState.staff}`);
    console.log(`  Clients: ${status.databaseState.clients}`);
    console.log(`  Assignments: ${status.databaseState.assignments}`);
    console.log(`  Schedule Versions: ${status.databaseState.scheduleVersions}`);
    
    if (status.scheduleVersions && status.scheduleVersions.length > 0) {
      console.log('\nExisting schedule versions:');
      status.scheduleVersions.forEach(v => {
        const assignmentCount = status.assignmentsByVersion[v.id]?.assignmentCount || 0;
        console.log(`  Version ${v.id}: ${v.name} (${v.type}) - ${assignmentCount} assignments`);
      });
    }
    
    return status;
  } catch (error) {
    console.error('Error checking database state:', error.message);
    return null;
  }
}

async function testRestore() {
  try {
    console.log('🔄 Testing fixed restore process...\n');
    
    // Check initial state
    const initialState = await checkCurrentState();
    
    const backupFile = './SEBS-Database-Backup(3).xlsx';
    
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Backup file not found:', backupFile);
      return;
    }
    
    console.log('\n📁 Found backup file:', backupFile);
    
    // First validate the backup
    console.log('\n🔍 Validating backup file...');
    const validateForm = new FormData();
    validateForm.append('backupFile', fs.createReadStream(backupFile));
    
    const validateResponse = await fetch('https://sebs-schedule-api.onrender.com/api/backup/validate', {
      method: 'POST',
      body: validateForm
    });
    
    if (validateResponse.ok) {
      const validation = await validateResponse.json();
      console.log('✅ Backup validation successful:');
      console.log(`  Staff: ${validation.recordCounts.staff}`);
      console.log(`  Clients: ${validation.recordCounts.clients}`);
      console.log(`  Assignments: ${validation.recordCounts.assignments}`);
      console.log(`  Schedule Versions: ${validation.recordCounts.scheduleVersions}`);
    }
    
    // Perform restore
    console.log('\n📤 Starting restore process...');
    console.log('⏰ This may take several minutes...');
    
    const restoreForm = new FormData();
    restoreForm.append('backupFile', fs.createReadStream(backupFile));
    
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/restore', {
      method: 'POST',
      body: restoreForm,
      timeout: 600000 // 10 minutes timeout
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('\n✅ Restore completed!');
      console.log('Restored data:');
      if (result.restored) {
        Object.entries(result.restored).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    } else {
      console.log('❌ Restore failed:', result.message);
    }
    
    // Check final state
    console.log('\n📊 Checking final database state...');
    const finalState = await checkCurrentState();
    
    if (finalState && finalState.assignmentsByVersion) {
      const versionsWithAssignments = Object.values(finalState.assignmentsByVersion)
        .filter(v => v.assignmentCount > 0).length;
      
      if (versionsWithAssignments > 1) {
        console.log('\n✅ SUCCESS: Assignments are properly distributed across multiple versions!');
      } else if (finalState.databaseState.assignments > 0) {
        console.log('\n⚠️  WARNING: All assignments might be in one version.');
      } else {
        console.log('\n❌ ERROR: No assignments were restored!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNRESET' || error.code === 'FETCH_ERROR') {
      console.error('💡 This might be a timeout - the restore operation could still be running.');
    }
  }
}

// Run the test
console.log('🚀 Testing Database Restore Process');
console.log('===================================\n');

testRestore();