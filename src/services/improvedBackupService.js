const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

class ImprovedBackupService {
  // Export is the same as before
  async exportToExcel() {
    // Use existing export logic from backupService.js
    const backupService = require('./backupService');
    return backupService.exportToExcel();
  }

  // Improved restore without transaction to avoid timeouts
  async restoreFromExcel(filePath) {
    const startTime = Date.now();
    const results = {
      success: false,
      message: '',
      errors: [],
      restored: {
        staff: 0,
        clients: 0,
        scheduleVersions: 0,
        assignments: 0,
        groupSessions: 0,
        clientSupervisors: 0
      },
      skipped: {
        staff: 0,
        clients: 0,
        assignments: 0
      }
    };

    try {
      console.log('🚀 Starting improved restore process...');
      
      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      
      // Parse all sheets
      const data = {};
      sheetNames.forEach(sheetName => {
        data[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log(`📄 Loaded ${sheetName}: ${data[sheetName].length} records`);
      });

      // Validate essential sheets
      const essentialSheets = ['Staff', 'Clients'];
      for (const sheet of essentialSheets) {
        if (!data[sheet] || data[sheet].length === 0) {
          throw new Error(`Essential sheet '${sheet}' is missing or empty`);
        }
      }

      // Step 1: Clear existing data (no transaction)
      console.log('\n🧹 Clearing existing data...');
      try {
        await prisma.lunchGroup.deleteMany();
        await prisma.lunchSchedule.deleteMany();
        await prisma.changeLog.deleteMany();
        await prisma.dailyOverride.deleteMany();
        await prisma.clientSupervisor.deleteMany();
        await prisma.groupSessionClient.deleteMany();
        await prisma.assignment.deleteMany();
        await prisma.groupSession.deleteMany();
        await prisma.scheduleVersion.deleteMany();
        await prisma.client.deleteMany();
        await prisma.staff.deleteMany();
        console.log('✅ Data cleared successfully');
      } catch (error) {
        console.error('❌ Error clearing data:', error.message);
        results.errors.push(`Clear data: ${error.message}`);
      }

      // Create ID mapping objects
      const staffIdMapping = {};
      const clientIdMapping = {};
      const versionIdMapping = {};
      const groupSessionIdMapping = {};

      // Step 2: Restore Staff
      console.log('\n👥 Restoring staff...');
      if (data.Staff && data.Staff.length > 0) {
        for (const staff of data.Staff) {
          try {
            const newStaff = await prisma.staff.create({
              data: {
                name: staff.name,
                locations: staff.locations ? staff.locations.split(', ') : [],
                availability: staff.availability ? JSON.parse(staff.availability) : {}
              }
            });
            staffIdMapping[staff.id] = newStaff.id;
            results.restored.staff++;
            
            if (results.restored.staff % 10 === 0) {
              console.log(`  Progress: ${results.restored.staff}/${data.Staff.length} staff restored`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to restore staff ${staff.name}:`, error.message);
            results.errors.push(`Staff ${staff.name}: ${error.message}`);
            results.skipped.staff++;
          }
        }
        console.log(`✅ Staff restored: ${results.restored.staff} successful, ${results.skipped.staff} skipped`);
      }

      // Step 3: Restore Clients
      console.log('\n👤 Restoring clients...');
      if (data.Clients && data.Clients.length > 0) {
        for (const client of data.Clients) {
          try {
            const newClient = await prisma.client.create({
              data: {
                name: client.name,
                authorizedHours: client.authorizedHours || 0,
                locations: client.locations ? client.locations.split(', ') : [],
                availability: client.availability ? JSON.parse(client.availability) : {}
              }
            });
            clientIdMapping[client.id] = newClient.id;
            results.restored.clients++;
            
            if (results.restored.clients % 20 === 0) {
              console.log(`  Progress: ${results.restored.clients}/${data.Clients.length} clients restored`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to restore client ${client.name}:`, error.message);
            results.errors.push(`Client ${client.name}: ${error.message}`);
            results.skipped.clients++;
          }
        }
        console.log(`✅ Clients restored: ${results.restored.clients} successful, ${results.skipped.clients} skipped`);
      }

      // Step 4: Restore Schedule Versions
      console.log('\n📅 Restoring schedule versions...');
      if (data.ScheduleVersions && data.ScheduleVersions.length > 0) {
        // Sort versions by ID to maintain order
        const sortedVersions = [...data.ScheduleVersions].sort((a, b) => a.id - b.id);
        
        for (const version of sortedVersions) {
          try {
            const newVersion = await prisma.scheduleVersion.create({
              data: {
                name: version.name || `Restored Schedule ${version.id}`,
                type: version.type || 'main',
                status: version.status || 'active', // Default since missing in backup
                startDate: version.startDate ? new Date(version.startDate) : null,
                description: version.description || `Restored from backup (Original ID: ${version.id})`,
                createdBy: version.createdBy || 'system'
              }
            });
            versionIdMapping[version.id] = newVersion.id;
            results.restored.scheduleVersions++;
            console.log(`  ✅ Version ${version.id} → ${newVersion.id}: ${version.name}`);
          } catch (error) {
            console.error(`  ❌ Failed to restore version ${version.id}:`, error.message);
            results.errors.push(`Version ${version.id}: ${error.message}`);
          }
        }
        console.log(`✅ Schedule versions restored: ${results.restored.scheduleVersions}/${data.ScheduleVersions.length}`);
      } else {
        // Create default version if none exist
        console.log('  ⚠️  No versions in backup, creating default...');
        const mainVersion = await prisma.scheduleVersion.create({
          data: {
            name: 'Main Schedule',
            type: 'main',
            status: 'active',
            createdBy: 'system',
            description: 'Default version created during restore'
          }
        });
        versionIdMapping[1] = mainVersion.id;
        results.restored.scheduleVersions = 1;
      }

      // Show version mapping
      console.log('\n📋 Version ID mappings:');
      Object.entries(versionIdMapping).forEach(([oldId, newId]) => {
        console.log(`  ${oldId} → ${newId}`);
      });

      // Step 5: Restore Assignments
      console.log('\n📝 Restoring assignments...');
      if (data.Assignments && data.Assignments.length > 0) {
        let progress = 0;
        
        for (const assignment of data.Assignments) {
          try {
            const newStaffId = staffIdMapping[assignment.staffId];
            const newClientId = clientIdMapping[assignment.clientId];
            const newVersionId = versionIdMapping[assignment.versionId];

            if (!newStaffId || !newClientId || !newVersionId) {
              if (!newStaffId) console.log(`  ⚠️  No mapping for staff ID ${assignment.staffId}`);
              if (!newClientId) console.log(`  ⚠️  No mapping for client ID ${assignment.clientId}`);
              if (!newVersionId) console.log(`  ⚠️  No mapping for version ID ${assignment.versionId}`);
              results.skipped.assignments++;
              continue;
            }

            await prisma.assignment.create({
              data: {
                staffId: newStaffId,
                clientId: newClientId,
                day: assignment.day,
                block: assignment.block,
                versionId: newVersionId,
                isGroup: assignment.isGroup || false,
                groupSessionId: assignment.groupSessionId ? groupSessionIdMapping[assignment.groupSessionId] : null,
                plannedDate: assignment.plannedDate ? new Date(assignment.plannedDate) : null
              }
            });
            
            results.restored.assignments++;
            progress++;
            
            if (progress % 50 === 0) {
              console.log(`  Progress: ${progress}/${data.Assignments.length} assignments processed`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to restore assignment:`, error.message);
            results.errors.push(`Assignment: ${error.message}`);
            results.skipped.assignments++;
          }
        }
        console.log(`✅ Assignments restored: ${results.restored.assignments} successful, ${results.skipped.assignments} skipped`);
      }

      // Step 6: Restore Group Sessions (if present)
      if (data.GroupSessions && data.GroupSessions.length > 0) {
        console.log('\n👥 Restoring group sessions...');
        for (const session of data.GroupSessions) {
          try {
            const newStaffId = staffIdMapping[session.staffId];
            const newVersionId = versionIdMapping[session.versionId];
            
            if (newStaffId && newVersionId) {
              const newSession = await prisma.groupSession.create({
                data: {
                  day: session.day,
                  block: session.block,
                  staffId: newStaffId,
                  versionId: newVersionId,
                  location: session.location,
                  maxSize: session.maxSize || 4
                }
              });
              groupSessionIdMapping[session.id] = newSession.id;
              results.restored.groupSessions++;
            }
          } catch (error) {
            console.error(`  ❌ Failed to restore group session:`, error.message);
          }
        }
      }

      // Final summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Restore completed in ${duration} seconds`);
      
      results.success = true;
      results.message = 'Database restored successfully from backup';
      
      // Verify final counts
      const finalCounts = await Promise.all([
        prisma.staff.count(),
        prisma.client.count(),
        prisma.scheduleVersion.count(),
        prisma.assignment.count()
      ]);
      
      console.log('\n📊 Final database state:');
      console.log(`  Staff: ${finalCounts[0]}`);
      console.log(`  Clients: ${finalCounts[1]}`);
      console.log(`  Schedule Versions: ${finalCounts[2]}`);
      console.log(`  Assignments: ${finalCounts[3]}`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Restore failed:', error);
      results.message = `Restore failed: ${error.message}`;
      results.errors.push(error.message);
      throw error;
    }
  }
}

module.exports = new ImprovedBackupService();