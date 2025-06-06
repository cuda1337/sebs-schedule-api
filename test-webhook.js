// Simple test script for webhook endpoint
const express = require('express');

const app = express();
app.use(express.json());

// Simulate the webhook endpoint parsing logic
function parseClientCancellation(message) {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  // Look for cancellation keywords
  const cancellationKeywords = ['cancel', 'cancelled', 'canceling', 'not coming', 'sick', 'absent'];
  const hasCancellation = cancellationKeywords.some(keyword => lowerMessage.includes(keyword));
  
  if (!hasCancellation) return null;

  // Try to extract client name
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

  // Extract date
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  let targetDate = today;
  let dayOfWeek = getDayOfWeek(today);
  
  if (lowerMessage.includes('tomorrow')) {
    targetDate = tomorrow;
    dayOfWeek = getDayOfWeek(tomorrow);
  }

  // Extract time block
  let block = null;
  if (lowerMessage.includes('morning') || lowerMessage.includes('am')) {
    block = 'AM';
  } else if (lowerMessage.includes('afternoon') || lowerMessage.includes('pm')) {
    block = 'PM';
  }

  if (clientName) {
    return {
      clientName,
      date: targetDate,
      day: dayOfWeek,
      block,
      originalMessage: message
    };
  }

  return null;
}

function getDayOfWeek(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

// Test different message formats
const testMessages = [
  "Client A canceled tomorrow morning",
  "John is sick today",
  "Mary canceled her afternoon session",
  "Client B not coming tomorrow",
  "Sarah canceled",
  "Just a regular message", // Should not parse
];

console.log('🧪 Testing webhook message parsing:\n');

testMessages.forEach((message, index) => {
  console.log(`Test ${index + 1}: "${message}"`);
  const result = parseClientCancellation(message);
  
  if (result) {
    console.log('✅ Parsed:', {
      client: result.clientName,
      day: result.day,
      block: result.block || 'Not specified',
      date: result.date.toDateString()
    });
  } else {
    console.log('❌ No cancellation detected');
  }
  console.log('---');
});

console.log('\n✅ Webhook endpoint ready!');
console.log('📋 Next steps:');
console.log('1. Start your API server: npm run dev');
console.log('2. Test endpoint: POST http://localhost:3001/api/webhooks/teams/client-update');
console.log('3. Set up Power Automate workflow');