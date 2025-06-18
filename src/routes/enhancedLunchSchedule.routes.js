const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Get lunch schedule for a specific date and location
router.get('/', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ error: 'Date and location are required' });
    }

    const lunchSchedule = await prisma.lunchSchedule.findUnique({
      where: {
        date_location: {
          date: new Date(date),
          location: location
        }
      },
      include: {
        timeBlocks: {
          include: {
            groups: {
              include: {
                clients: {
                  include: {
                    client: {
                      select: {
                        id: true,
                        name: true,
                        locations: true
                      }
                    }
                  },
                  orderBy: {
                    displayOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      }
    });

    if (!lunchSchedule) {
      // Create default lunch schedule with default time block
      const newLunchSchedule = await prisma.lunchSchedule.create({
        data: {
          date: new Date(date),
          location: location,
          createdBy: 'system',
          timeBlocks: {
            create: {
              startTime: '12:30',
              endTime: '13:00',
              label: 'Lunch'
            }
          }
        },
        include: {
          timeBlocks: {
            include: {
              groups: {
                include: {
                  clients: {
                    include: {
                      client: {
                        select: {
                          id: true,
                          name: true,
                          locations: true
                        }
                      }
                    },
                    orderBy: {
                      displayOrder: 'asc'
                    }
                  }
                }
              }
            },
            orderBy: {
              startTime: 'asc'
            }
          }
        }
      });

      return res.json(newLunchSchedule);
    }

    res.json(lunchSchedule);
  } catch (error) {
    console.error('Error fetching lunch schedule:', error);
    res.status(500).json({ error: 'Failed to fetch lunch schedule' });
  }
});

// Create or update lunch schedule
router.post('/', async (req, res) => {
  try {
    const { date, location, timeBlocks, createdBy, overrides } = req.body;
    
    if (!date || !location || !timeBlocks || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Extract override data (default to empty arrays if not provided)
    const manuallyMovedToAvailable = overrides?.manuallyMovedToAvailable || [];
    const manualStayWithStaff = overrides?.manualStayWithStaff || [];
    const excludedClients = overrides?.excludedClients || [];

    // Delete existing lunch schedule and recreate
    await prisma.lunchSchedule.deleteMany({
      where: {
        date: new Date(date),
        location: location
      }
    });

    // Try to create with override fields first, fallback to without them if schema doesn't support them
    let lunchSchedule;
    
    try {
      lunchSchedule = await prisma.lunchSchedule.create({
        data: {
          date: new Date(date),
          location: location,
          createdBy: createdBy,
          manuallyMovedToAvailable: manuallyMovedToAvailable,
          manualStayWithStaff: manualStayWithStaff,
          excludedClients: excludedClients,
          timeBlocks: {
            create: timeBlocks.map(timeBlock => ({
              startTime: timeBlock.startTime,
              endTime: timeBlock.endTime,
              label: timeBlock.label,
              groups: {
                create: timeBlock.groups.map(group => ({
                  primaryStaff: group.primaryStaff,
                  helpers: group.helpers || [],
                  roomLocation: group.roomLocation,
                  groupName: group.groupName,
                  color: group.color || '#3B82F6',
                  clients: {
                    create: group.clients.map((client, index) => ({
                      clientId: client.clientId,
                      hasAfternoonSession: client.hasAfternoonSession || false,
                      afternoonSessionNote: client.afternoonSessionNote,
                      displayOrder: index
                    }))
                  }
                }))
              }
            }))
          }
        },
      include: {
        timeBlocks: {
          include: {
            groups: {
              include: {
                clients: {
                  include: {
                    client: {
                      select: {
                        id: true,
                        name: true,
                        locations: true
                      }
                    }
                  },
                  orderBy: {
                    displayOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      }
      });
    } catch (schemaError) {
      // Fallback: create without override fields if they don't exist in schema
      console.log('Override fields not available in schema, creating without them:', schemaError.message);
      
      lunchSchedule = await prisma.lunchSchedule.create({
        data: {
          date: new Date(date),
          location: location,
          createdBy: createdBy,
          timeBlocks: {
            create: timeBlocks.map(timeBlock => ({
              startTime: timeBlock.startTime,
              endTime: timeBlock.endTime,
              label: timeBlock.label,
              groups: {
                create: timeBlock.groups.map(group => ({
                  primaryStaff: group.primaryStaff,
                  helpers: group.helpers || [],
                  roomLocation: group.roomLocation,
                  groupName: group.groupName,
                  color: group.color || '#3B82F6',
                  clients: {
                    create: group.clients.map((client, index) => ({
                      clientId: client.clientId,
                      hasAfternoonSession: client.hasAfternoonSession || false,
                      afternoonSessionNote: client.afternoonSessionNote,
                      displayOrder: index
                    }))
                  }
                }))
              }
            }))
          }
        },
        include: {
          timeBlocks: {
            include: {
              groups: {
                include: {
                  clients: {
                    include: {
                      client: {
                        select: {
                          id: true,
                          name: true,
                          locations: true
                        }
                      }
                    },
                    orderBy: {
                      displayOrder: 'asc'
                    }
                  }
                }
              }
            },
            orderBy: {
              startTime: 'asc'
            }
          }
        }
      });
    }

    res.json(lunchSchedule);
  } catch (error) {
    console.error('Error saving lunch schedule:', error);
    res.status(500).json({ error: 'Failed to save lunch schedule' });
  }
});

// Finalize lunch schedule
router.post('/:id/finalize', async (req, res) => {
  try {
    const { id } = req.params;
    const { finalizedBy } = req.body;

    if (!finalizedBy) {
      return res.status(400).json({ error: 'finalizedBy is required' });
    }

    const lunchSchedule = await prisma.lunchSchedule.update({
      where: { id: parseInt(id) },
      data: {
        isFinalized: true,
        finalizedBy: finalizedBy,
        finalizedAt: new Date(),
        modifiedAfterFinalization: false
      }
    });

    res.json(lunchSchedule);
  } catch (error) {
    console.error('Error finalizing lunch schedule:', error);
    res.status(500).json({ error: 'Failed to finalize lunch schedule' });
  }
});

// Unlock lunch schedule
router.post('/:id/unlock', async (req, res) => {
  try {
    const { id } = req.params;

    const lunchSchedule = await prisma.lunchSchedule.update({
      where: { id: parseInt(id) },
      data: {
        isFinalized: false,
        finalizedBy: null,
        finalizedAt: null,
        modifiedAfterFinalization: false
      }
    });

    res.json(lunchSchedule);
  } catch (error) {
    console.error('Error unlocking lunch schedule:', error);
    res.status(500).json({ error: 'Failed to unlock lunch schedule' });
  }
});

// Update after finalization (for tracking modifications)
router.post('/:id/modify-after-finalization', async (req, res) => {
  try {
    const { id } = req.params;
    const { modifiedBy } = req.body;

    if (!modifiedBy) {
      return res.status(400).json({ error: 'modifiedBy is required' });
    }

    const lunchSchedule = await prisma.lunchSchedule.update({
      where: { id: parseInt(id) },
      data: {
        modifiedAfterFinalization: true,
        lastModifiedBy: modifiedBy,
        lastModifiedAt: new Date()
      }
    });

    // TODO: Send Teams notification about modification after finalization
    // This would integrate with the Teams webhook system

    res.json(lunchSchedule);
  } catch (error) {
    console.error('Error tracking post-finalization modification:', error);
    res.status(500).json({ error: 'Failed to track modification' });
  }
});

// Get available clients for lunch (those with AM assignments but not in lunch groups yet)
router.get('/available-clients', async (req, res) => {
  try {
    const { date, location } = req.query;
    
    if (!date || !location) {
      return res.status(400).json({ error: 'Date and location are required' });
    }

    // Get day of week from date
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
    
    // Find clients with AM assignments at this location
    const clientsWithAMAssignments = await prisma.assignment.findMany({
      where: {
        day: dayOfWeek,
        block: 'AM',
        version: {
          type: 'main'
        },
        client: {
          locations: {
            has: location
          }
        }
      },
      include: {
        client: true,
        staff: true
      }
    });

    // Find clients already in lunch groups for this date/location AND get override data
    const existingLunchSchedule = await prisma.lunchSchedule.findUnique({
      where: {
        date_location: {
          date: new Date(date),
          location: location
        }
      },
      include: {
        timeBlocks: {
          include: {
            groups: {
              include: {
                clients: true
              }
            }
          }
        }
      }
    });

    const clientsInLunchGroups = new Set();
    
    // Extract override data from existing lunch schedule (default to empty arrays if no schedule or fields don't exist)
    const manuallyMovedToAvailable = existingLunchSchedule?.manuallyMovedToAvailable || [];
    const manualStayWithStaff = existingLunchSchedule?.manualStayWithStaff || [];
    const excludedClients = existingLunchSchedule?.excludedClients || [];
    
    if (existingLunchSchedule) {
      existingLunchSchedule.timeBlocks.forEach(timeBlock => {
        timeBlock.groups.forEach(group => {
          group.clients.forEach(client => {
            clientsInLunchGroups.add(client.clientId);
          });
        });
      });
    }

    // Deduplicate clients and collect their staff assignments
    const uniqueClientsMap = new Map();
    const clientStaffMap = new Map(); // Track which staff are assigned to each client
    
    clientsWithAMAssignments.forEach(assignment => {
      if (!uniqueClientsMap.has(assignment.clientId)) {
        uniqueClientsMap.set(assignment.clientId, assignment.client);
        clientStaffMap.set(assignment.clientId, []);
      }
      clientStaffMap.get(assignment.clientId).push(assignment.staff);
    });

    // Check which staff have NO PM assignments at this location on this day
    const allStaffIds = [...new Set(clientsWithAMAssignments.map(a => a.staffId))];
    const staffWithNoPM = new Set();
    
    for (const staffId of allStaffIds) {
      const hasPMAssignment = await prisma.assignment.findFirst({
        where: {
          staffId: staffId,
          day: dayOfWeek,
          block: 'PM',
          version: {
            type: 'main'
          }
        }
      });
      
      if (!hasPMAssignment) {
        staffWithNoPM.add(staffId);
      }
    }

    // Filter out clients already in lunch groups and check for afternoon sessions
    const availableClients = [];
    const shouldStayWithStaff = []; // Clients who should automatically stay with staff
    
    for (const [clientId, client] of uniqueClientsMap) {
      if (!clientsInLunchGroups.has(clientId)) {
        // Skip excluded clients entirely
        if (excludedClients.includes(clientId)) {
          continue;
        }
        
        // Check if client has PM assignment
        const hasPMAssignment = await prisma.assignment.findFirst({
          where: {
            clientId: clientId,
            day: dayOfWeek,
            block: 'PM',
            version: {
              type: 'main'
            }
          }
        });

        const clientStaff = clientStaffMap.get(clientId);
        
        // Check manual overrides first
        if (manualStayWithStaff.includes(clientId)) {
          // Manually set to stay with staff
          shouldStayWithStaff.push({
            id: client.id,
            name: client.name,
            locations: client.locations,
            hasAfternoonSession: !!hasPMAssignment,
            staff: clientStaff.map(s => ({ id: s.id, name: s.name }))
          });
        } else if (manuallyMovedToAvailable.includes(clientId)) {
          // Manually moved to available (override auto-detection)
          availableClients.push({
            id: client.id,
            name: client.name,
            locations: client.locations,
            hasAfternoonSession: !!hasPMAssignment,
            staff: clientStaff.map(s => ({ id: s.id, name: s.name }))
          });
        } else {
          // Check if ALL of this client's staff have no PM assignments (auto-detection)
          const allStaffHaveNoPM = clientStaff.every(staff => staffWithNoPM.has(staff.id));
          
          if (allStaffHaveNoPM) {
            // This client should automatically stay with their staff through lunch
            shouldStayWithStaff.push({
              id: client.id,
              name: client.name,
              locations: client.locations,
              hasAfternoonSession: !!hasPMAssignment,
              staff: clientStaff.map(s => ({ id: s.id, name: s.name }))
            });
          } else {
            // Regular available client
            availableClients.push({
              id: client.id,
              name: client.name,
              locations: client.locations,
              hasAfternoonSession: !!hasPMAssignment,
              staff: clientStaff.map(s => ({ id: s.id, name: s.name }))
            });
          }
        }
      }
    }

    res.json({
      availableClients,
      shouldStayWithStaff,
      overrides: {
        manuallyMovedToAvailable,
        manualStayWithStaff,
        excludedClients
      }
    });
  } catch (error) {
    console.error('Error fetching available clients:', error);
    res.status(500).json({ error: 'Failed to fetch available clients' });
  }
});

// Export lunch schedule as formatted text
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;

    const lunchSchedule = await prisma.lunchSchedule.findUnique({
      where: { id: parseInt(id) },
      include: {
        timeBlocks: {
          include: {
            groups: {
              include: {
                clients: {
                  include: {
                    client: {
                      select: {
                        id: true,
                        name: true
                      }
                    }
                  },
                  orderBy: {
                    displayOrder: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            startTime: 'asc'
          }
        }
      }
    });

    if (!lunchSchedule) {
      return res.status(404).json({ error: 'Lunch schedule not found' });
    }

    // Format for Teams/copy-paste
    const dateStr = new Date(lunchSchedule.date).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let formatted = `🍽️ Lunch Schedule - ${dateStr}\n`;
    formatted += `📍 Location: ${lunchSchedule.location}\n\n`;

    if (lunchSchedule.isFinalized) {
      formatted += `✅ Finalized by ${lunchSchedule.finalizedBy}\n\n`;
    }

    lunchSchedule.timeBlocks.forEach((timeBlock, timeIndex) => {
      if (lunchSchedule.timeBlocks.length > 1) {
        formatted += `⏰ ${timeBlock.label || `Time Block ${timeIndex + 1}`} (${timeBlock.startTime}-${timeBlock.endTime})\n`;
      } else {
        formatted += `⏰ Lunch Time: ${timeBlock.startTime}-${timeBlock.endTime}\n`;
      }

      timeBlock.groups.forEach((group, groupIndex) => {
        const groupNum = groupIndex + 1;
        formatted += `\n🔸 Group ${groupNum}`;
        if (group.roomLocation) {
          formatted += ` - ${group.roomLocation}`;
        }
        formatted += `\n`;
        formatted += `👩‍🏫 Staff: ${group.primaryStaff}`;
        if (group.helpers && group.helpers.length > 0) {
          formatted += `, Helpers: ${group.helpers.join(', ')}`;
        }
        formatted += `\n`;

        if (group.clients.length > 0) {
          formatted += `👶 Clients: `;
          const clientStrings = group.clients.map(clientAssignment => {
            const indicator = clientAssignment.hasAfternoonSession ? '[PM]' : '[HOME]';
            return `${clientAssignment.client.name} ${indicator}`;
          });
          formatted += clientStrings.join(', ');
          formatted += `\n`;
        }
      });

      formatted += `\n`;
    });

    formatted += `\n📝 [HOME] = Goes home after lunch\n📝 [PM] = Has afternoon session`;

    res.json({ 
      formatted: formatted,
      isFinalized: lunchSchedule.isFinalized,
      finalizedBy: lunchSchedule.finalizedBy,
      modifiedAfterFinalization: lunchSchedule.modifiedAfterFinalization
    });
  } catch (error) {
    console.error('Error exporting lunch schedule:', error);
    res.status(500).json({ error: 'Failed to export lunch schedule' });
  }
});

module.exports = router;