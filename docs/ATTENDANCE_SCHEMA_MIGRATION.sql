-- ═══════════════════════════════════════════════════════════════════════════════
-- Attendance Tracker Schema Extension (Phase A1-A2)
-- Extends payroll schema with attendance tracking, leave requests, and time entries
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CREATE leave_requests table (A1.2)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES employee(id) ON DELETE SET NULL,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  leave_type VARCHAR(50) NOT NULL,  -- 'sick', 'vacation', 'personal', 'unpaid'
  reason TEXT,
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_leave_type CHECK (leave_type IN ('sick', 'vacation', 'personal', 'unpaid'))
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_company_id 
  ON leave_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id 
  ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver_id 
  ON leave_requests(approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status 
  ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at 
  ON leave_requests(created_at);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE leave_requests IS 'Leave/absence requests with approval workflow';

-- RLS Policies for leave_requests
CREATE POLICY "employees_see_own_leave_requests"
ON leave_requests FOR SELECT
USING (
  employee_id = (SELECT employee_id FROM employee WHERE id = employee_id)
  OR approver_id = (SELECT employee_id FROM employee WHERE id = approver_id)
);

CREATE POLICY "employees_can_create_own_requests"
ON leave_requests FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

CREATE POLICY "approvers_can_approve"
ON leave_requests FOR UPDATE
USING (
  approver_id = (SELECT employee_id FROM employee WHERE company_id = leave_requests.company_id AND user_id = auth.uid() LIMIT 1)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CREATE time_entries table (A1.3)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  
  clock_in_time TIMESTAMP NOT NULL,
  clock_out_time TIMESTAMP,
  
  -- Location tracking
  clock_in_location JSONB,  -- {latitude, longitude, accuracy}
  clock_out_location JSONB,
  
  -- Selfie URLs (S3 or similar)
  clock_in_selfie_url TEXT,
  clock_out_selfie_url TEXT,
  
  -- Status and metadata
  status VARCHAR(50) DEFAULT 'active',  -- 'active', 'completed', 'override'
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_times CHECK (clock_out_time IS NULL OR clock_out_time >= clock_in_time)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_company_id 
  ON time_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id 
  ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_created_at 
  ON time_entries(created_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date 
  ON time_entries(employee_id, DATE(clock_in_time));

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE time_entries IS 'Detailed time tracking with location and selfie verification';

-- RLS Policies for time_entries
CREATE POLICY "employees_see_own_entries"
ON time_entries FOR SELECT
USING (
  employee_id = (SELECT employee_id FROM employee WHERE user_id = auth.uid())
);

CREATE POLICY "employees_can_clock_in"
ON time_entries FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. ALTER attendance table to extend with approval fields
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES employee(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'auto' CHECK (approval_status IN ('auto', 'pending_approval', 'approved', 'rejected'));
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS approval_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_attendance_approval_status 
  ON attendance(approval_status);

COMMENT ON COLUMN attendance.approved_by IS 'Employee ID of the approver (for manual/override attendance)';
COMMENT ON COLUMN attendance.approval_status IS 'Approval status: auto (from time entries), pending, approved, rejected';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CREATE attendance_audit_log for tracking changes
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attendance_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE,
  
  action VARCHAR(50) NOT NULL,  -- 'clock_in', 'clock_out', 'override', 'approve', 'reject'
  performed_by UUID REFERENCES auth.users(id),
  
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_company_id 
  ON attendance_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_attendance_id 
  ON attendance_audit_log(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_created_at 
  ON attendance_audit_log(created_at);

ALTER TABLE attendance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_company_isolation"
ON attendance_audit_log FOR SELECT
USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE attendance_audit_log IS 'Audit log for all attendance tracking changes';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. CREATE leave_balance tracking table
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leave_balance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  year INT NOT NULL,
  
  leave_type VARCHAR(50) NOT NULL,  -- 'sick', 'vacation', 'personal'
  total_days INT NOT NULL,
  used_days INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(employee_id, year, leave_type)
);

CREATE INDEX IF NOT EXISTS idx_leave_balance_company_id 
  ON leave_balance(company_id);
CREATE INDEX IF NOT EXISTS idx_leave_balance_employee_id 
  ON leave_balance(employee_id);

ALTER TABLE leave_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_see_own_balance"
ON leave_balance FOR SELECT
USING (
  employee_id = (SELECT employee_id FROM employee WHERE user_id = auth.uid())
);

COMMENT ON TABLE leave_balance IS 'Tracks leave balance per employee per year';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. Helper Functions for Attendance Operations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Calculate total hours worked in a time period
CREATE OR REPLACE FUNCTION calculate_hours_worked(
  p_employee_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE(
  total_hours NUMERIC,
  total_days INT,
  average_hours_per_day NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out_time, NOW()) - clock_in_time)) / 3600)::NUMERIC, 2),
    COUNT(DISTINCT DATE(clock_in_time)),
    ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(clock_out_time, NOW()) - clock_in_time)) / 3600)::NUMERIC, 2)
  FROM time_entries
  WHERE
    employee_id = p_employee_id
    AND company_id = p_company_id
    AND DATE(clock_in_time) >= p_start_date
    AND DATE(clock_in_time) <= p_end_date;
END;
$$ LANGUAGE PLPGSQL;

-- Submit leave request for approval
CREATE OR REPLACE FUNCTION submit_leave_request(
  p_leave_request_id UUID,
  p_company_id UUID
)
RETURNS leave_requests AS $$
BEGIN
  UPDATE leave_requests
  SET
    status = 'pending',
    submitted_at = NOW()
  WHERE
    id = p_leave_request_id
    AND company_id = p_company_id;
  
  RETURN (
    SELECT * FROM leave_requests
    WHERE id = p_leave_request_id AND company_id = p_company_id
  );
END;
$$ LANGUAGE PLPGSQL;

-- Approve leave request
CREATE OR REPLACE FUNCTION approve_leave_request(
  p_leave_request_id UUID,
  p_company_id UUID,
  p_approver_id UUID
)
RETURNS leave_requests AS $$
BEGIN
  UPDATE leave_requests
  SET
    status = 'approved',
    approver_id = p_approver_id,
    approved_at = NOW()
  WHERE
    id = p_leave_request_id
    AND company_id = p_company_id;
  
  RETURN (
    SELECT * FROM leave_requests
    WHERE id = p_leave_request_id AND company_id = p_company_id
  );
END;
$$ LANGUAGE PLPGSQL;

-- Reject leave request
CREATE OR REPLACE FUNCTION reject_leave_request(
  p_leave_request_id UUID,
  p_company_id UUID,
  p_rejection_reason TEXT
)
RETURNS leave_requests AS $$
BEGIN
  UPDATE leave_requests
  SET
    status = 'rejected',
    rejection_reason = p_rejection_reason
  WHERE
    id = p_leave_request_id
    AND company_id = p_company_id;
  
  RETURN (
    SELECT * FROM leave_requests
    WHERE id = p_leave_request_id AND company_id = p_company_id
  );
END;
$$ LANGUAGE PLPGSQL;

-- Clock in (create time entry)
CREATE OR REPLACE FUNCTION clock_in(
  p_company_id UUID,
  p_employee_id UUID,
  p_location JSONB,
  p_selfie_url TEXT
)
RETURNS time_entries AS $$
DECLARE
  v_time_entry time_entries;
BEGIN
  INSERT INTO time_entries (
    company_id,
    employee_id,
    clock_in_time,
    clock_in_location,
    clock_in_selfie_url,
    status
  ) VALUES (
    p_company_id,
    p_employee_id,
    NOW(),
    p_location,
    p_selfie_url,
    'active'
  )
  RETURNING * INTO v_time_entry;
  
  -- Log to audit
  INSERT INTO attendance_audit_log (
    company_id,
    time_entry_id,
    action,
    performed_by,
    new_values
  ) VALUES (
    p_company_id,
    v_time_entry.id,
    'clock_in',
    auth.uid(),
    row_to_json(v_time_entry)
  );
  
  RETURN v_time_entry;
END;
$$ LANGUAGE PLPGSQL;

-- Clock out (update time entry)
CREATE OR REPLACE FUNCTION clock_out(
  p_time_entry_id UUID,
  p_company_id UUID,
  p_location JSONB,
  p_selfie_url TEXT
)
RETURNS time_entries AS $$
DECLARE
  v_old_entry time_entries;
  v_new_entry time_entries;
BEGIN
  -- Get old values
  SELECT * INTO v_old_entry FROM time_entries
  WHERE id = p_time_entry_id AND company_id = p_company_id;
  
  -- Update entry
  UPDATE time_entries
  SET
    clock_out_time = NOW(),
    clock_out_location = p_location,
    clock_out_selfie_url = p_selfie_url,
    status = 'completed'
  WHERE
    id = p_time_entry_id
    AND company_id = p_company_id
  RETURNING * INTO v_new_entry;
  
  -- Log to audit
  INSERT INTO attendance_audit_log (
    company_id,
    time_entry_id,
    action,
    performed_by,
    old_values,
    new_values
  ) VALUES (
    p_company_id,
    p_time_entry_id,
    'clock_out',
    auth.uid(),
    row_to_json(v_old_entry),
    row_to_json(v_new_entry)
  );
  
  RETURN v_new_entry;
END;
$$ LANGUAGE PLPGSQL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- End of Attendance Tracker Schema Migration
-- ═══════════════════════════════════════════════════════════════════════════════
