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

      // Validate required sheets
      const requiredSheets = ['Staff', 'Clients', 'Assignments', 'ScheduleVersions'];
      for (const sheet of requiredSheets) {
        if (!data[sheet]) {
          throw new Error(`Required sheet '${sheet}' not found in backup file`);
        }
      }

      console.log('Starting database restore transaction...');

      // Use transaction for data integrity
      await prisma.$transaction(async (tx) => {
        // Clear existing data (in reverse dependency order)
        await tx.lunchGroup.deleteMany();
        await tx.lunchSchedule.deleteMany();
        await tx.changeLog.deleteMany();
        await tx.dailyOverride.deleteMany();
        await tx.clientSupervisor.deleteMany();
        await tx.groupSessionClient.deleteMany();
        await tx.assignment.deleteMany();
        await tx.groupSession.deleteMany();
        await tx.scheduleVersion.deleteMany();
        await tx.client.deleteMany();
        await tx.staff.deleteMany();

        console.log('Existing data cleared');

        // Restore staff
        if (data.Staff && data.Staff.length > 0) {
          for (const staff of data.Staff) {
            await tx.staff.create({
              data: {
                id: staff.id,
                name: staff.name,
                email: staff.email || null,
                locations: staff.locations ? staff.locations.split(', ') : [],
                availability: staff.availability ? JSON.parse(staff.availability) : {},
                createdAt: staff.createdAt ? new Date(staff.createdAt) : new Date(),
                updatedAt: staff.updatedAt ? new Date(staff.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.Staff.length} staff members`);
        }

        // Restore clients
        if (data.Clients && data.Clients.length > 0) {
          for (const client of data.Clients) {
            await tx.client.create({
              data: {
                id: client.id,
                name: client.name,
                authorizedHours: client.authorizedHours || 0,
                locations: client.locations ? client.locations.split(', ') : [],
                availability: client.availability ? JSON.parse(client.availability) : {},
                createdAt: client.createdAt ? new Date(client.createdAt) : new Date(),
                updatedAt: client.updatedAt ? new Date(client.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.Clients.length} clients`);
        }

        // Restore schedule versions
        if (data.ScheduleVersions && data.ScheduleVersions.length > 0) {
          for (const version of data.ScheduleVersions) {
            await tx.scheduleVersion.create({
              data: {
                id: version.id,
                name: version.name,
                type: version.type || 'main',
                effectiveDate: version.effectiveDate ? new Date(version.effectiveDate) : null,
                isActive: version.isActive || false,
                createdBy: version.createdBy || 'system',
                createdAt: version.createdAt ? new Date(version.createdAt) : new Date(),
                updatedAt: version.updatedAt ? new Date(version.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.ScheduleVersions.length} schedule versions`);
        }

        // Restore group sessions
        if (data.GroupSessions && data.GroupSessions.length > 0) {
          for (const groupSession of data.GroupSessions) {
            await tx.groupSession.create({
              data: {
                id: groupSession.id,
                name: groupSession.name,
                location: groupSession.location,
                maxClients: groupSession.maxClients || 8,
                description: groupSession.description || null,
                createdAt: groupSession.createdAt ? new Date(groupSession.createdAt) : new Date(),
                updatedAt: groupSession.updatedAt ? new Date(groupSession.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.GroupSessions.length} group sessions`);
        }

        // Restore assignments
        if (data.Assignments && data.Assignments.length > 0) {
          for (const assignment of data.Assignments) {
            await tx.assignment.create({
              data: {
                id: assignment.id,
                staffId: assignment.staffId,
                clientId: assignment.clientId,
                day: assignment.day,
                block: assignment.block,
                versionId: assignment.versionId,
                isGroup: assignment.isGroup || false,
                groupSessionId: assignment.groupSessionId || null,
                createdAt: assignment.createdAt ? new Date(assignment.createdAt) : new Date(),
                updatedAt: assignment.updatedAt ? new Date(assignment.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.Assignments.length} assignments`);
        }

        // Restore group session clients
        if (data.GroupSessionClients && data.GroupSessionClients.length > 0) {
          for (const gsc of data.GroupSessionClients) {
            await tx.groupSessionClient.create({
              data: {
                id: gsc.id,
                groupSessionId: gsc.groupSessionId,
                clientId: gsc.clientId,
                createdAt: gsc.createdAt ? new Date(gsc.createdAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.GroupSessionClients.length} group session clients`);
        }

        // Restore client supervisors
        if (data.ClientSupervisors && data.ClientSupervisors.length > 0) {
          for (const cs of data.ClientSupervisors) {
            await tx.clientSupervisor.create({
              data: {
                id: cs.id,
                clientId: cs.clientId,
                supervisorName: cs.supervisorName,
                effectiveDate: cs.effectiveDate ? new Date(cs.effectiveDate) : new Date(),
                endDate: cs.endDate ? new Date(cs.endDate) : null,
                createdAt: cs.createdAt ? new Date(cs.createdAt) : new Date(),
                updatedAt: cs.updatedAt ? new Date(cs.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.ClientSupervisors.length} client supervisors`);
        }

        // Restore daily overrides
        if (data.DailyOverrides && data.DailyOverrides.length > 0) {
          for (const override of data.DailyOverrides) {
            await tx.dailyOverride.create({
              data: {
                id: override.id,
                date: override.date ? new Date(override.date) : new Date(),
                type: override.type,
                day: override.day,
                block: override.block || null,
                originalStaffId: override.originalStaffId || null,
                originalClientId: override.originalClientId || null,
                newStaffId: override.newStaffId || null,
                newClientId: override.newClientId || null,
                reason: override.reason || null,
                hours: override.hours || null,
                createdBy: override.createdBy || 'system',
                createdAt: override.createdAt ? new Date(override.createdAt) : new Date(),
                updatedAt: override.updatedAt ? new Date(override.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.DailyOverrides.length} daily overrides`);
        }

        // Restore lunch schedules
        if (data.LunchSchedules && data.LunchSchedules.length > 0) {
          for (const ls of data.LunchSchedules) {
            await tx.lunchSchedule.create({
              data: {
                id: ls.id,
                date: ls.date ? new Date(ls.date) : new Date(),
                location: ls.location,
                timePeriod: ls.timePeriod || '12:30-1:00',
                createdBy: ls.createdBy || 'system',
                createdAt: ls.createdAt ? new Date(ls.createdAt) : new Date(),
                modifiedBy: ls.modifiedBy || null,
                modifiedAt: ls.modifiedAt ? new Date(ls.modifiedAt) : null
              }
            });
          }
          console.log(`Restored ${data.LunchSchedules.length} lunch schedules`);
        }

        // Restore lunch groups
        if (data.LunchGroups && data.LunchGroups.length > 0) {
          for (const lg of data.LunchGroups) {
            await tx.lunchGroup.create({
              data: {
                id: lg.id,
                lunchScheduleId: lg.lunchScheduleId,
                primaryStaff: lg.primaryStaff || '',
                helpers: lg.helpers ? lg.helpers.split(', ') : [],
                clientIds: lg.clientIds ? lg.clientIds.split(', ').map(id => parseInt(id)).filter(id => !isNaN(id)) : [],
                color: lg.color || '#3B82F6'
              }
            });
          }
          console.log(`Restored ${data.LunchGroups.length} lunch groups`);
        }

        // Restore change logs
        if (data.ChangeLogs && data.ChangeLogs.length > 0) {
          for (const cl of data.ChangeLogs) {
            await tx.changeLog.create({
              data: {
                id: cl.id,
                versionId: cl.versionId,
                action: cl.action,
                entityType: cl.entityType,
                entityId: cl.entityId || null,
                oldValues: cl.oldValues ? JSON.parse(cl.oldValues) : null,
                newValues: cl.newValues ? JSON.parse(cl.newValues) : null,
                reason: cl.reason || null,
                reviewed: cl.reviewed || false,
                reviewedAt: cl.reviewedAt ? new Date(cl.reviewedAt) : null,
                reviewedBy: cl.reviewedBy || null,
                createdBy: cl.createdBy || 'system',
                createdAt: cl.createdAt ? new Date(cl.createdAt) : new Date(),
                updatedAt: cl.updatedAt ? new Date(cl.updatedAt) : new Date()
              }
            });
          }
          console.log(`Restored ${data.ChangeLogs.length} change logs`);
        }
      });

      console.log('Database restore completed successfully');
      return {
        success: true,
        message: 'Database restored successfully',
        restored: {
          staff: data.Staff?.length || 0,
          clients: data.Clients?.length || 0,
          assignments: data.Assignments?.length || 0,
          scheduleVersions: data.ScheduleVersions?.length || 0,
          groupSessions: data.GroupSessions?.length || 0,
          dailyOverrides: data.DailyOverrides?.length || 0,
          changeLogs: data.ChangeLogs?.length || 0,
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