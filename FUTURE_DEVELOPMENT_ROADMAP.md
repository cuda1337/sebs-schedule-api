# Future Development Roadmap

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

### 3. Scheduling Conflict Detection
**Current Issue:** System allows double-booking of clients
**Solution Required:**
- Add validation in assignment creation API
- Check for existing assignments before creating new ones
- Display conflict warnings in frontend
- Prevent save until conflicts are resolved

**Implementation:**
```javascript
// Before creating assignment, check:
const existingAssignment = await prisma.assignment.findFirst({
  where: {
    clientId: newAssignment.clientId,
    day: newAssignment.day,
    block: newAssignment.block,
    versionId: newAssignment.versionId
  }
});
if (existingAssignment) {
  throw new Error('Client already has assignment in this time slot');
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

### 5. Reporting & Analytics Dashboard
**Staff Call-Out Reports:**
- Frequency by staff member
- Patterns by day of week/time of year
- Impact on schedule coverage
- Advance notice statistics

**Client Cancellation Reports:**
- Most frequently canceling clients
- Cancellation patterns (last-minute vs advance)
- Revenue impact analysis
- Seasonal trends

**Dashboard Features:**
- Date range filtering
- Export to CSV/PDF
- Visual charts and graphs
- Automated weekly/monthly reports

## Technical Architecture Notes

### Database Schema Extensions

#### Staff Overrides Table
```sql
CREATE TABLE staff_overrides (
  id SERIAL PRIMARY KEY,
  staff_id INTEGER REFERENCES staff(id),
  date DATE NOT NULL,
  day VARCHAR(20) NOT NULL,
  block VARCHAR(10), -- AM/PM or null for full day
  type VARCHAR(50) NOT NULL, -- 'callout', 'pto', 'sick'
  reason TEXT,
  created_by VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
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

### Phase 1 (Infrastructure)
1. Deploy to production (Vercel + cloud API)
2. Replace ngrok with permanent webhook
3. Add conflict detection

### Phase 2 (Staff Features)
1. Staff call-out integration (Teams or email)
2. Staff override management UI
3. Availability tracking

### Phase 3 (Advanced Features)
1. Multi-day cancellation support
2. Reporting dashboard
3. Pattern analysis and insights

### Phase 4 (Optimization)
1. Performance improvements
2. Advanced scheduling algorithms
3. Predictive analytics
4. Mobile app considerations

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
**Last Updated:** June 3, 2025  
**Status:** Planning Phase

This roadmap provides a structured approach to expanding the staff scheduling system with the requested features while maintaining code quality and user experience.