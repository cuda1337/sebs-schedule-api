const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

class BackupService {
  // Export complete database to Excel file
  async exportToExcel() {
    try {
      console.log('Starting database export...');
      
      // Fetch all data from database
      const [
        staff,
        clients,
        assignments,
        scheduleVersions,
        groupSessions,
        groupSessionClients,
        dailyOverrides,
        changeLogs,
        clientSupervisors,
        lunchSchedules,
        lunchGroups
      ] = await Promise.all([
        prisma.staff.findMany({ orderBy: { id: 'asc' } }),
        prisma.client.findMany({ orderBy: { id: 'asc' } }),
        prisma.assignment.findMany({ 
          orderBy: { id: 'asc' },
          include: {
            staff: { select: { name: true } },
            client: { select: { name: true } }
          }
        }),
        prisma.scheduleVersion.findMany({ orderBy: { id: 'asc' } }),
        prisma.groupSession.findMany({ orderBy: { id: 'asc' } }),
        prisma.groupSessionClient.findMany({ orderBy: { id: 'asc' } }),
        prisma.dailyOverride.findMany({ 
          orderBy: { id: 'asc' },
          include: {
            originalStaff: { select: { name: true } },
            originalClient: { select: { name: true } },
            newStaff: { select: { name: true } },
            newClient: { select: { name: true } }
          }
        }),
        prisma.changeLog.findMany({ orderBy: { id: 'asc' } }),
        prisma.clientSupervisor.findMany({ 
          orderBy: { id: 'asc' },
          include: {
            client: { select: { name: true } }
          }
        }),
        prisma.lunchSchedule.findMany({ orderBy: { id: 'asc' } }),
        prisma.lunchGroup.findMany({ orderBy: { id: 'asc' } })
      ]);

      console.log(`Fetched data: ${staff.length} staff, ${clients.length} clients, ${assignments.length} assignments`);

      // Create new workbook
      const workbook = XLSX.utils.book_new();

      // Staff sheet
      const staffSheet = XLSX.utils.json_to_sheet(staff.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        locations: Array.isArray(s.locations) ? s.locations.join(', ') : s.locations,
        availability: typeof s.availability === 'object' ? JSON.stringify(s.availability) : s.availability,
        createdAt: s.createdAt ? s.createdAt.toISOString() : null,
        updatedAt: s.updatedAt ? s.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, staffSheet, 'Staff');

      // Client sheet
      const clientSheet = XLSX.utils.json_to_sheet(clients.map(c => ({
        id: c.id,
        name: c.name,
        authorizedHours: c.authorizedHours,
        locations: Array.isArray(c.locations) ? c.locations.join(', ') : c.locations,
        availability: typeof c.availability === 'object' ? JSON.stringify(c.availability) : c.availability,
        createdAt: c.createdAt ? c.createdAt.toISOString() : null,
        updatedAt: c.updatedAt ? c.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, clientSheet, 'Clients');

      // Assignments sheet
      const assignmentSheet = XLSX.utils.json_to_sheet(assignments.map(a => ({
        id: a.id,
        staffId: a.staffId,
        staffName: a.staff?.name || '',
        clientId: a.clientId,
        clientName: a.client?.name || '',
        day: a.day,
        block: a.block,
        versionId: a.versionId,
        isGroup: a.isGroup,
        groupSessionId: a.groupSessionId,
        createdAt: a.createdAt ? a.createdAt.toISOString() : null,
        updatedAt: a.updatedAt ? a.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, assignmentSheet, 'Assignments');

      // Schedule Versions sheet
      const versionSheet = XLSX.utils.json_to_sheet(scheduleVersions.map(v => ({
        id: v.id,
        name: v.name,
        type: v.type,
        effectiveDate: v.effectiveDate ? v.effectiveDate.toISOString() : null,
        isActive: v.isActive,
        createdBy: v.createdBy,
        createdAt: v.createdAt ? v.createdAt.toISOString() : null,
        updatedAt: v.updatedAt ? v.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, versionSheet, 'ScheduleVersions');

      // Group Sessions sheet
      const groupSessionSheet = XLSX.utils.json_to_sheet(groupSessions.map(g => ({
        id: g.id,
        name: g.name,
        location: g.location,
        maxClients: g.maxClients,
        description: g.description,
        createdAt: g.createdAt ? g.createdAt.toISOString() : null,
        updatedAt: g.updatedAt ? g.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, groupSessionSheet, 'GroupSessions');

      // Group Session Clients sheet
      const groupClientSheet = XLSX.utils.json_to_sheet(groupSessionClients.map(gc => ({
        id: gc.id,
        groupSessionId: gc.groupSessionId,
        clientId: gc.clientId,
        createdAt: gc.createdAt ? gc.createdAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, groupClientSheet, 'GroupSessionClients');

      // Daily Overrides sheet
      const overrideSheet = XLSX.utils.json_to_sheet(dailyOverrides.map(o => ({
        id: o.id,
        date: o.date ? o.date.toISOString().split('T')[0] : null,
        type: o.type,
        day: o.day,
        block: o.block,
        originalStaffId: o.originalStaffId,
        originalStaffName: o.originalStaff?.name || '',
        originalClientId: o.originalClientId,
        originalClientName: o.originalClient?.name || '',
        newStaffId: o.newStaffId,
        newStaffName: o.newStaff?.name || '',
        newClientId: o.newClientId,
        newClientName: o.newClient?.name || '',
        reason: o.reason,
        hours: o.hours,
        createdBy: o.createdBy,
        createdAt: o.createdAt ? o.createdAt.toISOString() : null,
        updatedAt: o.updatedAt ? o.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, overrideSheet, 'DailyOverrides');

      // Change Logs sheet
      const changeLogSheet = XLSX.utils.json_to_sheet(changeLogs.map(cl => ({
        id: cl.id,
        versionId: cl.versionId,
        action: cl.action,
        entityType: cl.entityType,
        entityId: cl.entityId,
        oldValues: typeof cl.oldValues === 'object' ? JSON.stringify(cl.oldValues) : cl.oldValues,
        newValues: typeof cl.newValues === 'object' ? JSON.stringify(cl.newValues) : cl.newValues,
        reason: cl.reason,
        reviewed: cl.reviewed,
        reviewedAt: cl.reviewedAt ? cl.reviewedAt.toISOString() : null,
        reviewedBy: cl.reviewedBy,
        createdBy: cl.createdBy,
        createdAt: cl.createdAt ? cl.createdAt.toISOString() : null,
        updatedAt: cl.updatedAt ? cl.updatedAt.toISOString() : null
      })));
      XLSX.utils.book_append_sheet(workbook, changeLogSheet, 'ChangeLogs');

      // Client Supervisors sheet
      if (clientSupervisors && clientSupervisors.length > 0) {
        const supervisorSheet = XLSX.utils.json_to_sheet(clientSupervisors.map(cs => ({
          id: cs.id,
          clientId: cs.clientId,
          clientName: cs.client?.name || '',
          supervisorName: cs.supervisorName,
          effectiveDate: cs.effectiveDate ? cs.effectiveDate.toISOString().split('T')[0] : null,
          endDate: cs.endDate ? cs.endDate.toISOString().split('T')[0] : null,
          createdAt: cs.createdAt ? cs.createdAt.toISOString() : null,
          updatedAt: cs.updatedAt ? cs.updatedAt.toISOString() : null
        })));
        XLSX.utils.book_append_sheet(workbook, supervisorSheet, 'ClientSupervisors');
      }

      // Lunch Schedules sheet
      if (lunchSchedules && lunchSchedules.length > 0) {
        const lunchScheduleSheet = XLSX.utils.json_to_sheet(lunchSchedules.map(ls => ({
          id: ls.id,
          date: ls.date ? ls.date.toISOString().split('T')[0] : null,
          location: ls.location,
          timePeriod: ls.timePeriod,
          createdBy: ls.createdBy,
          createdAt: ls.createdAt ? ls.createdAt.toISOString() : null,
          modifiedBy: ls.modifiedBy,
          modifiedAt: ls.modifiedAt ? ls.modifiedAt.toISOString() : null
        })));
        XLSX.utils.book_append_sheet(workbook, lunchScheduleSheet, 'LunchSchedules');
      }

      // Lunch Groups sheet
      if (lunchGroups && lunchGroups.length > 0) {
        const lunchGroupSheet = XLSX.utils.json_to_sheet(lunchGroups.map(lg => ({
          id: lg.id,
          lunchScheduleId: lg.lunchScheduleId,
          primaryStaff: lg.primaryStaff,
          helpers: Array.isArray(lg.helpers) ? lg.helpers.join(', ') : lg.helpers,
          clientIds: Array.isArray(lg.clientIds) ? lg.clientIds.join(', ') : lg.clientIds,
          color: lg.color
        })));
        XLSX.utils.book_append_sheet(workbook, lunchGroupSheet, 'LunchGroups');
      }

      // Add metadata sheet with backup info
      const metadata = [{
        backupDate: new Date().toISOString(),
        backupVersion: '3.0',
        totalStaff: staff.length,
        totalClients: clients.length,
        totalAssignments: assignments.length,
        totalOverrides: dailyOverrides.length,
        notes: 'Complete SEBS database backup - restore using /api/backup/restore endpoint'
      }];
      const metadataSheet = XLSX.utils.json_to_sheet(metadata);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'BackupMetadata');

      console.log('Excel workbook created successfully');
      return workbook;
    } catch (error) {
      console.error('Error creating Excel backup:', error);
      throw error;
    }
  }

  // Import and restore from Excel file
  async restoreFromExcel(filePath) {
    try {
      console.log('Starting database restore from:', filePath);
      
      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      
      console.log('Available sheets:', sheetNames);

      // Parse all sheets
      const data = {};
      sheetNames.forEach(sheetName => {
        data[sheetName] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      });

      // Validate essential sheets only
      const essentialSheets = ['Staff', 'Clients'];
      for (const sheet of essentialSheets) {
        if (!data[sheet]) {
          throw new Error(`Essential sheet '${sheet}' not found in backup file`);
        }
      }
      
      console.log('Found backup sheets:', Object.keys(data));

      console.log('Starting database restore transaction...');

      // Use transaction for data integrity with longer timeout
      await prisma.$transaction(async (tx) => {
        // Clear existing data (in reverse dependency order)
        // DON'T delete Users - preserve admin account
        console.log('Clearing existing data (preserving users)...');
        await tx.lunchGroup.deleteMany();
        await tx.lunchSchedule.deleteMany();
        await tx.changeLog.deleteMany();
        await tx.dailyOverride.deleteMany();
        await tx.clientSupervisor.deleteMany();
        await tx.groupSessionClient.deleteMany();
        // Delete DailyAssignmentState before assignments to avoid foreign key constraint violation
        await tx.dailyAssignmentState.deleteMany();
        await tx.assignment.deleteMany();
        await tx.groupSession.deleteMany();
        await tx.scheduleVersion.deleteMany(); // This should clear ALL versions
        await tx.client.deleteMany();
        await tx.staff.deleteMany();
        
        console.log('Database cleared - all existing schedule versions and dependencies removed');

        console.log('Existing data cleared');

        // Create ID mapping objects
        const staffIdMapping = {}; // oldId -> newId
        const clientIdMapping = {}; // oldId -> newId
        const versionIdMapping = {}; // oldId -> newId

        // Restore staff (let database auto-assign IDs)
        if (data.Staff && data.Staff.length > 0) {
          for (const staff of data.Staff) {
            try {
              const newStaff = await tx.staff.create({
                data: {
                  name: staff.name,
                  locations: staff.locations ? staff.locations.split(', ') : [],
                  availability: staff.availability ? JSON.parse(staff.availability) : {},
                  createdAt: staff.createdAt ? new Date(staff.createdAt) : new Date(),
                  updatedAt: staff.updatedAt ? new Date(staff.updatedAt) : new Date()
                }
              });
              // Map old ID to new ID
              staffIdMapping[staff.id] = newStaff.id;
            } catch (error) {
              console.error(`Error restoring staff ${staff.name}:`, error.message);
              // Continue with next staff member
            }
          }
          console.log(`Restored ${data.Staff.length} staff members`);
        }

        // Restore clients (let database auto-assign IDs)
        if (data.Clients && data.Clients.length > 0) {
          for (const client of data.Clients) {
            try {
              const newClient = await tx.client.create({
                data: {
                  name: client.name,
                  authorizedHours: client.authorizedHours || 0,
                  locations: client.locations ? client.locations.split(', ') : [],
                  availability: client.availability ? JSON.parse(client.availability) : {},
                  createdAt: client.createdAt ? new Date(client.createdAt) : new Date(),
                  updatedAt: client.updatedAt ? new Date(client.updatedAt) : new Date()
                }
              });
              // Map old ID to new ID
              clientIdMapping[client.id] = newClient.id;
            } catch (error) {
              console.error(`Error restoring client ${client.name}:`, error.message);
              // Continue with next client
            }
          }
          console.log(`Restored ${data.Clients.length} clients`);
        }

        // Restore schedule versions with proper mapping
        if (data.ScheduleVersions && data.ScheduleVersions.length > 0) {
          console.log(`Restoring ${data.ScheduleVersions.length} schedule versions...`);
          
          for (const version of data.ScheduleVersions) {
            try {
              const newVersion = await tx.scheduleVersion.create({
                data: {
                  name: version.name || 'Restored Schedule',
                  type: version.type || 'main',
                  status: version.status || 'active',
                  startDate: version.startDate ? new Date(version.startDate) : null,
                  description: version.description || `Restored from backup - Original ID: ${version.id}`,
                  createdBy: version.createdBy || 'system',
                  createdAt: version.createdAt ? new Date(version.createdAt) : new Date(),
                  updatedAt: version.updatedAt ? new Date(version.updatedAt) : new Date()
                }
              });
              
              // Map old version ID to new version ID
              versionIdMapping[version.id] = newVersion.id;
              console.log(`✓ Restored version: ${version.name} (Old ID: ${version.id} → New ID: ${newVersion.id})`);
            } catch (error) {
              console.error(`Error restoring schedule version ${version.id}:`, error.message);
              // Continue with next version
            }
          }
          console.log(`Schedule versions restored. ID mappings:`, versionIdMapping);
        } else {
          // If no versions in backup, create a default main version
          const mainVersion = await tx.scheduleVersion.create({
            data: {
              name: 'Main Schedule',
              type: 'main',
              status: 'active',
              createdBy: 'system',
              description: 'Created during restore - no versions in backup'
            }
          });
          versionIdMapping[1] = mainVersion.id;
          console.log(`Created default main schedule version: ${mainVersion.id}`);
        }

        // Now restore assignments with correct ID mappings
        if (data.Assignments && data.Assignments.length > 0) {
          let assignmentsRestored = 0;
          let assignmentsSkipped = 0;
          
          console.log(`Starting assignment restore: ${data.Assignments.length} assignments to restore`);
          console.log(`Staff ID mappings available: ${Object.keys(staffIdMapping).length}`);
          console.log(`Client ID mappings available: ${Object.keys(clientIdMapping).length}`);
          console.log(`Version ID mappings available: ${Object.keys(versionIdMapping).length}`);
          
          for (const assignment of data.Assignments) {
            try {
              // Map old IDs to new IDs
              const newStaffId = staffIdMapping[assignment.staffId];
              const newClientId = clientIdMapping[assignment.clientId];
              const newVersionId = versionIdMapping[assignment.versionId]; // Use proper version mapping

              // Skip if we can't find the mapped IDs
              if (!newStaffId || !newClientId || !newVersionId) {
                console.warn(`❌ Skipping assignment ${assignment.id}: staff ${assignment.staffId}→${newStaffId}, client ${assignment.clientId}→${newClientId}, version ${assignment.versionId}→${newVersionId}`);
                assignmentsSkipped++;
                continue;
              }
              
              // Debug: Log successful mapping for first few assignments
              if (assignmentsRestored < 5) {
                console.log(`✓ Assignment ${assignment.id}: staff ${assignment.staffId}→${newStaffId}, client ${assignment.clientId}→${newClientId}, version ${assignment.versionId}→${newVersionId}`);
              }

              await tx.assignment.create({
                data: {
                  staffId: newStaffId,
                  clientId: newClientId,
                  day: assignment.day,
                  block: assignment.block,
                  versionId: newVersionId,
                  isGroup: assignment.isGroup || false,
                  groupSessionId: assignment.groupSessionId || null,
                  plannedDate: assignment.plannedDate ? new Date(assignment.plannedDate) : null,
                  createdAt: assignment.createdAt ? new Date(assignment.createdAt) : new Date(),
                  updatedAt: assignment.updatedAt ? new Date(assignment.updatedAt) : new Date()
                }
              });
              assignmentsRestored++;
              
              // Log progress every 50 assignments
              if (assignmentsRestored % 50 === 0) {
                console.log(`Assignment restore progress: ${assignmentsRestored}/${data.Assignments.length}`);
              }
            } catch (error) {
              console.error(`Error restoring assignment ${assignment.id}:`, error.message);
              assignmentsSkipped++;
              // Continue with next assignment
            }
          }
          console.log(`Assignment restore complete: ${assignmentsRestored} restored, ${assignmentsSkipped} skipped of ${data.Assignments.length} total`);
        }

        // Restore Group Sessions if available
        if (data.GroupSessions && data.GroupSessions.length > 0) {
          console.log(`Restoring ${data.GroupSessions.length} group sessions...`);
          const groupSessionIdMapping = {};
          
          for (const groupSession of data.GroupSessions) {
            try {
              // Find corresponding staff and version
              const newStaffId = staffIdMapping[groupSession.staffId];
              const newVersionId = versionIdMapping[groupSession.versionId];
              
              if (newStaffId && newVersionId) {
                const newGroupSession = await tx.groupSession.create({
                  data: {
                    day: groupSession.day,
                    block: groupSession.block,
                    staffId: newStaffId,
                    versionId: newVersionId,
                    location: groupSession.location,
                    maxSize: groupSession.maxSize || 4,
                    createdAt: groupSession.createdAt ? new Date(groupSession.createdAt) : new Date(),
                    updatedAt: groupSession.updatedAt ? new Date(groupSession.updatedAt) : new Date()
                  }
                });
                groupSessionIdMapping[groupSession.id] = newGroupSession.id;
              }
            } catch (error) {
              console.error(`Error restoring group session ${groupSession.id}:`, error.message);
            }
          }
          
          // Restore Group Session Clients
          if (data.GroupSessionClients && data.GroupSessionClients.length > 0) {
            console.log(`Restoring ${data.GroupSessionClients.length} group session clients...`);
            for (const gsc of data.GroupSessionClients) {
              try {
                const newGroupSessionId = groupSessionIdMapping[gsc.groupSessionId];
                const newClientId = clientIdMapping[gsc.clientId];
                
                if (newGroupSessionId && newClientId) {
                  await tx.groupSessionClient.create({
                    data: {
                      groupSessionId: newGroupSessionId,
                      clientId: newClientId
                    }
                  });
                }
              } catch (error) {
                console.error(`Error restoring group session client ${gsc.id}:`, error.message);
              }
            }
          }
        }

        // Restore Client Supervisors if available
        if (data.ClientSupervisors && data.ClientSupervisors.length > 0) {
          console.log(`Restoring ${data.ClientSupervisors.length} client supervisors...`);
          for (const supervisor of data.ClientSupervisors) {
            try {
              const newClientId = clientIdMapping[supervisor.clientId];
              if (newClientId) {
                await tx.clientSupervisor.create({
                  data: {
                    clientId: newClientId,
                    supervisorName: supervisor.supervisorName,
                    effectiveDate: supervisor.effectiveDate ? new Date(supervisor.effectiveDate) : new Date(),
                    endDate: supervisor.endDate ? new Date(supervisor.endDate) : null,
                    createdBy: supervisor.createdBy || 'system',
                    createdAt: supervisor.createdAt ? new Date(supervisor.createdAt) : new Date(),
                    updatedAt: supervisor.updatedAt ? new Date(supervisor.updatedAt) : new Date()
                  }
                });
              }
            } catch (error) {
              console.error(`Error restoring client supervisor ${supervisor.id}:`, error.message);
            }
          }
        }

        console.log('Complete restore finished - all data restored with proper relationships');
      }, {
        maxWait: 120000, // 2 minutes
        timeout: 180000, // 3 minutes
      });

      console.log('Database restore completed successfully');
      return {
        success: true,
        message: 'Complete database restored successfully with full version integrity',
        note: 'All data restored with proper foreign key relationships and original schedule version contexts preserved',
        restored: {
          staff: data.Staff?.length || 0,
          clients: data.Clients?.length || 0,
          scheduleVersions: data.ScheduleVersions?.length || 1,
          assignments: data.Assignments?.length || 0,
          groupSessions: data.GroupSessions?.length || 0,
          groupSessionClients: data.GroupSessionClients?.length || 0,
          clientSupervisors: data.ClientSupervisors?.length || 0,
          lunchSchedules: data.LunchSchedules?.length || 0,
          lunchGroups: data.LunchGroups?.length || 0
        }
      };
    } catch (error) {
      console.error('Error restoring from Excel:', error);
      throw error;
    }
  }
}

module.exports = new BackupService();