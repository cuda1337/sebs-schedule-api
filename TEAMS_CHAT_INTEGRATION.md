# Teams Chat Integration Setup Guide

## Overview
This document explains how to integrate Microsoft Teams chat messages with the staff scheduling API to automatically create cancellation overrides when clients cancel appointments.

## Architecture
- **Teams Chat** → **Power Automate** → **Webhook** → **Staff Schedule API** → **Database Override**

## Prerequisites
- Microsoft Teams with appropriate permissions
- Power Automate access
- Ngrok or public server for webhook endpoint
- Node.js server running the staff-schedule-api

## Setup Steps

### 1. Power Automate Flow Configuration

#### Trigger: "When a new chat message is added"
- Select the specific Teams chat for monitoring
- Configure to monitor the chat where cancellation messages will be sent

#### Action 1: "For each" loop
- Apply to each message from the trigger

#### Action 2: "Get message details"
- **Message ID**: Use dynamic content from trigger
- **Message Type**: Group chat
- **Group Chat**: Select your scheduling chat
- This action fetches the full message content

#### Action 3: "HTTP" request
- **Method**: POST
- **URI**: `https://your-ngrok-url.ngrok.io/api/webhooks/teams/client-update`
- **Headers**: 
  - Content-Type: `application/json`
- **Body** (using Expression):
```json
{
  "message": @{outputs('Get_message_details')[0]},
  "sender": "Chat User",
  "timestamp": "2024-06-03"
}
```

**Important**: Use the Expression tab, not Dynamic Content, for the message field.

### 2. Webhook API Configuration

#### Endpoint
- **URL**: `/api/webhooks/teams/client-update`
- **Method**: POST
- **Content-Type**: application/json

#### Message Processing
The webhook processes the Teams message format and extracts:
1. **Message content** from nested JSON structure
2. **Sender information** from Teams user data
3. **Client name** by matching against database clients (case-insensitive)
4. **Cancellation keywords**: cancel, cancelled, canx, sick, absent, not coming
5. **Date parsing**: today, tomorrow, specific dates
6. **Time blocks**: morning/am → AM, afternoon/pm → PM

#### Timezone Handling
- Uses Eastern timezone for date calculations
- Converts "today"/"tomorrow" based on Eastern time, not UTC

### 3. Supported Message Formats

#### Client Names
- Must match existing client names in database (case-insensitive)
- Example: "Jamie Chen" matches database entry exactly

#### Cancellation Keywords
- cancel, cancelled, canceling, canx, sick, absent, not coming

#### Date Formats
- **Relative**: "today", "tomorrow"
- **Month names**: "June 5th", "June 5"
- **Numeric**: "6/5", "6-5"

#### Time Blocks
- **AM**: morning, am (defaults to AM if no time specified)
- **PM**: afternoon, pm

#### Example Messages
```
Jamie Chen canceled today
Taylor Martinez sick tomorrow morning
Cameron White canx June 5th
Parker Wilson canceled 6/5 pm
Drew Thompson sick 6-6 afternoon
```

### 4. Webhook Response Processing

#### Success Response
```json
{
  "success": true,
  "message": "Client cancellation processed",
  "override": {
    "id": 22,
    "clientId": 6,
    "date": "2025-06-04T00:00:00.000Z",
    "reason": "Client cancellation via Teams: Jamie Chen canceled today"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Could not parse cancellation information",
  "receivedMessage": "Invalid message format"
}
```

### 5. Database Integration

#### Daily Override Creation
When a valid cancellation is detected, creates a `dailyOverride` record:
- **type**: "cancellation"
- **date**: Parsed date in YYYY-MM-DD format
- **day**: Day of week (Monday, Tuesday, etc.)
- **block**: "AM" or "PM"
- **originalClientId**: Client database ID
- **reason**: Full Teams message with context
- **createdBy**: Teams sender display name
- **status**: "active"

### 6. Frontend Integration

#### Schedule Display
- Daily overrides automatically apply to schedule views
- Cancelled sessions are removed from the schedule grid
- Amber notification banner shows active overrides
- Override details include client name and reason

#### Navigation
- Navigate to the specific date in the Daily Schedule view
- Look for amber banner indicating active overrides
- Cancelled assignments are visually hidden from schedule

### 7. Troubleshooting

#### Common Issues

**Webhook receives empty messages**
- Check Power Automate flow uses Expression, not Dynamic Content
- Ensure "Get message details" action is properly configured
- Verify message ID and chat ID are correctly passed

**Dates are wrong timezone**
- Webhook uses Eastern timezone for date calculations
- Server logs show parsed date and day of week

**Client not found**
- Client name must match database exactly (case-insensitive)
- Check client names in database vs. Teams message
- Logs show "❌ No client name found in message"

**Power Automate shows failed**
- Check ngrok tunnel is active and accessible
- Verify webhook endpoint URL is correct
- Review Power Automate run history for specific errors

#### Debugging
- Check server logs for detailed parsing information
- Use test endpoint `/api/webhooks/test/echo` to see raw data
- Review recent overrides at `/api/webhooks/recent-overrides`

### 8. Key Technical Details

#### Power Automate Peculiarities
- Chat messages come as complex nested JSON objects
- Must use "Get message details" action to fetch content
- Expression syntax required: `outputs('Get_message_details')[0]`
- Teams sends full HTTP response object, not just message data

#### Webhook Parsing Logic
1. Detect if message is JSON (Teams format) vs plain text
2. Extract message content from nested `body.body.plainTextContent`
3. Strip HTML tags and normalize whitespace
4. Match client names against database (fuzzy matching with `contains`)
5. Parse dates using multiple regex patterns
6. Default to AM if no time block specified

#### Security Considerations
- Webhook validates message format before processing
- Only processes messages containing valid cancellation keywords
- Logs all attempts for audit trail
- No sensitive data exposed in responses

### 9. Maintenance

#### Adding New Date Formats
Update regex patterns in `parseClientCancellation()` function:
```javascript
const dateMatches = [
  /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
  /(\d{1,2})\/(\d{1,2})/,
  /(\d{1,2})-(\d{1,2})/
];
```

#### Adding New Keywords
Update cancellation keywords array:
```javascript
const cancellationKeywords = ['cancel', 'cancelled', 'canceling', 'canx', 'not coming', 'sick', 'absent'];
```

#### Client Name Matching
Currently uses database `name` field with case-insensitive contains match. Future enhancement could use initials format (JaCh for Jamie Chen).

## Success Criteria
✅ Teams chat messages automatically create database overrides  
✅ Multiple date formats supported (today, tomorrow, specific dates)  
✅ Time blocks correctly parsed (AM/PM)  
✅ Eastern timezone handling  
✅ Client name matching against database  
✅ Frontend displays cancellations properly  
✅ Audit trail maintained in database  

## Files Modified
- `/src/routes/webhook.routes.js` - Main webhook logic
- `/src/server.js` - Added webhook route mounting
- Power Automate flow configuration (cloud-based)

Created: June 3, 2025  
Last Updated: June 3, 2025  
Status: ✅ Working