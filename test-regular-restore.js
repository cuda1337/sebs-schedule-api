#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testRegularRestore() {
  try {
    console.log('🔄 Testing regular restore endpoint with enhanced backend...');
    
    const backupFile = './SEBS-Database-Backup(3).xlsx';
    
    // Check if backup file exists
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Backup file not found:', backupFile);
      return;
    }
    
    console.log('📁 Found backup file:', backupFile);
    
    // Create form data
    const form = new FormData();
    form.append('backupFile', fs.createReadStream(backupFile));
    
    console.log('📤 Uploading to regular restore endpoint...');
    console.log('⏰ This may take several minutes...');
    
    // Make the request with longer timeout
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/restore', {
      method: 'POST',
      body: form,
      timeout: 300000 // 5 minutes timeout
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Regular restore completed!');
      console.log('\n📊 Results:', result);
      
    } else {
      console.error('❌ Regular restore failed:', result);
      if (result.details) {
        console.error('Error details:', result.details);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNRESET' || error.code === 'FETCH_ERROR') {
      console.error('💡 This might be a timeout - the restore operation could still be running.');
    }
  }
}

// Also add a function to check status after restore
async function checkRestoreStatus() {
  try {
    console.log('\n🔍 Checking database status after restore...');
    
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/status');
    const result = await response.json();
    
    if (response.ok) {
      console.log('\n📊 CURRENT DATABASE STATE:');
      console.log('=========================');
      console.log(`Staff: ${result.databaseState.staff}`);
      console.log(`Clients: ${result.databaseState.clients}`);
      console.log(`Assignments: ${result.databaseState.assignments}`);
      console.log(`Schedule Versions: ${result.databaseState.scheduleVersions}`);
      
      console.log('\n🗂️ Schedule Versions & Assignment Distribution:');
      result.scheduleVersions.forEach(version => {
        const assignmentCount = result.assignmentsByVersion[version.id]?.assignmentCount || 0;
        console.log(`   ${version.id}: ${version.name} (${version.type}) - ${assignmentCount} assignments`);
      });
      
      if (result.databaseState.scheduleVersions > 1) {
        // Check if assignments are distributed across versions
        const versionsWithAssignments = Object.values(result.assignmentsByVersion)
          .filter(v => v.assignmentCount > 0).length;
        
        if (versionsWithAssignments > 1) {
          console.log('\n✅ SUCCESS: Assignments are properly distributed across multiple versions!');
        } else {
          console.log('\n⚠️  WARNING: All assignments are still in one version. Version integrity not restored.');
        }
      }
      
    } else {
      console.error('❌ Failed to get status:', result);
    }
  } catch (error) {
    console.error('❌ Status check error:', error.message);
  }
}

// Run the test
console.log('🚀 Testing Enhanced Backend with Regular Restore Endpoint');
console.log('========================================================\n');

testRegularRestore()
  .then(() => {
    // Wait a moment then check status
    setTimeout(checkRestoreStatus, 3000);
  })
  .catch(console.error);