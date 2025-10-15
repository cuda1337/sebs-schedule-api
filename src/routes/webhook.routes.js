const express = require('express');
const router = express.Router();

// Teams webhook endpoint for client cancellations
router.post('/teams/client-update', async (req, res) => {
  try {
    let { message, sender, timestamp } = req.body;
    const prisma = req.prisma;
    
    // Check if this is a chat notification format
    let actualMessage = message;
    let actualSender = sender;
    
    try {
      // Try to parse as JSON
      const messageData = typeof message === 'string' ? JSON.parse(message) : message;
      
      // First check if it's an array (chat notification format)
      if (Array.isArray(messageData) && messageData[0]?.resource) {
        // This is a chat notification - we only have metadata, not the actual message
        console.log('📱 Chat notification received - message content not included');
        return res.json({
          success: false,
          message: 'Chat notifications require Power Automate to fetch message content separately',
          hint: 'Use "Get message details" action in Power Automate after the trigger'
        });
      }
      
      // Check if this is the full HTTP response from Power Automate (with statusCode, headers, body)
      if (messageData.statusCode && messageData.body && messageData.body.body) {
        // This is the full HTTP response - extract the actual message from nested body
        const actualMessageData = messageData.body;
        if (actualMessageData.body && actualMessageData.body.plainTextContent) {
          actualMessage = actualMessageData.body.plainTextContent.replace(/&nbsp;/g, ' ').trim();
          actualSender = actualMessageData.from?.user?.displayName || sender;
        }
      } else if (messageData.body && typeof messageData.body === 'object' && messageData.body.plainTextContent) {
        // This is the full message details from "Get message details" action
        actualMessage = messageData.body.plainTextContent.replace(/&nbsp;/g, ' ').trim();
        actualSender = messageData.from?.user?.displayName || sender;
      } else if (messageData.body && messageData.body.content) {
        // Otherwise check for channel message format
        actualMessage = messageData.body.content.replace(/<[^>]*>/g, '').trim();
        actualSender = messageData.from?.user?.displayName || sender;
      }
    } catch (e) {
      // Not JSON, use original message
    }
    
    console.log('📨 Teams webhook received:', {
      originalMessage: message,
      parsedMessage: actualMessage,
      sender: actualSender,
      timestamp,
      body: req.body,
      fullRequest: JSON.stringify(req.body, null, 2)
    });

    // Get all clients to match against
    const allClients = await prisma.client.findMany({
      select: { id: true, name: true }
    });
    
    // Parse the message for cancellation patterns
    const cancellationInfo = parseClientCancellation(actualMessage, allClients);
    
    if (cancellationInfo) {
      console.log('✅ Parsed cancellation:', cancellationInfo);
      
      // Handle both single cancellation and multiple cancellations
      const cancellations = Array.isArray(cancellationInfo) ? cancellationInfo : [cancellationInfo];
      const overrides = [];
      
      // Create daily override for each cancellation
      for (const cancellation of cancellations) {
        const override = await prisma.dailyOverride.create({
          data: {
            date: cancellation.date,
            type: 'cancellation',
            day: cancellation.day,
            block: cancellation.block || '',
            originalClientId: cancellation.clientId,
            reason: `Client cancellation via Teams: ${actualMessage}`,
            createdBy: actualSender || 'teams-webhook',
          },
          include: {
            originalClient: true,
          }
        });

        overrides.push(override);
        console.log(`💾 Created override for ${cancellation.clientName} (${cancellation.block}):`, override.id);
      }
      
      res.json({
        success: true,
        message: `${overrides.length} client cancellation(s) processed`,
        count: overrides.length,
        overrides: overrides.map(override => ({
          id: override.id,
          clientId: override.originalClientId,
          clientName: override.originalClient?.name,
          date: override.date,
          block: override.block,
          reason: override.reason
        }))
      });
    } else {
      console.log('❌ Could not parse cancellation from message');
      res.json({
        success: false,
        message: 'Could not parse cancellation information',
        receivedMessage: message
      });
    }
  } catch (error) {
    console.error('❌ Teams webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Unknown error'
    });
  }
});

// Staff callout webhook (for future Gusto integration)
router.post('/gusto/staff-pto', async (req, res) => {
  try {
    console.log('📨 Gusto webhook received:', req.body);
    
    // TODO: Implement Gusto PTO processing
    res.json({
      success: true,
      message: 'Gusto webhook received (not implemented yet)'
    });
  } catch (error) {
    console.error('❌ Gusto webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// View recent daily overrides (for testing)
router.get('/recent-overrides', async (req, res) => {
  try {
    const prisma = req.prisma;
    const overrides = await prisma.dailyOverride.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        originalClient: true,
        originalStaff: true,
      }
    });

    res.json({
      success: true,
      count: overrides.length,
      overrides: overrides.map(override => ({
        id: override.id,
        type: override.type,
        date: override.date,
        day: override.day,
        block: override.block,
        reason: override.reason,
        client: override.originalClient?.name || 'Unknown',
        createdBy: override.createdBy,
        createdAt: override.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching overrides:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch overrides' });
  }
});

// Health check for webhooks
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    webhooks: ['teams/client-update', 'gusto/staff-pto', 'test/echo'],
    timestamp: new Date().toISOString()
  });
});

// Test endpoint to echo back what Power Automate sends
router.post('/test/echo', (req, res) => {
  console.log('🔍 Test webhook received:');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  res.json({
    success: true,
    received: req.body,
    headers: req.headers,
    bodyType: typeof req.body,
    bodyKeys: Object.keys(req.body || {}),
    rawBody: req.body
  });
});

// Helper function to parse client cancellation messages - Enhanced for multiple clients
function parseClientCancellation(message, allClients) {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  // Look for cancellation keywords (including "canx")
  const cancellationKeywords = ['cancel', 'cancelled', 'canceling', 'canx', 'not coming', 'sick', 'absent'];
  const hasCancellation = cancellationKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (!hasCancellation) return null;

  // Find ALL matching clients (support for multiple clients in one message)
  const foundClients = [];
  
  // First pass: Find clients by full name
  for (const client of allClients) {
    if (lowerMessage.includes(client.name.toLowerCase())) {
      foundClients.push(client);
      console.log(`✅ Found client by full name: ${client.name}`);
    }
  }
  
  // Second pass: Find clients by initials (only if no full names found to avoid conflicts)
  if (foundClients.length === 0) {
    // Create a map of all possible initials to avoid duplicates
    const initialsMap = new Map();
    
    for (const client of allClients) {
      const clientName = client.name.toLowerCase();
      const nameParts = clientName.split(' ');
      
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        
        if (firstName.length >= 2 && lastName.length >= 2) {
          const initials = (firstName.substring(0, 2) + lastName.substring(0, 2)).toLowerCase();
          
          // Store in map to detect conflicts
          if (!initialsMap.has(initials)) {
            initialsMap.set(initials, []);
          }
          initialsMap.get(initials).push(client);
        }
      }
    }
    
    // Look for initials patterns in the message
    for (const [initials, clients] of initialsMap) {
      if (lowerMessage.includes(initials)) {
        if (clients.length === 1) {
          foundClients.push(clients[0]);
          console.log(`✅ Found client by initials: "${initials}" → ${clients[0].name}`);
        } else {
          console.log(`⚠️ Ambiguous initials "${initials}" matches multiple clients:`, clients.map(c => c.name).join(', '));
          // For now, take the first match but log the ambiguity
          foundClients.push(clients[0]);
          console.log(`📝 Using first match: ${clients[0].name}`);
        }
      }
    }
  }
  
  // Enhanced: Also look for patterns like "IsHa/ZaHa" or "IsHa and ZaHa"
  const initialsPattern = /([a-z]{4})[\/\s,&and]+([a-z]{4})/gi;
  const initialsMatches = lowerMessage.match(initialsPattern);
  if (initialsMatches && foundClients.length === 0) {
    console.log('🔍 Found potential initials pattern:', initialsMatches);
    for (const match of initialsMatches) {
      const parts = match.toLowerCase().split(/[\/\s,&and]+/);
      for (const part of parts) {
        if (part.length === 4) {
          // Look for this 4-character initials pattern
          for (const client of allClients) {
            const clientName = client.name.toLowerCase();
            const nameParts = clientName.split(' ');
            
            if (nameParts.length >= 2) {
              const firstName = nameParts[0];
              const lastName = nameParts[nameParts.length - 1];
              
              if (firstName.length >= 2 && lastName.length >= 2) {
                const initials = (firstName.substring(0, 2) + lastName.substring(0, 2)).toLowerCase();
                
                if (initials === part.trim()) {
                  if (!foundClients.find(c => c.id === client.id)) {
                    foundClients.push(client);
                    console.log(`✅ Found client by pattern initials: "${part}" → ${client.name}`);
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }
  }
  
  if (foundClients.length === 0) {
    console.log('❌ No client names found in message (tried full names and initials):', message);
    console.log('📝 Available clients:', allClients.map(c => c.name).join(', '));
    return null;
  }
  
  console.log(`📋 Found ${foundClients.length} client(s):`, foundClients.map(c => c.name).join(', '));

  // Try to extract date(s) - look for "today", "tomorrow", specific dates
  // Use Eastern timezone for date calculations
  const now = new Date();
  const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));

  const today = new Date(easternTime.getFullYear(), easternTime.getMonth(), easternTime.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  let targetDates = []; // Changed to array to support multiple dates

  if (lowerMessage.includes('tomorrow')) {
    targetDates = [tomorrow];
  } else if (lowerMessage.includes('today')) {
    targetDates = [today];
  } else {
    // Try to parse ALL specific dates in the message
    const datePatterns = [
      // "June 5th", "June 5"
      { regex: /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/gi, type: 'monthName' },
      // "6/5", "06/05"
      { regex: /(\d{1,2})\/(\d{1,2})/g, type: 'numeric' },
      // "6-5", "06-05"
      { regex: /(\d{1,2})-(\d{1,2})/g, type: 'numeric' }
    ];

    const foundDates = [];
    const currentYear = easternTime.getFullYear();

    for (const patternInfo of datePatterns) {
      const matches = [...message.matchAll(patternInfo.regex)];

      for (const match of matches) {
        let parsedDate = null;

        if (patternInfo.type === 'monthName') {
          // Month name pattern - extract month and day
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                             'july', 'august', 'september', 'october', 'november', 'december'];
          const monthName = match[0].split(' ')[0].toLowerCase();
          const monthIndex = monthNames.indexOf(monthName);
          const day = parseInt(match[1]);

          if (monthIndex !== -1 && day >= 1 && day <= 31) {
            parsedDate = new Date(currentYear, monthIndex, day);
          }
        } else {
          // Numeric pattern - assume MM/DD or MM-DD
          const month = parseInt(match[1]) - 1; // Convert to 0-based
          const day = parseInt(match[2]);

          if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            parsedDate = new Date(currentYear, month, day);
          }
        }

        // Only include dates that are today or in the future
        if (parsedDate && parsedDate >= today) {
          // Check for duplicates before adding
          const isDuplicate = foundDates.some(d => d.getTime() === parsedDate.getTime());
          if (!isDuplicate) {
            foundDates.push(parsedDate);
          }
        }
      }
    }

    if (foundDates.length > 0) {
      targetDates = foundDates;
      console.log(`📅 Found ${foundDates.length} date(s):`, foundDates.map(d => d.toDateString()).join(', '));
    } else {
      // Default to today if no dates found
      targetDates = [today];
    }
  }

  // Try to extract time block (AM/PM) - Enhanced logic
  let blocks = [];
  if (lowerMessage.includes('afternoon') || lowerMessage.includes('pm')) {
    blocks = ['PM'];
  } else if (lowerMessage.includes('morning') || lowerMessage.includes('am')) {
    blocks = ['AM'];
  } else if (lowerMessage.includes('all day') || lowerMessage.includes('full day')) {
    blocks = ['AM', 'PM'];
  } else {
    // Default to both AM and PM if no specific time mentioned
    // This addresses the issue where cancellations should affect both time slots
    blocks = ['AM', 'PM'];
    console.log('⚠️ No specific time mentioned, defaulting to both AM and PM');
  }

  // Return array of cancellation info for each DATE, each CLIENT, and each TIME BLOCK combination
  const cancellations = [];
  for (const targetDate of targetDates) {
    const dayOfWeek = getDayOfWeek(targetDate);
    for (const client of foundClients) {
      for (const block of blocks) {
        cancellations.push({
          clientName: client.name,
          clientId: client.id,
          date: targetDate,
          day: dayOfWeek,
          block,
          originalMessage: message
        });
      }
    }
  }

  // For backward compatibility, return single object if only one cancellation
  if (cancellations.length === 1) {
    return cancellations[0];
  }
  
  // Return multiple cancellations
  return cancellations;
}

// Gusto webhook endpoint for staff time-off requests
router.post('/email/gusto-timeoff', async (req, res) => {
  try {
    const { subject, body, from, received } = req.body;
    const prisma = req.prisma;
    
    console.log('📧 Gusto time-off email received:', { subject, from });
    
    // Verify this is from Gusto
    if (!from || !from.includes('gustonoreply@gusto.com')) {
      console.log('❌ Email not from Gusto, ignoring');
      return res.json({ success: false, message: 'Email not from Gusto' });
    }
    
    // Parse the time-off request
    const timeOffInfo = parseGustoTimeOff(subject, body, prisma);
    
    if (!timeOffInfo) {
      console.log('❌ Could not parse time-off information from email');
      return res.json({ 
        success: false, 
        message: 'Could not parse time-off information',
        receivedSubject: subject
      });
    }
    
    console.log('✅ Parsed time-off info:', timeOffInfo);
    
    // Create staff override records for each date
    const overrides = [];
    for (const date of timeOffInfo.dates) {
      const dayOfWeek = getDayOfWeek(date);
      
      // Create override for AM block
      const amOverride = await prisma.dailyOverride.create({
        data: {
          date: date,
          type: 'callout',
          day: dayOfWeek,
          block: 'AM',
          originalStaffId: timeOffInfo.staffId,
          reason: `Gusto time-off request: ${timeOffInfo.originalSubject}`,
          createdBy: 'Gusto Integration',
          status: 'active'
        }
      });
      
      // Create override for PM block
      const pmOverride = await prisma.dailyOverride.create({
        data: {
          date: date,
          type: 'callout',
          day: dayOfWeek,
          block: 'PM',
          originalStaffId: timeOffInfo.staffId,
          reason: `Gusto time-off request: ${timeOffInfo.originalSubject}`,
          createdBy: 'Gusto Integration',
          status: 'active'
        }
      });
      
      overrides.push(amOverride, pmOverride);
    }
    
    console.log(`✅ Created ${overrides.length} staff override records`);
    
    res.json({
      success: true,
      message: 'Staff time-off request processed',
      overrides: overrides.map(o => ({
        id: o.id,
        date: o.date,
        day: o.day,
        block: o.block,
        staffId: o.originalStaffId
      }))
    });
    
  } catch (error) {
    console.error('❌ Error processing Gusto time-off:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process time-off request',
      error: error.message 
    });
  }
});

// Parse Gusto time-off email
async function parseGustoTimeOff(subject, body, prisma) {
  if (!subject) return null;
  
  console.log('🔍 Parsing Gusto subject:', subject);
  
  // Subject format: "John Smith is requesting time off from Southeast Behavioral Services for June 5, 2025"
  const subjectMatch = subject.match(/^([^,]+?)\s+is requesting time off.*?for\s+(.+)$/i);
  if (!subjectMatch) {
    console.log('❌ Subject does not match expected Gusto format');
    return null;
  }
  
  const staffName = subjectMatch[1].trim();
  const dateString = subjectMatch[2].trim();
  
  console.log('📝 Extracted staff name:', staffName);
  console.log('📅 Extracted date string:', dateString);
  
  // Find staff in database by exact name match
  const staff = await prisma.staff.findFirst({
    where: {
      name: {
        equals: staffName,
        mode: 'insensitive'
      }
    }
  });
  
  if (!staff) {
    console.log('❌ Staff not found in database:', staffName);
    return null;
  }
  
  console.log('✅ Found staff:', staff.name, 'ID:', staff.id);
  
  // Parse dates - handle single dates and date ranges
  const dates = parseDateRange(dateString);
  if (!dates || dates.length === 0) {
    console.log('❌ Could not parse dates from:', dateString);
    return null;
  }
  
  console.log('✅ Parsed dates:', dates.map(d => d.toDateString()));
  
  return {
    staffName: staff.name,
    staffId: staff.id,
    dates: dates,
    originalSubject: subject
  };
}

// Parse date range from Gusto email
function parseDateRange(dateString) {
  const dates = [];
  
  // Handle different date formats
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Handle date ranges like "June 5-7, 2025" or "June 5 - June 7, 2025"
  const rangeMatch = dateString.match(/(\w+\s+\d{1,2})(?:\s*-\s*|\s+through\s+|\s+to\s+)(\w+\s+\d{1,2}),?\s*(\d{4})?/i);
  if (rangeMatch) {
    const startDateStr = rangeMatch[1];
    const endDateStr = rangeMatch[2];
    const year = rangeMatch[3] ? parseInt(rangeMatch[3]) : currentYear;
    
    const startDate = parseDate(startDateStr + ', ' + year);
    const endDate = parseDate(endDateStr + ', ' + year);
    
    if (startDate && endDate) {
      // Add all dates in range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return dates;
    }
  }
  
  // Handle single date like "June 5, 2025" or "June 5"
  const singleDate = parseDate(dateString);
  if (singleDate) {
    dates.push(singleDate);
    return dates;
  }
  
  return null;
}

// Parse a single date string
function parseDate(dateString) {
  try {
    // Try parsing as-is first
    let date = new Date(dateString);
    
    // If no year specified, assume current year
    if (dateString.match(/^\w+\s+\d{1,2}$/)) {
      const currentYear = new Date().getFullYear();
      date = new Date(dateString + ', ' + currentYear);
    }
    
    // Validate the date
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Error parsing date:', dateString, error);
    return null;
  }
}

// Helper function to get day of week
function getDayOfWeek(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// CSV import endpoint for Gusto time-off reports
router.post('/import/gusto-csv', async (req, res) => {
  try {
    const { csvData, importOptions = {} } = req.body;
    const prisma = req.prisma;
    
    console.log('📊 Processing Gusto CSV import...');
    
    if (!csvData) {
      return res.status(400).json({ 
        success: false, 
        message: 'CSV data is required' 
      });
    }
    
    // Parse CSV data
    const parsedData = parseGustoCSV(csvData);
    console.log(`📝 Parsed ${parsedData.length} time-off records`);
    
    // Filter records based on options
    let filteredData = parsedData;
    
    // Only process approved requests by default
    if (importOptions.onlyApproved !== false) {
      filteredData = filteredData.filter(record => 
        record.status?.toLowerCase() === 'approved'
      );
    }
    
    // Date range filter
    if (importOptions.startDate || importOptions.endDate) {
      filteredData = filteredData.filter(record => {
        if (!record.dates || record.dates.length === 0) return false;
        
        const recordStartDate = record.dates[0];
        const recordEndDate = record.dates[record.dates.length - 1];
        
        if (importOptions.startDate) {
          const filterStart = new Date(importOptions.startDate);
          if (recordEndDate < filterStart) return false;
        }
        
        if (importOptions.endDate) {
          const filterEnd = new Date(importOptions.endDate);
          if (recordStartDate > filterEnd) return false;
        }
        
        return true;
      });
    }
    
    console.log(`🔍 Filtered to ${filteredData.length} records for import`);
    
    // STEP 1: Determine the date range of the import data
    let importStartDate = null;
    let importEndDate = null;
    let deleteResult = { count: 0 }; // Initialize with default value
    
    if (filteredData.length > 0) {
      const allDates = filteredData.flatMap(record => record.dates || []);
      if (allDates.length > 0) {
        importStartDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        importEndDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        
        console.log(`📅 Import date range: ${importStartDate.toDateString()} to ${importEndDate.toDateString()}`);
        
        // STEP 2: Delete all existing Gusto entries in this date range
        deleteResult = await prisma.dailyOverride.deleteMany({
          where: {
            type: 'callout',
            createdBy: 'Gusto CSV Import',
            date: {
              gte: importStartDate,
              lte: importEndDate
            }
          }
        });
        
        console.log(`🗑️ Deleted ${deleteResult.count} existing Gusto entries in date range`);
      }
    }
    
    // STEP 3: Import the new data fresh (no duplicate checking needed since we cleared the range)
    const results = {
      successful: [],
      errors: [],
      staffNotFound: [],
      duplicates: [], // Will be empty since we cleared existing data
      staffCreated: [],
      deletedExisting: deleteResult.count
    };
    
    for (const record of filteredData) {
      try {
        // Find staff member with multiple name format attempts
        let staff = null;
        const debugStaff = results.staffNotFound.length < 3; // Only debug first few
        
        if (debugStaff) console.log(`🔍 Looking for staff: "${record.employeeName}"`);
        
        // Try 1: Exact match as-is
        staff = await prisma.staff.findFirst({
          where: {
            name: {
              equals: record.employeeName,
              mode: 'insensitive'
            }
          }
        });
        if (staff && debugStaff) console.log(`✅ Found via exact match: ${staff.name}`);
        
        // Try 2: Convert "Last, First" to "First Last" 
        if (!staff && record.employeeName.includes(',')) {
          const nameParts = record.employeeName.split(',').map(part => part.trim());
          if (nameParts.length === 2) {
            const [lastName, firstName] = nameParts;
            const convertedName = `${firstName} ${lastName}`;
            if (debugStaff) console.log(`🔄 Trying converted name: "${convertedName}"`);
            
            staff = await prisma.staff.findFirst({
              where: {
                name: {
                  equals: convertedName,
                  mode: 'insensitive'
                }
              }
            });
            if (staff && debugStaff) console.log(`✅ Found via converted exact match: ${staff.name}`);
          }
        }
        
        // Try 3: Fuzzy match - contains either original or converted name
        if (!staff) {
          staff = await prisma.staff.findFirst({
            where: {
              name: {
                contains: record.employeeName,
                mode: 'insensitive'
              }
            }
          });
          if (staff && debugStaff) console.log(`✅ Found via fuzzy match (original): ${staff.name}`);
        }
        
        // Try 4: If comma format, try fuzzy match with converted name
        if (!staff && record.employeeName.includes(',')) {
          const nameParts = record.employeeName.split(',').map(part => part.trim());
          if (nameParts.length === 2) {
            const [lastName, firstName] = nameParts;
            const convertedName = `${firstName} ${lastName}`;
            
            staff = await prisma.staff.findFirst({
              where: {
                name: {
                  contains: convertedName,
                  mode: 'insensitive'
                }
              }
            });
            if (staff && debugStaff) console.log(`✅ Found via fuzzy match (converted): ${staff.name}`);
          }
        }
        
        if (!staff && debugStaff) {
          console.log(`❌ No staff found for: "${record.employeeName}"`);
        }
        
        if (!staff) {
          // Check if we should create missing staff
          if (importOptions.createMissingStaff) {
            try {
              // Convert "Last, First" to "First Last" format
              let staffName = record.employeeName;
              if (record.employeeName.includes(',')) {
                const nameParts = record.employeeName.split(',').map(part => part.trim());
                if (nameParts.length === 2) {
                  const [lastName, firstName] = nameParts;
                  staffName = `${firstName} ${lastName}`;
                }
              }
              
              console.log(`🔨 Creating missing staff: "${record.employeeName}" → "${staffName}"`);
              
              // Create new staff member
              staff = await prisma.staff.create({
                data: {
                  name: staffName,
                  locations: ['Morristown'], // Default location
                  availability: {} // Default empty availability
                }
              });
              
              console.log(`✅ Created staff: ${staff.name} (ID: ${staff.id})`);
              
              // Track created staff
              results.staffCreated.push({
                originalName: record.employeeName,
                createdName: staff.name,
                id: staff.id
              });
              
            } catch (error) {
              console.error(`❌ Failed to create staff "${record.employeeName}":`, error);
              results.errors.push({
                employeeName: record.employeeName,
                error: `Failed to create staff: ${error.message}`,
                dates: record.dates?.map(d => d.toDateString())
              });
              continue;
            }
          } else {
            results.staffNotFound.push({
              employeeName: record.employeeName,
              dates: record.dates?.map(d => d.toDateString())
            });
            continue;
          }
        }
        
        // Create overrides for each date
        for (const date of record.dates) {
          const dayOfWeek = getDayOfWeek(date);
          
          // Calculate hours per day (total hours divided by number of days)
          const hoursPerDay = record.hours / record.dates.length;
          
          // NOTE: No duplicate checking needed since we cleared existing Gusto data for this date range
          
          // Create overrides based on hours
          if (hoursPerDay >= 8) {
            // Full day - create both AM and PM overrides
            const amOverride = await prisma.dailyOverride.create({
              data: {
                date: date,
                type: 'callout',
                day: dayOfWeek,
                block: 'AM',
                originalStaffId: staff.id,
                reason: `Gusto import: ${record.requestDetails || 'Time off request'} (${hoursPerDay}h full day)`,
                hours: hoursPerDay / 2, // Split hours between AM/PM
                createdBy: 'Gusto CSV Import',
                status: 'active'
              }
            });
            
            const pmOverride = await prisma.dailyOverride.create({
              data: {
                date: date,
                type: 'callout',
                day: dayOfWeek,
                block: 'PM',
                originalStaffId: staff.id,
                reason: `Gusto import: ${record.requestDetails || 'Time off request'} (${hoursPerDay}h full day)`,
                hours: hoursPerDay / 2, // Split hours between AM/PM
                createdBy: 'Gusto CSV Import',
                status: 'active'
              }
            });
            
            results.successful.push({
              id: amOverride.id,
              staff: staff.name,
              date: date.toDateString(),
              block: 'AM',
              hours: hoursPerDay / 2
            });
            
            results.successful.push({
              id: pmOverride.id,
              staff: staff.name,
              date: date.toDateString(),
              block: 'PM',
              hours: hoursPerDay / 2
            });
          } else {
            // Partial day - create single override (default to AM)
            const override = await prisma.dailyOverride.create({
              data: {
                date: date,
                type: 'callout',
                day: dayOfWeek,
                block: 'AM', // Default partial days to AM
                originalStaffId: staff.id,
                reason: `Gusto import: ${record.requestDetails || 'Time off request'} (${hoursPerDay}h)`,
                hours: hoursPerDay,
                createdBy: 'Gusto CSV Import',
                status: 'active'
              }
            });
            
            results.successful.push({
              id: override.id,
              staff: staff.name,
              date: date.toDateString(),
              block: 'AM',
              hours: hoursPerDay
            });
          }
        }
        
      } catch (error) {
        results.errors.push({
          employeeName: record.employeeName,
          error: error.message,
          dates: record.dates?.map(d => d.toDateString())
        });
      }
    }
    
    console.log(`✅ Import complete: ${results.successful.length} successful, ${results.errors.length} errors`);
    console.log(`📊 Summary: ${results.staffNotFound.length} staff not found, ${results.duplicates.length} duplicates, ${results.staffCreated.length} staff created`);
    
    // Show first few staff not found for debugging
    if (results.staffNotFound.length > 0) {
      console.log(`❌ First 5 staff not found:`);
      results.staffNotFound.slice(0, 5).forEach(item => {
        console.log(`   - "${item.employeeName}"`);
      });
    }
    
    res.json({
      success: true,
      message: 'CSV import processed',
      results: results,
      summary: {
        totalRecords: parsedData.length,
        filtered: filteredData.length,
        successful: results.successful.length,
        errors: results.errors.length,
        staffNotFound: results.staffNotFound.length,
        duplicates: results.duplicates.length,
        staffCreated: results.staffCreated.length,
        deletedExisting: results.deletedExisting,
        dateRange: importStartDate && importEndDate ? {
          start: importStartDate.toDateString(),
          end: importEndDate.toDateString()
        } : null
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing CSV import:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process CSV import',
      error: error.message 
    });
  }
});

// Parse Gusto CSV format with proper multiline support
function parseGustoCSV(csvData) {
  const records = [];
  
  // First, find the header line by scanning for the expected columns
  const lines = csvData.split('\n');
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Employee') && lines[i].includes('Status') && lines[i].includes('Request Date')) {
      headerIndex = i;
      break;
    }
  }
  
  if (headerIndex === -1) {
    throw new Error('Could not find CSV header row');
  }
  
  // Parse header
  const headerLine = lines[headerIndex];
  const headers = parseCSVRow(headerLine);
  console.log('📋 CSV Headers:', headers);
  
  // Join all data lines back together (after header) and parse properly
  const dataLines = lines.slice(headerIndex + 1).join('\n');
  
  // Parse the entire data section as proper CSV with multiline support
  const rows = parseMultilineCSV(dataLines);
  
  console.log(`📊 Parsed ${rows.length} total CSV rows`);
  
  for (const values of rows) {
    // Skip rows that don't have enough columns or are summary rows
    if (values.length < headers.length || 
        (values[0] && values[0].includes('Total approved hours'))) {
      continue;
    }
    
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });
    
    // Skip empty employee names
    if (!record.Employee || record.Employee.trim() === '') continue;
    
    // Parse the record
    const parsedRecord = {
      employeeName: record.Employee.trim(),
      department: record.Department,
      status: record.Status,
      policy: record.Policy,
      dateSent: record['Date Sent'],
      requestDate: record['Request Date'],
      requestDetails: record['Request Details'],
      hours: parseFloat(record.Hours) || 0,
      dates: parseGustoDateRange(record['Request Date'])
    };
    
    records.push(parsedRecord);
  }
  
  console.log(`✅ Successfully parsed ${records.length} time-off records`);
  return records;
}

// Robust CSV parser that handles multiline quoted fields
function parseMultilineCSV(csvData) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < csvData.length) {
    const char = csvData[i];
    
    if (char === '"') {
      // Handle quote escaping (double quotes)
      if (inQuotes && i + 1 < csvData.length && csvData[i + 1] === '"') {
        currentField += '"';
        i += 2; // Skip both quotes
        continue;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // End of row (only if not inside quotes)
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(field => field.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      }
      // Skip \r\n sequences
      if (char === '\r' && i + 1 < csvData.length && csvData[i + 1] === '\n') {
        i++;
      }
    } else {
      // Regular character (including newlines inside quotes)
      currentField += char;
    }
    
    i++;
  }
  
  // Handle last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field.length > 0)) {
      rows.push(currentRow);
    }
  }
  
  return rows;
}

// Simple CSV row parser for single-line rows (header parsing)
function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Legacy function kept for compatibility
function parseCSVLine(line) {
  return parseCSVRow(line);
}

// Parse Gusto date range format  
function parseGustoDateRange(dateString) {
  if (!dateString || dateString.trim() === '') return [];
  
  try {
    // Handle date ranges like "6/23 - 6/27/25" or "6/5 - 6/6/25"
    const rangeMatch = dateString.match(/(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    if (rangeMatch) {
      const startStr = rangeMatch[1];
      const endStr = rangeMatch[2];
      
      // Add year to start date if missing
      const endDate = new Date(endStr);
      const year = endDate.getFullYear();
      const startDate = new Date(startStr + '/' + year);
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const dates = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
      }
    }
    
    // Handle single date like "5/20/25" or "6/5/25"
    const singleDate = new Date(dateString);
    if (!isNaN(singleDate.getTime())) {
      return [singleDate];
    }
    
    return [];
  } catch (error) {
    console.error('Error parsing Gusto date:', dateString, error);
    return [];
  }
}

// Determine time blocks based on hours
function determineTimeBlocks(hours) {
  if (hours >= 8) {
    return ['AM', 'PM']; // Full day
  } else if (hours >= 4) {
    return ['AM']; // Half day - default to AM
  } else {
    return ['AM']; // Partial day - default to AM
  }
}

// Clear callout data endpoint
router.delete('/clear-callouts', async (req, res) => {
  try {
    const prisma = req.prisma;
    
    // Delete all callout overrides from Gusto imports
    const result = await prisma.dailyOverride.deleteMany({
      where: {
        type: 'callout',
        createdBy: 'Gusto CSV Import'
      }
    });
    
    console.log(`🗑️ Cleared ${result.count} Gusto callout records`);
    
    res.json({
      success: true,
      message: `Cleared ${result.count} callout records`,
      deletedCount: result.count
    });
    
  } catch (error) {
    console.error('Error clearing callouts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to clear callout data',
      message: error.message 
    });
  }
});

// Debug endpoint to show all staff (no parameters needed)
router.get('/debug/all-staff', async (req, res) => {
  try {
    const prisma = req.prisma;
    
    const allStaff = await prisma.staff.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
    
    res.json({
      totalStaff: allStaff.length,
      staff: allStaff
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test staff name matching
router.get('/debug/staff-match/:name', async (req, res) => {
  try {
    const testName = decodeURIComponent(req.params.name);
    const prisma = req.prisma;
    
    console.log(`🧪 Debug: Testing staff match for "${testName}"`);
    
    // Get all staff for comparison
    const allStaff = await prisma.staff.findMany({
      select: { id: true, name: true }
    });
    
    // Try all matching methods
    const results = {
      testName: testName,
      allStaff: allStaff.map(s => ({ id: s.id, name: s.name })),
      matchResults: {}
    };
    
    // Try 1: Exact match as-is
    const exact = await prisma.staff.findFirst({
      where: { name: { equals: testName, mode: 'insensitive' } }
    });
    results.matchResults.exact = exact ? { id: exact.id, name: exact.name } : null;
    
    // Try 2: Convert "Last, First" to "First Last"
    let converted = null;
    if (testName.includes(',')) {
      const nameParts = testName.split(',').map(part => part.trim());
      if (nameParts.length === 2) {
        const [lastName, firstName] = nameParts;
        const convertedName = `${firstName} ${lastName}`;
        
        converted = await prisma.staff.findFirst({
          where: { name: { equals: convertedName, mode: 'insensitive' } }
        });
        results.matchResults.converted = {
          convertedName: convertedName,
          found: converted ? { id: converted.id, name: converted.name } : null
        };
      }
    }
    
    // Try 3: Fuzzy match
    const fuzzy = await prisma.staff.findFirst({
      where: { name: { contains: testName, mode: 'insensitive' } }
    });
    results.matchResults.fuzzy = fuzzy ? { id: fuzzy.id, name: fuzzy.name } : null;
    
    res.json(results);
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to test client initials matching
router.get('/debug/client-initials/:message', async (req, res) => {
  try {
    const testMessage = decodeURIComponent(req.params.message);
    const prisma = req.prisma;
    
    console.log(`🧪 Debug: Testing client initials match for message "${testMessage}"`);
    
    // Get all clients
    const allClients = await prisma.client.findMany({
      select: { id: true, name: true }
    });
    
    const lowerMessage = testMessage.toLowerCase();
    
    // Try to find client by name (supports both full names and initials format)
    let foundClient = null;
    let matchMethod = 'none';
    
    // Try full name first
    for (const client of allClients) {
      if (lowerMessage.includes(client.name.toLowerCase())) {
        foundClient = client;
        matchMethod = 'fullName';
        break;
      }
    }
    
    // If not found by full name, try to match by initials format
    if (!foundClient) {
      for (const client of allClients) {
        const clientName = client.name.toLowerCase();
        const nameParts = clientName.split(' ');
        
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];
          
          if (firstName.length >= 2 && lastName.length >= 2) {
            const initials = (firstName.substring(0, 2) + lastName.substring(0, 2)).toLowerCase();
            
            if (lowerMessage.includes(initials)) {
              foundClient = client;
              matchMethod = 'initials';
              break;
            }
          }
        }
      }
    }
    
    // Generate initials for all clients for reference
    const clientsWithInitials = allClients.map(client => {
      const nameParts = client.name.toLowerCase().split(' ');
      let initials = 'N/A';
      
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts[nameParts.length - 1];
        
        if (firstName.length >= 2 && lastName.length >= 2) {
          initials = (firstName.substring(0, 2) + lastName.substring(0, 2)).toLowerCase();
        }
      }
      
      return {
        id: client.id,
        name: client.name,
        initials: initials
      };
    });
    
    res.json({
      testMessage: testMessage,
      foundClient: foundClient ? { 
        id: foundClient.id, 
        name: foundClient.name,
        matchMethod: matchMethod
      } : null,
      allClientsWithInitials: clientsWithInitials,
      searchResults: {
        fullNameMatches: allClients.filter(c => lowerMessage.includes(c.name.toLowerCase())),
        initialsMatches: clientsWithInitials.filter(c => c.initials !== 'N/A' && lowerMessage.includes(c.initials))
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;