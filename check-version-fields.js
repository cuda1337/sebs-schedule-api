const XLSX = require('xlsx');
const path = require('path');

// Path to the backup file
const backupPath = path.join(__dirname, 'SEBS-Database-Backup(3).xlsx');

console.log('Checking ScheduleVersion fields in backup...\n');

try {
  // Read the Excel file
  const workbook = XLSX.readFile(backupPath);
  
  // Get ScheduleVersions data
  const versionsData = XLSX.utils.sheet_to_json(workbook.Sheets['ScheduleVersions']);
  
  if (versionsData.length > 0) {
    console.log('Fields in ScheduleVersions sheet:');
    console.log(Object.keys(versionsData[0]));
    
    console.log('\nFirst version record:');
    console.log(JSON.stringify(versionsData[0], null, 2));
    
    // Check if required fields are missing
    const requiredFields = ['name', 'type', 'status'];
    const availableFields = Object.keys(versionsData[0]);
    const missingFields = requiredFields.filter(field => !availableFields.includes(field));
    
    if (missingFields.length > 0) {
      console.log('\n⚠️  WARNING: Missing required fields:', missingFields);
      console.log('This might be why versions are not restoring properly!');
    }
    
    // Check for status field specifically
    console.log('\nChecking status field in all versions:');
    versionsData.forEach((version, index) => {
      console.log(`Version ${version.id}: status = ${version.status || 'MISSING'}`);
    });
  }
  
} catch (error) {
  console.error('Error:', error);
}