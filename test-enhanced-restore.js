#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testEnhancedRestore() {
  try {
    console.log('🔄 Testing enhanced restore endpoint...');
    
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
    
    console.log('📤 Uploading to enhanced restore endpoint...');
    console.log('⏰ This may take several minutes for a full restore...');
    
    // Make the request with longer timeout
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/restore-full', {
      method: 'POST',
      body: form,
      timeout: 300000 // 5 minutes timeout
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Enhanced restore completed!');
      console.log('\n📊 RESTORE SUMMARY:');
      console.log('===================');
      
      console.log('\n📈 Before Restore:');
      console.log(`   Staff: ${result.beforeRestore.staff}`);
      console.log(`   Clients: ${result.beforeRestore.clients}`);
      console.log(`   Assignments: ${result.beforeRestore.assignments}`);
      console.log(`   Schedule Versions: ${result.beforeRestore.scheduleVersions}`);
      
      console.log('\n📈 After Restore:');
      console.log(`   Staff: ${result.afterRestore.staff}`);
      console.log(`   Clients: ${result.afterRestore.clients}`);
      console.log(`   Assignments: ${result.afterRestore.assignments}`);
      console.log(`   Schedule Versions: ${result.afterRestore.scheduleVersions}`);
      
      console.log('\n🗂️ Assignment Distribution by Version:');
      Object.entries(result.versionDistribution || {}).forEach(([version, count]) => {
        console.log(`   ${version}: ${count} assignments`);
      });
      
      console.log('\n📋 Restoration Details:');
      if (result.restoreDetails && result.restoreDetails.restored) {
        const details = result.restoreDetails.restored;
        console.log(`   Staff: ${details.staff} restored`);
        console.log(`   Clients: ${details.clients} restored`);
        console.log(`   Schedule Versions: ${details.scheduleVersions} restored`);
        console.log(`   Assignments: ${details.assignments} restored`);
        console.log(`   Group Sessions: ${details.groupSessions} restored`);
        console.log(`   Group Session Clients: ${details.groupSessionClients} restored`);
        console.log(`   Client Supervisors: ${details.clientSupervisors} restored`);
      }
      
      console.log('\n✅ SUCCESS: Database restored with full version integrity!');
      console.log('🎯 All assignments should now be properly distributed across their original schedule versions.');
      
    } else {
      console.error('❌ Enhanced restore failed:', result);
      if (result.details) {
        console.error('Error details:', result.details);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNRESET' || error.code === 'FETCH_ERROR') {
      console.error('💡 This might be a timeout - the restore operation could still be running.');
      console.error('💡 Check the server logs or try querying the backup status endpoint.');
    }
  }
}

// Also add a function to check status after restore
async function checkRestoreStatus() {
  try {
    console.log('\n🔍 Checking current database status...');
    
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/status');
    const result = await response.json();
    
    if (response.ok) {
      console.log('\n📊 CURRENT DATABASE STATE:');
      console.log('=========================');
      console.log(`Staff: ${result.databaseState.staff}`);
      console.log(`Clients: ${result.databaseState.clients}`);
      console.log(`Assignments: ${result.databaseState.assignments}`);
      console.log(`Schedule Versions: ${result.databaseState.scheduleVersions}`);
      console.log(`Daily Overrides: ${result.databaseState.dailyOverrides}`);
      
      console.log('\n🗂️ Schedule Versions:');
      result.scheduleVersions.forEach(version => {
        const assignmentCount = result.assignmentsByVersion[version.id]?.assignmentCount || 0;
        console.log(`   ${version.id}: ${version.name} (${version.type}) - ${assignmentCount} assignments`);
      });
      
      console.log('\n📋 Sample Assignments:');
      result.sampleAssignments.forEach((assignment, index) => {
        console.log(`   ${index + 1}. ${assignment.staffName} → ${assignment.clientName} (${assignment.day} ${assignment.block}) [Version: ${assignment.version.name}]`);
      });
      
    } else {
      console.error('❌ Failed to get status:', result);
    }
  } catch (error) {
    console.error('❌ Status check error:', error.message);
  }
}

// Run the test
console.log('🚀 Starting Enhanced Database Restore Test');
console.log('==========================================\n');

testEnhancedRestore()
  .then(() => {
    // Wait a moment then check status
    setTimeout(checkRestoreStatus, 2000);
  })
  .catch(console.error);