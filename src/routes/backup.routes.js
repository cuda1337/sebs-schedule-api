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
    
    // First validate the backup file
    console.log('Validating backup file structure...');
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    // Check for essential sheets (more flexible for older backups)
    const essentialSheets = ['Staff', 'Clients'];
    const missingEssential = essentialSheets.filter(sheet => !sheetNames.includes(sheet));
    
    if (missingEssential.length > 0) {
      return res.status(400).json({
        error: `Invalid backup file - missing essential sheets: ${missingEssential.join(', ')}`,
        foundSheets: sheetNames,
        note: 'At minimum, Staff and Clients sheets are required for restore'
      });
    }
    
    console.log('Backup file validated, contains sheets:', sheetNames);
    
    // Perform restore
    console.log('Starting backup restore...');
    const result = await backupService.restoreFromExcel(filePath);
    console.log('Backup restore completed:', result);
    
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
      details: error.message,
      // Add more debugging info
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Check current database state
router.get('/status', async (req, res) => {
  try {
    const prisma = req.prisma;
    
    const [
      staffCount,
      clientsCount,
      assignmentsCount,
      versionsCount,
      overridesCount
    ] = await Promise.all([
      prisma.staff.count(),
      prisma.client.count(),
      prisma.assignment.count(),
      prisma.scheduleVersion.count(),
      prisma.dailyOverride.count()
    ]);
    
    // Get some sample assignments
    const sampleAssignments = await prisma.assignment.findMany({
      take: 5,
      include: {
        staff: { select: { name: true } },
        client: { select: { name: true } },
        version: { select: { id: true, name: true, type: true, status: true } }
      }
    });
    
    // Get all schedule versions
    const allVersions = await prisma.scheduleVersion.findMany({
      orderBy: { id: 'asc' }
    });
    
    // Get assignment counts per version
    const assignmentsByVersion = {};
    for (const version of allVersions) {
      const count = await prisma.assignment.count({
        where: { versionId: version.id }
      });
      assignmentsByVersion[version.id] = {
        name: version.name,
        type: version.type,
        status: version.status,
        assignmentCount: count
      };
    }
    
    res.json({
      databaseState: {
        staff: staffCount,
        clients: clientsCount,
        assignments: assignmentsCount,
        scheduleVersions: versionsCount,
        dailyOverrides: overridesCount,
        lastChecked: new Date().toISOString()
      },
      scheduleVersions: allVersions,
      assignmentsByVersion: assignmentsByVersion,
      sampleAssignments: sampleAssignments.map(a => ({
        id: a.id,
        staffName: a.staff.name,
        clientName: a.client.name,
        day: a.day,
        block: a.block,
        versionId: a.versionId,
        version: a.version
      }))
    });
  } catch (error) {
    console.error('Error getting database status:', error);
    res.status(500).json({ 
      error: 'Failed to get database status',
      details: error.message 
    });
  }
});

// Get backup info/status
router.get('/info', async (req, res) => {
  try {
    console.log('Backup info requested');
    
    // Use the prisma instance from the request object
    const prisma = req.prisma;
    
    if (!prisma) {
      console.log('No prisma instance available, using demo data');
      return res.json({
        databaseInfo: {
          staff: 0,
          clients: 0,
          assignments: 0,
          scheduleVersions: 0,
          dailyOverrides: 0,
          changeLogs: 0,
          lastUpdated: new Date().toISOString()
        },
        backupRecommendation: {
          shouldBackup: false,
          reason: 'No database connected - demo mode'
        }
      });
    }
    
    // Get counts of all major tables
    const [
      staffCount,
      clientsCount,
      assignmentsCount,
      versionsCount,
      overridesCount,
      changeLogsCount
    ] = await Promise.all([
      prisma.staff.count().catch(() => 0),
      prisma.client.count().catch(() => 0),
      prisma.assignment.count().catch(() => 0),
      prisma.scheduleVersion.count().catch(() => 0),
      prisma.dailyOverride.count().catch(() => 0),
      prisma.changeLog.count().catch(() => 0)
    ]);
    
    console.log(`Real database counts: ${staffCount} staff, ${clientsCount} clients, ${assignmentsCount} assignments`);
    
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
    
    // Check for essential sheets (more flexible for older backups)
    const essentialSheets = ['Staff', 'Clients'];
    const missingEssential = essentialSheets.filter(sheet => !sheetNames.includes(sheet));
    
    if (missingEssential.length > 0) {
      return res.status(400).json({
        valid: false,
        error: `Missing essential sheets: ${missingEssential.join(', ')}`,
        foundSheets: sheetNames,
        note: 'At minimum, Staff and Clients sheets are required'
      });
    }
    
    // Log all sheets found for debugging
    console.log('Backup file contains sheets:', sheetNames);
    
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

// Simple test restore without transaction
router.post('/test-assignments', async (req, res) => {
  try {
    console.log('Starting assignment creation test...');
    
    // Step 1: Check if we have staff and clients
    const staffCount = await req.prisma.staff.count();
    const clientCount = await req.prisma.client.count();
    const versionCount = await req.prisma.scheduleVersion.count();
    
    console.log(`Current data: ${staffCount} staff, ${clientCount} clients, ${versionCount} versions`);
    
    if (staffCount === 0 || clientCount === 0) {
      return res.status(400).json({ error: 'Need staff and clients before creating assignments' });
    }
    
    // Step 2: Get the main schedule version
    const mainVersion = await req.prisma.scheduleVersion.findFirst({
      where: { type: 'main', status: 'active' }
    });
    
    if (!mainVersion) {
      return res.status(400).json({ error: 'No main schedule version found' });
    }
    
    console.log(`Using main version: ${mainVersion.id} (${mainVersion.name})`);
    
    // Step 3: Clear existing assignments
    const deletedCount = await req.prisma.assignment.deleteMany({});
    console.log(`Deleted ${deletedCount.count} existing assignments`);
    
    // Step 4: Create a few test assignments manually
    const firstStaff = await req.prisma.staff.findFirst();
    const firstClient = await req.prisma.client.findFirst();
    
    if (!firstStaff || !firstClient) {
      return res.status(400).json({ error: 'Need at least one staff and one client' });
    }
    
    console.log(`Creating test assignments with staff ${firstStaff.id} and client ${firstClient.id}`);
    
    // Create test assignments one by one
    const testAssignments = [];
    
    try {
      const assignment1 = await req.prisma.assignment.create({
        data: {
          staffId: firstStaff.id,
          clientId: firstClient.id,
          day: 'Monday',
          block: 'AM',
          versionId: mainVersion.id,
          isGroup: false
        }
      });
      testAssignments.push(assignment1);
      console.log(`Created assignment 1: ${assignment1.id}`);
      
      const assignment2 = await req.prisma.assignment.create({
        data: {
          staffId: firstStaff.id,
          clientId: firstClient.id,
          day: 'Tuesday',
          block: 'PM',
          versionId: mainVersion.id,
          isGroup: false
        }
      });
      testAssignments.push(assignment2);
      console.log(`Created assignment 2: ${assignment2.id}`);
      
    } catch (error) {
      console.error('Error creating test assignments:', error);
      return res.status(500).json({ 
        error: 'Failed to create test assignments',
        details: error.message 
      });
    }
    
    // Step 5: Verify assignments were created
    const finalCount = await req.prisma.assignment.count();
    console.log(`Final assignment count: ${finalCount}`);
    
    res.json({
      success: true,
      message: `Created ${testAssignments.length} test assignments`,
      assignments: testAssignments.map(a => ({
        id: a.id,
        staffId: a.staffId,
        clientId: a.clientId,
        day: a.day,
        block: a.block,
        versionId: a.versionId
      })),
      finalCount
    });
    
  } catch (error) {
    console.error('Assignment creation test failed:', error);
    res.status(500).json({ 
      error: 'Assignment creation test failed',
      details: error.message 
    });
  }
});

module.exports = router;