# Lunch Schedule Feature Deployment Guide

## Overview
This guide walks through deploying the lunch schedule feature to production safely.

## Current Status
- ✅ API routes created and tested locally
- ✅ Database schema matches production (except for 3 override columns)
- ✅ All CRUD operations working
- ✅ Foreign key constraints properly handled

## Production Deployment Steps

### Step 1: Deploy Backend API Updates

1. **Add Missing Database Columns** (REQUIRED FIRST)
   - The production database is missing 3 columns in the LunchSchedule table
   - Run the SQL migration: `migrations/add_lunch_overrides.sql`
   - This adds: `manuallyMovedToAvailable`, `manualStayWithStaff`, `excludedClients`

2. **Deploy API Code to Render**
   - Push the updated code to your GitHub repository
   - Render will automatically deploy from the main branch
   - New files to deploy:
     - `src/routes/lunchSchedule.routes.js` - All lunch schedule endpoints
     - Updated `src/server.js` - Route registration

3. **Verify Deployment**
   ```bash
   # Test the endpoints are live
   curl "https://sebs-schedule-api.onrender.com/api/lunch-schedules?date=2025-06-19&location=Morristown"
   ```

### Step 2: Deploy Frontend Components

1. **Create Minimal Lunch Schedule Component**
   - Start with basic display functionality
   - Add drag-and-drop gradually
   - Test each feature thoroughly

2. **Deploy to Vercel**
   - Push frontend changes to GitHub
   - Vercel will auto-deploy

### Step 3: Testing Production

1. **Test with No Existing Data**
   - Should return empty structure
   - Should allow creating new lunch schedules

2. **Test Data Creation**
   - Create lunch groups
   - Add clients to groups
   - Save and retrieve

3. **Test Location Filtering**
   - Each location should have separate schedules
   - No data bleeding between locations

## API Endpoints Summary

### Available in Production After Deploy:

1. **GET** `/api/lunch-schedules`
   - Query params: `date`, `location`
   - Returns lunch schedule or empty structure

2. **POST** `/api/lunch-schedules`
   - Body: `{ date, location, timeBlocks, createdBy }`
   - Creates or updates lunch schedule

3. **GET** `/api/lunch-schedules/available-clients`
   - Query params: `date`, `location`
   - Returns categorized clients for lunch

4. **POST** `/api/lunch-schedules/test-data`
   - Creates sample clients/staff for testing
   - Remove this endpoint before final production

## Data Structure

```javascript
{
  date: "2025-06-19",
  location: "Morristown",
  timeBlocks: [{
    startTime: "12:30",
    endTime: "13:00",
    label: "Lunch",
    groups: [{
      primaryStaff: "Staff Name",
      helpers: ["Helper 1", "Helper 2"],
      roomLocation: "Cafeteria",
      groupName: "Group 1",
      color: "#3B82F6",
      clients: [{
        clientId: 123,
        hasAfternoonSession: true
      }]
    }]
  }]
}
```

## Important Notes

1. **Authentication**: Routes are placed BEFORE auth middleware for testing
   - Move after auth middleware once frontend is ready

2. **Override Arrays**: Production uses PostgreSQL arrays, not JSON strings
   - The code handles both formats for compatibility

3. **Foreign Keys**: Client IDs must exist in the database
   - Use available-clients endpoint to get valid IDs

4. **Testing**: Always test locally first with SQLite before deploying

## Rollback Plan

If issues occur:
1. Remove route registration from `server.js`
2. The database changes are backward compatible (only adds columns)
3. Frontend can be disabled by removing the component

## Next Steps

1. Run database migration on production
2. Deploy backend code
3. Build minimal frontend component
4. Test thoroughly
5. Gradually add features