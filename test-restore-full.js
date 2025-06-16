#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFullRestore() {
  try {
    console.log('🔄 Testing new /restore-full endpoint...');
    
    const backupFile = './SEBS-Database-Backup(3).xlsx';
    
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Backup file not found:', backupFile);
      return;
    }
    
    console.log('📁 Found backup file:', backupFile);
    
    // Create form data
    const form = new FormData();
    form.append('backupFile', fs.createReadStream(backupFile));
    
    console.log('📤 Uploading to /restore-full endpoint...');
    console.log('⏰ This may take several minutes...');
    
    // Make the request with longer timeout
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/restore-full', {
      method: 'POST',
      body: form,
      timeout: 600000 // 10 minutes timeout
    });
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ Full restore completed!');
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
    if (result.versionDistribution && Object.keys(result.versionDistribution).length > 0) {
      Object.entries(result.versionDistribution).forEach(([version, count]) => {
        console.log(`   ${version}: ${count} assignments`);
      });
      
      // Check if assignments are properly distributed
      const versionsWithAssignments = Object.values(result.versionDistribution).filter(count => count > 0).length;
      if (versionsWithAssignments > 1) {
        console.log('\n✅ SUCCESS: Assignments are properly distributed across multiple versions!');
      } else {
        console.log('\n⚠️  WARNING: All assignments are still in one version.');
      }
    } else {
      console.log('   No version distribution data available');
    }
    
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
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNRESET' || error.code === 'FETCH_ERROR') {
      console.error('💡 This might be a timeout - the restore operation could still be running.');
    }
  }
}

// Run the test
console.log('🚀 Testing New Full Restore Endpoint');
console.log('===================================\n');

testFullRestore();