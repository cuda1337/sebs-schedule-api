const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const backupService = require('../services/backupService');

const router = express.Router();

// Test route to verify backup routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Backup routes are working!' });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `restore-${timestamp}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accept Excel files only
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'), false);
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Export complete database backup
router.get('/export', async (req, res) => {
  try {
    console.log('Backup export requested');
    
    // For testing, return a simple text file
    const content = 'SEBS Database Backup Test File\nGenerated: ' + new Date().toISOString();
    const filename = `SEBS-Test-Backup-${new Date().toISOString().split('T')[0]}.txt`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
    
    console.log(`Test backup export successful: ${filename}`);
  } catch (error) {
    console.error('Error exporting backup:', error);
    res.status(500).json({ 
      error: 'Failed to export backup',
      details: error.message 
    });
  }
});

// Import and restore from Excel backup
router.post('/restore', upload.single('backupFile'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    
    filePath = req.file.path;
    console.log('Restore requested with file:', filePath);
    
    // Validate file exists and is readable
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({ error: 'Uploaded file not found' });
    }
    
    // Perform restore
    const result = await backupService.restoreFromExcel(filePath);
    
    console.log('Restore completed successfully');
    res.json({
      success: true,
      message: 'Database restored successfully from backup',
      ...result
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ 
      error: 'Failed to restore backup',
      details: error.message 
    });
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Temporary file cleaned up:', filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up file:', cleanupError);
      }
    }
  }
});

// Get backup info/status
router.get('/info', async (req, res) => {
  try {
    console.log('Backup info requested');
    
    // Simple response for testing
    res.json({
      databaseInfo: {
        staff: 5,
        clients: 10,
        assignments: 25,
        scheduleVersions: 1,
        dailyOverrides: 3,
        changeLogs: 8,
        lastUpdated: new Date().toISOString()
      },
      backupRecommendation: {
        shouldBackup: true,
        reason: 'Test data - backup system working'
      }
    });
  } catch (error) {
    console.error('Error getting backup info:', error);
    res.status(500).json({ 
      error: 'Failed to get backup information',
      details: error.message 
    });
  }
});

// Validate backup file without restoring
router.post('/validate', upload.single('backupFile'), async (req, res) => {
  let filePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No backup file provided' });
    }
    
    filePath = req.file.path;
    console.log('Validating backup file:', filePath);
    
    // Read and validate Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    // Check required sheets
    const requiredSheets = ['Staff', 'Clients', 'Assignments', 'ScheduleVersions'];
    const missingSheets = requiredSheets.filter(sheet => !sheetNames.includes(sheet));
    
    if (missingSheets.length > 0) {
      return res.status(400).json({
        valid: false,
        error: `Missing required sheets: ${missingSheets.join(', ')}`,
        foundSheets: sheetNames
      });
    }
    
    // Parse sheet data for validation
    const data = {};
    sheetNames.forEach(sheetName => {
      data[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    });
    
    // Get metadata if available
    let metadata = null;
    if (data.BackupMetadata && data.BackupMetadata.length > 0) {
      metadata = data.BackupMetadata[0];
    }
    
    res.json({
      valid: true,
      sheets: sheetNames,
      recordCounts: {
        staff: data.Staff?.length || 0,
        clients: data.Clients?.length || 0,
        assignments: data.Assignments?.length || 0,
        scheduleVersions: data.ScheduleVersions?.length || 0,
        dailyOverrides: data.DailyOverrides?.length || 0,
        changeLogs: data.ChangeLogs?.length || 0,
        clientSupervisors: data.ClientSupervisors?.length || 0,
        lunchSchedules: data.LunchSchedules?.length || 0,
        lunchGroups: data.LunchGroups?.length || 0
      },
      metadata: metadata,
      message: 'Backup file is valid and ready for restore'
    });
  } catch (error) {
    console.error('Error validating backup file:', error);
    res.status(400).json({ 
      valid: false,
      error: 'Invalid backup file format',
      details: error.message 
    });
  } finally {
    // Clean up uploaded file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Validation file cleaned up:', filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up validation file:', cleanupError);
      }
    }
  }
});

module.exports = router;