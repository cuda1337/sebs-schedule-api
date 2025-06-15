const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const backupService = require('../services/backupService');

const router = express.Router();

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
    
    // Create Excel workbook
    const workbook = await backupService.exportToExcel();
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `SEBS-Database-Backup-${timestamp}.xlsx`;
    
    // Write to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    
    console.log(`Backup export successful: ${filename}`);
    res.send(buffer);
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
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get counts of all major tables
    const [
      staffCount,
      clientsCount,
      assignmentsCount,
      versionsCount,
      overridesCount,
      changeLogsCount
    ] = await Promise.all([
      prisma.staff.count(),
      prisma.client.count(),
      prisma.assignment.count(),
      prisma.scheduleVersion.count(),
      prisma.dailyOverride.count(),
      prisma.changeLog.count()
    ]);
    
    res.json({
      databaseInfo: {
        staff: staffCount,
        clients: clientsCount,
        assignments: assignmentsCount,
        scheduleVersions: versionsCount,
        dailyOverrides: overridesCount,
        changeLogs: changeLogsCount,
        lastUpdated: new Date().toISOString()
      },
      backupRecommendation: {
        shouldBackup: assignmentsCount > 0 || overridesCount > 0,
        reason: assignmentsCount > 0 
          ? 'You have active schedule data that should be backed up'
          : 'Database is ready for backup creation'
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