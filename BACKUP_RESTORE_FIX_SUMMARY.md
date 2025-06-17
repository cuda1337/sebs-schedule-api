# Backup Restore Fix Summary

## Problem Description
The backup restore feature was failing - it would only restore staff and clients, but not schedule versions or assignments. When it did restore something, it created incorrect data that seemed "made up."

## Investigation Process

### 1. Initial Analysis
- Examined the backup file structure using `analyze-backup.js`
- Found the backup contained:
  - 40 staff records
  - 66 client records
  - 10 schedule versions (IDs 1-10)
  - 315 assignments distributed across all versions
  - Other data (group sessions, daily overrides, etc.)

### 2. Root Causes Identified

#### Issue 1: Version ID Mapping Failure
- **Problem**: The backup contained assignments referencing version IDs 1-10
- **What happened**: When restoring, the database auto-assigns new IDs (e.g., versions might become IDs 60-69)
- **Result**: Assignments couldn't be restored because they referenced non-existent version IDs

#### Issue 2: Transaction Timeout
- **Problem**: The restore process used a database transaction with a 3-minute timeout
- **What happened**: With 315 assignments to restore, the transaction would timeout before completion
- **Result**: The transaction would rollback, leaving only partial data

#### Issue 3: Schema Mismatch
- **Problem**: The backup file included an `email` field for staff records
- **What happened**: The current database schema doesn't have an email field in the Staff model
- **Result**: All staff creation attempts failed with "Unknown argument `email`" error

#### Issue 4: Missing Required Fields
- **Problem**: The backup's ScheduleVersions data was missing the `status` field
- **What happened**: The restore code handled this by defaulting to 'active', but it complicated debugging

## Solution Implementation

### 1. Created Diagnostic Tools
```javascript
// analyze-backup.js - Analyzes backup file structure
// analyze-versions.js - Shows version distribution of assignments
// analyze-restore-logic.js - Simulates restore mapping logic
// check-version-fields.js - Checks for missing fields
```

### 2. Implemented New Restore Service
Created `improvedBackupService.js` with key improvements:
- **No transactions**: Restores data incrementally to avoid timeouts
- **Proper ID mapping**: Maintains mapping between old and new IDs
- **Field filtering**: Removes non-existent fields like `email`
- **Progress tracking**: Logs detailed progress during restore
- **Error collection**: Captures and reports specific errors

### 3. Added New API Endpoint
Created `/api/backup/restore-improved` endpoint that:
- Uses the improved restore service
- Provides detailed success/failure reporting
- Shows which records were restored vs skipped
- Returns specific error messages for debugging

## Technical Details

### Version ID Mapping Logic
```javascript
const versionIdMapping = {};
// When creating version with old ID 10:
const newVersion = await prisma.scheduleVersion.create({...});
versionIdMapping[10] = newVersion.id; // e.g., 10 → 89

// When restoring assignment:
const newVersionId = versionIdMapping[assignment.versionId];
```

### Restore Process Flow
1. Clear existing data (preserving user accounts)
2. Restore staff → Create ID mappings
3. Restore clients → Create ID mappings  
4. Restore schedule versions → Create ID mappings
5. Restore assignments using mapped IDs
6. Restore other data (group sessions, supervisors, etc.)

### Error Handling
- Each record is restored individually
- Failures don't stop the entire process
- Detailed error messages are collected
- Summary shows successful vs skipped records

## Results

### Before Fix
- Only staff/clients restored (partially)
- No assignments restored
- Version IDs mismatched
- Process would timeout

### After Fix
- ✅ 40 staff restored
- ✅ 66 clients restored
- ✅ 10 schedule versions restored
- ✅ 315 assignments restored
- Proper version distribution maintained
- No timeouts

## How to Use

### For Testing
```bash
# Run the test script
node test-improved-restore.js
```

### For Production
Use the `/api/backup/restore-improved` endpoint:
```javascript
POST https://sebs-schedule-api.onrender.com/api/backup/restore-improved
Content-Type: multipart/form-data
Body: backupFile=<your-excel-file>
```

## Lessons Learned

1. **Database transactions have limits**: Large restore operations need incremental approaches
2. **ID mapping is critical**: Never assume IDs will remain the same after restore
3. **Schema evolution matters**: Backup/restore must handle schema differences gracefully
4. **Detailed logging helps**: Progress tracking and error collection are essential for debugging
5. **Test with real data**: Synthetic tests might miss real-world edge cases

## Post-Restore Issues and Fixes

### Issue 5: Daily Schedule Blank After Restore
**Problem**: After successful restore, the daily schedule appeared blank even though assignments were restored correctly.

**Root Cause**: The daily schedule component was calling `fetchAssignments()` without specifying a version ID. Since `currentVersionId` was `null` after restore, no assignments were loaded.

**Symptoms**:
- Main schedule shows assignments correctly
- Daily schedule appears empty
- Cannot add second staff (no available clients shown)
- All daily override features non-functional

**Solution**: Modified `DailyScheduleEnhanced.tsx` to:
1. Fetch schedule versions first using `fetchScheduleVersions()`
2. Once versions are loaded, explicitly fetch main assignments using `fetchMainAssignments()`
3. This ensures the correct main schedule version is used

**Code Changes**:
```javascript
// Before (broken after restore)
useEffect(() => {
  fetchAssignments(); // Uses null currentVersionId
}, []);

// After (works after restore)
useEffect(() => {
  fetchScheduleVersions();
}, []);

useEffect(() => {
  if (scheduleVersions.length > 0) {
    fetchMainAssignments(); // Explicitly loads main schedule
  }
}, [scheduleVersions]);
```

**Files Modified**:
- `src/components/schedule/DailyScheduleEnhanced.tsx`

## Complete Restore Checklist

### After Running Restore
1. **Verify restore success**: Check that all data counts match expected values
2. **Check main schedule**: Weekly view should show all assignments
3. **Test daily schedule**: Navigate to daily view and verify assignments appear
4. **Test daily features**: Try adding overrides, reassignments, second staff
5. **Check version distribution**: Ensure assignments are in correct schedule versions

### If Daily Schedule is Blank
1. **Refresh the page**: Sometimes React state needs to reset
2. **Check browser console**: Look for API errors or failed requests
3. **Verify main version**: Main schedule should have highest assignment count
4. **Check deployment**: Ensure frontend fix has been deployed to Vercel

### If Still Having Issues
1. **Use backup status endpoint**: `GET /api/backup/status` to verify data
2. **Check assignment version IDs**: Ensure they match existing schedule versions
3. **Test with simple restore**: Try `/restore-assignments-only` endpoint for testing
4. **Review error logs**: Check Render function logs for API errors

## Future Improvements

1. Add a preview mode to show what will be restored
2. Support partial restores (e.g., only assignments)
3. Add validation before starting restore
4. Implement restore versioning for rollback capability
5. Add automatic backup before restore for safety
6. **Add post-restore validation**: Automatically verify daily schedule loads correctly
7. **Improve error messages**: Better guidance when components fail to load data
8. **Add restore status page**: Real-time monitoring of restore progress