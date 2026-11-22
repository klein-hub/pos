# Attendance Tracker Implementation Guide

## Overview

The Attendance Tracker is a comprehensive time-tracking and leave-management system integrated with the Payroll System. It tracks employee attendance via:

1. **Time Entries**: Clock in/out with location and selfie verification
2. **Leave Requests**: Manage leave requests with approval workflow
3. **Attendance Records**: Auto-generated from time entries
4. **Audit Logging**: Track all changes with audit trail

## Database Schema (Phase A1-A2)

### Tables Created/Extended

1. **leave_requests** - Leave/absence requests with status tracking
2. **time_entries** - Detailed clock in/out logs with location and photos
3. **leave_balance** - Track leave balance per employee per year
4. **attendance_audit_log** - Audit trail for all changes
5. **attendance** - Extended with approval fields

### Applying the Migration

**Method 1: Supabase Dashboard**

1. Go to Supabase Dashboard → SQL Editor
2. Copy entire contents of `docs/ATTENDANCE_SCHEMA_MIGRATION.sql`
3. Paste into SQL Editor
4. Click "Run"

**Method 2: Command Line**

```bash
psql -U postgres -h localhost -d postgres << EOF
$(cat docs/ATTENDANCE_SCHEMA_MIGRATION.sql)
EOF
```

**Method 3: Verify Migration**

```sql
-- Check if tables exist
\dt attendance_audit_log
\dt leave_requests
\dt time_entries
\dt leave_balance

-- Check if functions exist
\df calculate_hours_worked
\df submit_leave_request
\df clock_in
\df clock_out
```

## API Functions

### Time Tracking

#### clock_in()

Start a work shift with location and selfie verification.

```sql
SELECT * FROM clock_in(
  p_company_id => 'uuid',
  p_employee_id => 'uuid',
  p_location => '{"latitude": 14.5995, "longitude": 120.9842}'::jsonb,
  p_selfie_url => 'https://storage.com/selfie-123.jpg'
);
```

**Returns**: `time_entries` row

#### clock_out()

End the work shift with location and selfie.

```sql
SELECT * FROM clock_out(
  p_time_entry_id => 'uuid',
  p_company_id => 'uuid',
  p_location => '{"latitude": 14.5995, "longitude": 120.9842}'::jsonb,
  p_selfie_url => 'https://storage.com/selfie-456.jpg'
);
```

**Returns**: Updated `time_entries` row

### Leave Management

#### submit_leave_request()

Submit a leave request for approval.

```sql
SELECT * FROM submit_leave_request(
  p_leave_request_id => 'uuid',
  p_company_id => 'uuid'
);
```

#### approve_leave_request()

Approve a pending leave request.

```sql
SELECT * FROM approve_leave_request(
  p_leave_request_id => 'uuid',
  p_company_id => 'uuid',
  p_approver_id => 'uuid'  -- Employee ID of approver
);
```

#### reject_leave_request()

Reject a leave request with reason.

```sql
SELECT * FROM reject_leave_request(
  p_leave_request_id => 'uuid',
  p_company_id => 'uuid',
  p_rejection_reason => 'Business critical period'
);
```

### Analytics

#### calculate_hours_worked()

Calculate total hours worked in a date range.

```sql
SELECT * FROM calculate_hours_worked(
  p_employee_id => 'uuid',
  p_company_id => 'uuid',
  p_start_date => '2026-05-01'::date,
  p_end_date => '2026-05-31'::date
);
```

**Returns**:

- `total_hours` - Total hours worked
- `total_days` - Number of days with entries
- `average_hours_per_day` - Daily average

## React Component Implementation

### Frontend Hooks

```typescript
// src/hooks/useTimeTracking.ts
export function useTimeTracking(companyId: string) {
  const clockIn = async (location: Geolocation, selfieUrl: string) => {
    // Call clock_in() function
  };

  const clockOut = async (
    timeEntryId: string,
    location: Geolocation,
    selfieUrl: string,
  ) => {
    // Call clock_out() function
  };

  return { clockIn, clockOut };
}

// src/hooks/useLeaveRequests.ts
export function useLeaveRequests(companyId: string) {
  const submitRequest = async (data: LeaveRequest) => {
    // Insert and submit leave request
  };

  const approve = async (requestId: string) => {
    // Call approve_leave_request()
  };

  const reject = async (requestId: string, reason: string) => {
    // Call reject_leave_request()
  };

  return { submitRequest, approve, reject };
}
```

### Components to Build

#### Employee Components (Phase A3-A4)

1. **ClockInScreen.tsx**
   - Current time display
   - "Clock In" button
   - Triggers geolocation + camera
   - Selfie capture
   - Submit

2. **ClockOutScreen.tsx**
   - Show clock in time
   - Hours elapsed
   - "Clock Out" button
   - Triggers geolocation + camera
   - Selfie capture
   - Submit

3. **TimeEntriesHistory.tsx**
   - List of past time entries
   - Clock in/out times
   - Hours worked
   - Location on map (optional)
   - Selfie thumbnails

4. **LeaveRequestForm.tsx**
   - Date range picker
   - Leave type dropdown
   - Reason textarea
   - Submit button

5. **LeaveRequestStatus.tsx**
   - List of employee's leave requests
   - Status badges (pending, approved, rejected)
   - Approver name and date
   - Color-coded by status

#### Manager/Approver Components (Phase A5)

1. **LeaveApprovalQueue.tsx**
   - List of pending leave requests
   - Employee name, dates, reason
   - Quick approve/reject buttons
   - Bulk actions (optional)

2. **TeamAttendanceDashboard.tsx**
   - List all employees
   - Today's status (on-time, late, absent)
   - Hours worked today
   - Real-time updates
   - Click to view details

3. **AttendanceAlerts.tsx**
   - Missing clock out
   - Late arrival
   - No entry for the day
   - Notifications

#### Admin Components (Phase A6)

1. **AttendanceAnalyticsDashboard.tsx**
   - Total clocked in today
   - Absentees
   - Late arrivals
   - Average hours worked
   - Attendance trends

2. **LeaveAnalyticsReport.tsx**
   - Leave usage by type
   - Employees with remaining balance
   - Approval rate
   - Peak leave periods

## Integration with Payroll

### Data Flow

1. **Clock In/Out** → Stored in `time_entries`
2. **End of Day** → Generate `attendance` record based on `time_entries`
3. **Attendance Complete** → Used in payroll calculation
4. **Payroll Generated** → Uses attendance data for salary calculation

### Payroll Calculation with Attendance

```typescript
// Modified payroll calculation
const presentDays = await calculatePresentDays(employeeId, month, year);
const approvedLeaveDays = await getApprovedLeaveDays(employeeId, month, year);
const workingDays = 22; // or actual working days for the period

const grossSalary =
  (baseSalary / workingDays) * (presentDays + approvedLeaveDays);
```

## Features by Phase

### Phase A1: Schema (COMPLETE)

- [x] Tables and indexes
- [x] RLS policies
- [x] Helper functions

### Phase A2: RLS Policies (COMPLETE)

- [x] Row-level security for all tables
- [x] Company isolation
- [x] Role-based access

### Phase A3-A4: Employee UI (TODO)

- [ ] Clock in/out screens
- [ ] Time entries history
- [ ] Leave request form
- [ ] Leave status view

### Phase A5: Approver UI (TODO)

- [ ] Leave approval queue
- [ ] Team attendance dashboard
- [ ] Real-time notifications

### Phase A6: Admin Analytics (TODO)

- [ ] Attendance dashboard
- [ ] Leave analytics
- [ ] Compliance reports

### Phase A7-A12: Enhancements (TODO)

- [ ] Real-time notifications
- [ ] Manual adjustments
- [ ] Payroll integration
- [ ] Mobile responsive
- [ ] Geofencing
- [ ] Exports

## Testing the Schema

### Test Data Setup

```sql
-- Create test leave request
INSERT INTO leave_requests (
  company_id, employee_id, start_date, end_date,
  leave_type, reason, status
) VALUES (
  'pristine-energy-id',
  'employee-id',
  '2026-05-10',
  '2026-05-12',
  'sick',
  'Medical appointment',
  'pending'
);

-- Test clock in
SELECT * FROM clock_in(
  'pristine-energy-id',
  'employee-id',
  '{"latitude": 14.5995, "longitude": 120.9842}'::jsonb,
  'https://example.com/selfie.jpg'
);

-- Verify RLS (should only see own entries)
SELECT * FROM time_entries WHERE employee_id = 'test-employee-id';
```

### Validation Queries

```sql
-- Check table creation
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE '%attendance%' OR tablename LIKE 'leave%';

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'time_entries';

-- Check RLS is enabled
SELECT * FROM pg_class
WHERE relname IN ('time_entries', 'leave_requests')
AND relrowsecurity = true;
```

## Security Considerations

1. **Geolocation Data**: May contain sensitive location info - store encrypted
2. **Selfies**: Store in secure cloud storage (S3, Google Cloud Storage, etc.)
3. **RLS Policies**: All queries automatically filtered by company_id
4. **Audit Log**: All changes tracked for compliance

## Performance Tips

1. Use indexes on `(employee_id, created_at)` for queries
2. Partition `time_entries` by month for large datasets
3. Cache leave balance queries
4. Use materialized views for analytics

## Troubleshooting

### RLS Blocking Queries

If getting "new row violates row-level security policy":

1. Verify user is assigned to company
2. Check that `company_id` is included in INSERT
3. Verify RLS policy matches query

### Missing Data

If clock_in/clock_out not appearing:

1. Check `time_entries` table directly
2. Verify user's `auth.uid()` matches employee_id
3. Check audit log for errors
4. Review RLS policies

## Next Steps

1. Apply migration to Supabase
2. Create React components (Phase A3-A4)
3. Build manager approval UI (Phase A5)
4. Add analytics dashboard (Phase A6)
5. Implement real-time notifications (Phase A7)

---

**Status**: Schema ready for Phase A3-A12 implementation
