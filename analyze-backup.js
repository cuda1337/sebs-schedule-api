const XLSX = require('xlsx');
const path = require('path');

// Path to the backup file
const backupPath = path.join(__dirname, 'SEBS-Database-Backup(3).xlsx');

console.log('Analyzing backup file:', backupPath);

try {
  // Read the Excel file
  const workbook = XLSX.readFile(backupPath);
  const sheetNames = workbook.SheetNames;
  
  console.log('\n=== BACKUP FILE ANALYSIS ===');
  console.log('Available sheets:', sheetNames);
  
  // Analyze each sheet
  sheetNames.forEach(sheetName => {
    console.log(`\n--- ${sheetName} Sheet ---`);
    
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`Records count: ${data.length}`);
    
    if (data.length > 0) {
      console.log('Sample record structure:', Object.keys(data[0]));
      
      // Show first few records for key sheets
      if (['Staff', 'Clients', 'Assignments'].includes(sheetName) && data.length > 0) {
        console.log('First record:', data[0]);
        
        if (sheetName === 'Assignments' && data.length > 5) {
          console.log('Assignment samples:');
          data.slice(0, 5).forEach((assignment, index) => {
            console.log(`  ${index + 1}. Staff ${assignment.staffId} → Client ${assignment.clientId} (${assignment.day} ${assignment.block})`);
          });
        }
      }
    }
  });
  
  console.log('\n=== ID ANALYSIS ===');
  
  // Check ID ranges
  if (sheetNames.includes('Staff')) {
    const staffData = XLSX.utils.sheet_to_json(workbook.Sheets['Staff']);
    if (staffData.length > 0) {
      const staffIds = staffData.map(s => s.id).filter(id => id != null);
      console.log(`Staff IDs range: ${Math.min(...staffIds)} to ${Math.max(...staffIds)}`);
    }
  }
  
  if (sheetNames.includes('Clients')) {
    const clientData = XLSX.utils.sheet_to_json(workbook.Sheets['Clients']);
    if (clientData.length > 0) {
      const clientIds = clientData.map(c => c.id).filter(id => id != null);
      console.log(`Client IDs range: ${Math.min(...clientIds)} to ${Math.max(...clientIds)}`);
    }
  }
  
  if (sheetNames.includes('Assignments')) {
    const assignmentData = XLSX.utils.sheet_to_json(workbook.Sheets['Assignments']);
    if (assignmentData.length > 0) {
      const staffIds = assignmentData.map(a => a.staffId).filter(id => id != null);
      const clientIds = assignmentData.map(a => a.clientId).filter(id => id != null);
      const versionIds = assignmentData.map(a => a.versionId).filter(id => id != null);
      
      console.log(`Assignment Staff IDs range: ${Math.min(...staffIds)} to ${Math.max(...staffIds)}`);
      console.log(`Assignment Client IDs range: ${Math.min(...clientIds)} to ${Math.max(...clientIds)}`);
      console.log(`Assignment Version IDs: ${[...new Set(versionIds)].sort()}`);
      
      // Check for unique day/block combinations
      const dayBlocks = assignmentData.map(a => `${a.day}-${a.block}`);
      console.log(`Day/Block combinations:`, [...new Set(dayBlocks)].sort());
    }
  }
  
} catch (error) {
  console.error('Error analyzing backup file:', error);
}