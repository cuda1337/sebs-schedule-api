#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testImprovedRestore() {
  try {
    console.log('🚀 Testing Improved Restore Endpoint');
    console.log('====================================\n');
    
    const backupFile = './SEBS-Database-Backup(3).xlsx';
    
    if (!fs.existsSync(backupFile)) {
      console.error('❌ Backup file not found:', backupFile);
      return;
    }
    
    console.log('📁 Found backup file:', backupFile);
    
    // First check current status
    console.log('\n📊 Checking current database state...');
    const statusResponse = await fetch('https://sebs-schedule-api.onrender.com/api/backup/status');
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log(`Current: ${status.databaseState.staff} staff, ${status.databaseState.clients} clients, ${status.databaseState.assignments} assignments`);
    }
    
    // Create form data
    const form = new FormData();
    form.append('backupFile', fs.createReadStream(backupFile));
    
    console.log('\n📤 Uploading to /restore-improved endpoint...');
    console.log('⏰ This uses a non-transactional approach to avoid timeouts...\n');
    
    const startTime = Date.now();
    
    // Make the request
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/restore-improved', {
      method: 'POST',
      body: form,
      timeout: 900000 // 15 minutes timeout
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      console.error(`\n❌ HTTP Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`\n✅ RESTORE SUCCESSFUL! (Completed in ${duration} seconds)`);
      console.log('\n📊 RESTORE SUMMARY:');
      console.log('===================');
      
      console.log('\n✅ Successfully Restored:');
      Object.entries(result.restored).forEach(([entity, count]) => {
        if (count > 0) {
          console.log(`   ${entity}: ${count}`);
        }
      });
      
      if (result.skipped && Object.values(result.skipped).some(v => v > 0)) {
        console.log('\n⚠️  Skipped Items:');
        Object.entries(result.skipped).forEach(([entity, count]) => {
          if (count > 0) {
            console.log(`   ${entity}: ${count}`);
          }
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log('\n❌ Errors (first 10):');
        result.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }
      
      // Check final status
      console.log('\n📊 Verifying final database state...');
      const finalStatusResponse = await fetch('https://sebs-schedule-api.onrender.com/api/backup/status');
      if (finalStatusResponse.ok) {
        const finalStatus = await finalStatusResponse.json();
        console.log(`Final: ${finalStatus.databaseState.staff} staff, ${finalStatus.databaseState.clients} clients, ${finalStatus.databaseState.assignments} assignments`);
        
        // Check version distribution
        if (finalStatus.assignmentsByVersion) {
          console.log('\n📋 Assignment distribution by version:');
          Object.entries(finalStatus.assignmentsByVersion).forEach(([versionId, info]) => {
            console.log(`   Version ${versionId} (${info.name}): ${info.assignmentCount} assignments`);
          });
        }
      }
      
    } else {
      console.log(`\n❌ RESTORE FAILED!`);
      console.log('Message:', result.message);
      if (result.errors && result.errors.length > 0) {
        console.log('\nErrors:');
        result.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'ECONNRESET' || error.code === 'FETCH_ERROR') {
      console.error('💡 Connection lost - the restore might still be running on the server.');
      console.error('   Check the database status in a few minutes.');
    }
  }
}

// Run the test
testImprovedRestore();