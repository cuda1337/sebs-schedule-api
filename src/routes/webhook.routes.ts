import express from 'express';
import { prisma } from '../server';

const router = express.Router();

// Teams webhook endpoint for client cancellations
router.post('/teams/client-update', async (req, res) => {
  try {
    const { message, sender, timestamp } = req.body;
    
    console.log('📨 Teams webhook received:', {
      message,
      sender,
      timestamp,
      body: req.body
    });

    // Parse the message for cancellation patterns
    const cancellationInfo = parseClientCancellation(message);
    
    if (cancellationInfo) {
      console.log('✅ Parsed cancellation:', cancellationInfo);
      
      // Try to find the client by name (case-insensitive)
      let clientId = null;
      if (cancellationInfo.clientName) {
        const client = await prisma.client.findFirst({
          where: {
            name: {
              contains: cancellationInfo.clientName,
              mode: 'insensitive'
            }
          }
        });
        clientId = client?.id || null;
        console.log(`🔍 Client lookup for "${cancellationInfo.clientName}":`, client ? `Found ${client.name} (ID: ${client.id})` : 'Not found');
      }
      
      // Create daily override for client cancellation
      const override = await prisma.dailyOverride.create({
        data: {
          date: cancellationInfo.date,
          type: 'cancellation',
          day: cancellationInfo.day,
          block: cancellationInfo.block || '',
          originalClientId: clientId,
          reason: `Client cancellation via Teams: ${message} (Parsed: ${cancellationInfo.clientName || 'Unknown'})`,
          createdBy: sender || 'teams-webhook',
        },
        include: {
          originalClient: true,
        }
      });

      console.log('💾 Created override:', override);
      
      res.json({
        success: true,
        message: 'Client cancellation processed',
        override: {
          id: override.id,
          clientId: override.originalClientId,
          date: override.date,
          reason: override.reason
        }
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
      message: error instanceof Error ? error.message : 'Unknown error'
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
router.get('/recent-overrides', async (_req, res) => {
  try {
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
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    webhooks: ['teams/client-update', 'gusto/staff-pto'],
    timestamp: new Date().toISOString()
  });
});

// Helper function to parse client cancellation messages
function parseClientCancellation(message: string) {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  // Look for cancellation keywords
  const cancellationKeywords = ['cancel', 'cancelled', 'canceling', 'not coming', 'sick', 'absent'];
  const hasCancellation = cancellationKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (!hasCancellation) return null;

  // Try to extract client name - look for patterns like "client a", "john", etc.
  // This is a basic implementation - you'll want to improve this based on your naming patterns
  const clientPatterns = [
    /client\s+([a-z]+)/i,  // "client a", "client john"
    /([a-z]+)\s+cancel/i,  // "john canceled"
    /([a-z]+)\s+is\s+sick/i, // "mary is sick"
  ];
  
  let clientName = null;
  for (const pattern of clientPatterns) {
    const match = message.match(pattern);
    if (match) {
      clientName = match[1];
      break;
    }
  }

  // Try to extract date - look for "today", "tomorrow", specific dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  let targetDate = today; // Default to today
  let dayOfWeek = getDayOfWeek(today);
  
  if (lowerMessage.includes('tomorrow')) {
    targetDate = tomorrow;
    dayOfWeek = getDayOfWeek(tomorrow);
  } else if (lowerMessage.includes('today')) {
    targetDate = today;
    dayOfWeek = getDayOfWeek(today);
  }

  // Try to extract time block (AM/PM)
  let block = null;
  if (lowerMessage.includes('morning') || lowerMessage.includes('am')) {
    block = 'AM';
  } else if (lowerMessage.includes('afternoon') || lowerMessage.includes('pm')) {
    block = 'PM';
  }

  // If we have at least a client name, return the parsed info
  if (clientName) {
    return {
      clientName,
      clientId: null, // We'll need to look this up in the database
      date: targetDate,
      day: dayOfWeek,
      block,
      originalMessage: message
    };
  }

  return null;
}

// Helper function to get day of week
function getDayOfWeek(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

export default router;