# Future Development Roadmap

## ✅ Recently Completed Features (v3.0)

### Multi-Staff Assignment System ✅
**Status: COMPLETE - June 2025**
- **2-Staff Support**: Allow up to 2 staff members per client session
- **Override Mechanism**: Required confirmation when assigning second staff
- **Visual Indicators**: Staff count badges (1/2, 2/2) throughout all views
- **Conflict Detection**: Backend validation for multi-staff assignments
- **Change Tracking**: Complete audit trail for multi-staff assignments

### Lunch Schedule Management ✅
**Status: COMPLETE - June 2025**
- **Daily Coordination**: Integrated lunch schedule system within daily view
- **Drag-Drop Interface**: Intuitive client assignment to staff groups
- **Mixed Staff Support**: Existing staff + volunteers/helpers input
- **Location-Based**: Separate lunch schedules per service location
- **Export Functionality**: Copy formatted schedules for Teams/email sharing
- **Group Management**: Flexible 1-8 clients per group with visual warnings

### Enhanced Scheduling Conflict Detection ✅
**Status: COMPLETE - June 2025**
- **Multi-Staff Validation**: Prevents more than 2 staff per client
- **Override System**: Explicit override required for conflict resolution
- **Smart Client Detection**: Only shows truly unassigned clients
- **Change Log Integration**: Tracks all assignment modifications

### Analytics & Reporting Dashboard ✅
**Status: COMPLETE - January 2025**
- **Staff Analytics**: Callout tracking with accurate hours
- **Client Analytics**: Utilization rates, open hours tracking
- **Gusto Integration**: CSV import for time-off data
- **Change Log Review**: Track and approve all modifications

---

## Priority Features

### 1. Staff Call-Out Monitoring
**Integration Options:**
- **Gusto API Integration**: Monitor PTO requests and sick leave submissions
- **Microsoft Office Email Monitoring**: Parse emails for call-out notifications
- **Teams Chat Extension**: Extend current webhook to handle staff messages

**Implementation Notes:**
- Similar webhook structure to client cancellations
- Parse messages like "John Smith called out sick today"
- Create staff override records in database
- Update schedule display to show staff unavailability

### 2. Infrastructure Upgrades

#### Permanent Webhook URL (Replace ngrok)
**Options:**
- Deploy API to cloud service (Heroku, Railway, DigitalOcean)
- Use webhook services (Webhook.site, ngrok pro)
- Set up custom domain with SSL certificate

#### Website Deployment (Vercel)
**Plan:**
- Deploy React frontend to Vercel
- Configure environment variables for API endpoints
- Set up custom domain if needed
- Configure build/deployment pipeline

### 3. Enhanced Scheduling Conflict Detection
**Status:** ✅ PARTIALLY COMPLETE
**Completed:**
- Multi-staff conflict detection (max 2 staff per client)
- Override mechanism for intentional conflicts
- Visual feedback for conflict states
- Change log tracking for all modifications

**Remaining Work:**
- Staff double-booking prevention
- Location capacity constraints
- Advanced conflict resolution suggestions

**Implementation Example:**
```javascript
// Current implementation for client conflicts:
if (existingClientAssignment && !overrideClientConflict) {
  const clientAssignmentCount = await prisma.assignment.count({
    where: { versionId: version, day, block, clientId }
  });
  if (clientAssignmentCount >= 2) {
    return res.status(400).json({ 
      error: 'Client already has the maximum of 2 staff members assigned' 
    });
  }
  return res.status(400).json({ 
    error: 'Client already has a staff member assigned',
    requiresOverride: true,
    existingStaffCount: clientAssignmentCount
  });
}
```

### 4. Multi-Day Cancellation Support
**Message Format Examples:**
- "Jamie Chen canceled June 5-7"
- "Taylor Martinez out June 10 through June 15"
- "Cameron White canceled this week"

**Implementation Plan:**
- Extend date parsing to handle ranges
- Create multiple override records for date ranges
- Update frontend to show multi-day cancellations
- Add bulk operations for efficiency

### 5. Teams/Email Notifications for Lunch Schedule
**Status:** PLANNED
**Purpose:** Automatically notify staff when lunch schedules are finalized or modified

**Technical Implementation Options:**

#### Option 1: Microsoft Teams Webhook (Recommended)
```javascript
// When schedule is finalized:
const notifyTeams = async (schedule, finalizedBy) => {
  const webhookUrl = process.env.TEAMS_LUNCH_WEBHOOK_URL;
  
  const message = {
    "@type": "MessageCard",
    "themeColor": "0076D7",
    "summary": "Lunch Schedule Finalized",
    "sections": [{
      "activityTitle": "🍽️ Lunch Schedule Finalized",
      "facts": [
        { "name": "Location:", "value": schedule.location },
        { "name": "Date:", "value": formatDate(schedule.date) },
        { "name": "Finalized by:", "value": finalizedBy },
        { "name": "Groups:", "value": `${schedule.timeBlocks[0].groups.length} groups` }
      ],
      "text": "The lunch schedule has been finalized and is ready for staff."
    }]
  };
  
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
};
```

**Message Appearance:**
- Shows as webhook message (not from specific user)
- Appears in designated channel (e.g., #lunch-schedules)
- Can include rich formatting and action buttons
- Clear attribution showing who finalized

#### Option 2: Email Notifications (SendGrid/AWS SES)
```javascript
const sendFinalizationEmail = async (schedule, recipients) => {
  const msg = {
    to: recipients, // ['supervisor@sebs.com', 'kitchen@sebs.com']
    from: 'noreply@sebs.com',
    subject: `Lunch Schedule Finalized - ${schedule.location}`,
    html: generateLunchScheduleHTML(schedule),
    text: generateLunchScheduleText(schedule)
  };
  
  await sgMail.send(msg);
};
```

#### Option 3: Power Automate Integration
- Trigger Power Automate flow on finalization
- Can perform multiple actions (Teams, Email, Calendar)
- Most flexible but requires Flow setup

**Implementation Notes:**
- Add to finalize/unlock endpoints in lunchSchedule.routes.js
- Store notification preferences per user/location
- Include full schedule details in notification
- Handle notification failures gracefully
- Consider adding "View in App" links

### 6. Real-Time Cross-Component Updates
**Status:** PLANNED - Quality of Life Enhancement
**Purpose:** Automatically refresh lunch schedule when daily schedule cancellations are made

**Current Behavior:**
- User cancels client in daily schedule
- User switches to lunch schedule tab
- Cancelled client still appears in available clients list
- User must manually refresh lunch schedule to see changes

**Desired Behavior:**
- User cancels client in daily schedule
- Lunch schedule available clients list updates immediately
- No manual refresh required

**Technical Implementation Options:**

#### Option 1: Custom Event System (Recommended - 15 min effort)
```javascript
// In daily schedule when cancellation is created:
window.dispatchEvent(new CustomEvent('clientCancelled', { 
  detail: { clientId, date, type: 'cancellation' } 
}));

// In lunch schedule component:
useEffect(() => {
  const handleCancellation = (event) => {
    loadLunchSchedule(); // Refresh available clients
  };
  window.addEventListener('clientCancelled', handleCancellation);
  return () => window.removeEventListener('clientCancelled', handleCancellation);
}, []);
```

#### Option 2: Shared State Management (30 min effort)
```javascript
// Add to useStore.ts
const useStore = create((set, get) => ({
  dailyOverrides: [],
  addDailyOverride: (override) => {
    set(state => ({
      dailyOverrides: [...state.dailyOverrides, override]
    }));
    // Trigger lunch schedule refresh
    get().refreshLunchClients?.();
  },
  refreshLunchClients: null, // Set by lunch schedule component
}));
```

#### Option 3: React Context Provider (45 min effort)
```javascript
// Create ScheduleContext that both components share
// When daily schedule updates, context notifies lunch schedule
```

**Implementation Notes:**
- Low priority enhancement (nice-to-have)
- Current workaround: Manual refresh button works fine
- Most users follow linear workflow (daily → lunch)
- Event system is simplest and least intrusive

**Files to Modify:**
- `src/components/schedule/DailyScheduleEnhanced.tsx` - Emit events on cancellation
- `src/components/schedule/EnhancedLunchSchedule.tsx` - Listen for events and refresh

### 7. Advanced Reporting & Analytics
**Status:** ✅ BASIC COMPLETE, Enhancement Opportunities
**Completed:**
- Staff call-out tracking with accurate hours
- Client utilization analysis
- Change log review system
- Gusto integration for time-off data
- Interactive analytics dashboard

**Enhancement Opportunities:**
- Predictive analytics for staffing needs
- Advanced pattern recognition
- Cost analysis and budget tracking
- Automated report generation
- Performance trending over time

**Current Dashboard Features:**
- Date range filtering ✅
- Location-based filtering ✅
- Supervisor-based filtering ✅
- Interactive summary cards ✅
- Real-time calculations ✅

## Technical Architecture Notes

### Database Schema Extensions

#### Current Override System ✅
```sql
-- Already implemented as DailyOverride table:
CREATE TABLE "DailyOverride" (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'callout', 'cancellation', 'reassignment'
  day VARCHAR(20) NOT NULL,
  block VARCHAR(10), -- AM/PM or 'Full Day'
  "originalStaffId" INTEGER,
  "originalClientId" INTEGER,
  "newStaffId" INTEGER,
  "newClientId" INTEGER,
  reason TEXT,
  hours DECIMAL, -- Actual hours from Gusto imports
  "createdBy" VARCHAR(100),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);
```

#### Lunch Schedule Schema ✅
```sql
-- New tables for lunch coordination:
CREATE TABLE "LunchSchedule" (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  location VARCHAR(100) NOT NULL,
  "timePeriod" VARCHAR(50) DEFAULT '12:30-1:00',
  "createdBy" VARCHAR(100),
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "modifiedBy" VARCHAR(100),
  "modifiedAt" TIMESTAMP,
  UNIQUE(date, location)
);

CREATE TABLE "LunchGroup" (
  id SERIAL PRIMARY KEY,
  "lunchScheduleId" INTEGER REFERENCES "LunchSchedule"(id),
  "primaryStaff" VARCHAR(100),
  helpers TEXT[], -- Array of helper names
  "clientIds" INTEGER[], -- Array of client IDs
  color VARCHAR(20)
);
```

#### Conflict Detection
- Add unique constraints for client scheduling
- Implement before-save validation hooks
- Create conflict resolution UI components

#### Multi-Day Support
- Extend current override structure
- Add date range fields or create multiple records
- Update frontend queries to handle ranges

### API Endpoints to Add

#### Staff Management
- `POST /api/staff/callouts` - Create staff call-out
- `GET /api/staff/availability` - Check staff availability
- `PUT /api/staff/overrides/:id` - Update staff override

#### Conflict Detection
- `POST /api/assignments/validate` - Check for conflicts
- `GET /api/conflicts` - List current conflicts
- `POST /api/conflicts/resolve` - Resolve scheduling conflicts

#### Reporting
- `GET /api/reports/cancellations` - Client cancellation reports
- `GET /api/reports/callouts` - Staff call-out reports
- `GET /api/reports/patterns` - Pattern analysis
- `POST /api/reports/export` - Export report data

### Frontend Components to Build

#### Conflict Resolution UI
- Conflict warning modals
- Drag-and-drop resolution interface
- Alternative scheduling suggestions

#### Reporting Dashboard
- Charts and graphs (Chart.js or similar)
- Filter controls and date pickers
- Export functionality
- Print-friendly layouts

#### Multi-Day Cancellation UI
- Date range picker
- Bulk cancellation confirmation
- Visual calendar overlay

## Integration Priorities

### Phase 1 (Infrastructure) ✅ COMPLETE
1. ✅ Deploy to production (Vercel + Render)
2. ✅ Permanent webhook endpoints
3. ✅ Multi-staff conflict detection
4. ✅ Analytics dashboard implementation

### Phase 2 (Staff Features) ✅ COMPLETE
1. ✅ Staff call-out integration (Gusto CSV import)
2. ✅ Staff override management UI (Daily overrides)
3. ✅ Availability tracking (Availability matrix)
4. ✅ Lunch schedule coordination

### Phase 3 (Advanced Features) 🚧 IN PROGRESS
1. ✅ Multi-staff assignment system
2. ✅ Lunch schedule management
3. ✅ Change log review system
4. 🔄 Multi-day cancellation support (Partially via Gusto)
5. 🔄 Advanced pattern analysis

### Phase 4 (Future Enhancements)
1. Performance optimization for large datasets
2. Advanced scheduling algorithms (AI-powered)
3. Predictive analytics and forecasting
4. Mobile app development
5. Advanced integration (Teams notifications, email alerts)
6. Automated staff assignment suggestions

## Notes for Implementation

### Gusto Integration Research
- Investigate Gusto API capabilities
- Determine webhook availability for PTO events
- Plan authentication and security requirements

### Email Integration Options
- Microsoft Graph API for Office 365
- IMAP/POP3 parsing for generic email
- Email forwarding rules to webhook endpoints

### Conflict Detection Logic
- Check same client, same time slot
- Consider staff availability
- Handle group sessions appropriately
- Validate against daily overrides

### Vercel Deployment Checklist
- Environment variable configuration
- API endpoint updates (from localhost)
- Build optimization for production
- Custom domain setup if needed

---

**Created:** June 3, 2025  
**Last Updated:** June 14, 2025  
**Status:** Major Features Complete - Version 3.0

This roadmap provides a structured approach to expanding the staff scheduling system with the requested features while maintaining code quality and user experience.