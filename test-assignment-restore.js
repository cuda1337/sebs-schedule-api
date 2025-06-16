#!/usr/bin/env node

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testAssignmentRestore() {
  try {
    console.log('🔄 Testing assignment-only restore endpoint...');
    
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
    
    console.log('📤 Uploading to assignment restore endpoint...');
    
    // Make the request
    const response = await fetch('https://sebs-schedule-api.onrender.com/api/backup/restore-assignments-only', {
      method: 'POST',
      body: form
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Assignment restore completed!');
      console.log(`📊 Results:`, result);
      console.log(`   - Restored: ${result.restored} assignments`);
      console.log(`   - Skipped: ${result.skipped} assignments`);
      console.log(`   - Total in backup: ${result.total} assignments`);
      console.log(`   - Main version ID: ${result.mainVersionId}`);
    } else {
      console.error('❌ Assignment restore failed:', result);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testAssignmentRestore();