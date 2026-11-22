/*
  # Payroll Workflow Functions

  Core functions for payroll processing:
  - calculateAttendance(): Calculate attendance summary for a period
  - generatePayroll(): Create payroll record with calculations
  - generatePayslip(): Generate payslip data
*/

-- ─── Function: Calculate Attendance ───
CREATE OR REPLACE FUNCTION public.calculate_attendance(
  p_employee_id uuid,
  p_company_id uuid,
  p_date_start date,
  p_date_end date
)
RETURNS TABLE (
  present_days integer,
  absent_days integer,
  late_count integer,
  total_work_days integer,
  attendance_percentage numeric
) AS $$
DECLARE
  v_present_days integer := 0;
  v_absent_days integer := 0;
  v_late_count integer := 0;
  v_total_days integer := 0;
BEGIN
  -- Calculate attendance summary from attendance table
  SELECT 
    COUNT(CASE WHEN a.status = 'present' THEN 1 END)::integer,
    COUNT(CASE WHEN a.status = 'absent' THEN 1 END)::integer,
    COUNT(CASE WHEN a.status = 'late' THEN 1 END)::integer,
    COUNT(DISTINCT a.attendance_date)::integer
  INTO v_present_days, v_absent_days, v_late_count, v_total_days
  FROM attendance a
  WHERE a.employee_id = p_employee_id
    AND a.company_id = p_company_id
    AND a.attendance_date >= p_date_start
    AND a.attendance_date <= p_date_end;

  -- Return results
  RETURN QUERY SELECT 
    v_present_days,
    v_absent_days,
    v_late_count,
    v_total_days,
    CASE WHEN v_total_days > 0 THEN (v_present_days::numeric / v_total_days::numeric * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Function: Generate Payroll ───
CREATE OR REPLACE FUNCTION public.generate_payroll(
  p_employee_id uuid,
  p_company_id uuid,
  p_year integer,
  p_month integer
)
RETURNS uuid AS $$
DECLARE
  v_payroll_id uuid;
  v_employee_salary numeric;
  v_start_date date;
  v_end_date date;
  v_base_pay numeric;
  v_net_pay numeric;
  v_attendance record;
  v_working_days integer := 22; -- Standard working days per month
BEGIN
  -- Get employee base salary
  SELECT base_salary INTO v_employee_salary
  FROM employees
  WHERE id = p_employee_id AND company_id = p_company_id;

  IF v_employee_salary IS NULL THEN
    RAISE EXCEPTION 'Employee not found or not in company';
  END IF;

  -- Calculate date range for the month
  v_start_date := (p_year || '-' || LPAD(p_month::text, 2, '0') || '-01')::date;
  v_end_date := (v_start_date + INTERVAL '1 month' - INTERVAL '1 day')::date;

  -- Get attendance for the period
  SELECT * INTO v_attendance
  FROM calculate_attendance(p_employee_id, p_company_id, v_start_date, v_end_date);

  -- Calculate base pay (prorated based on attendance)
  IF v_attendance.total_work_days > 0 THEN
    v_base_pay := (v_employee_salary / v_working_days::numeric) * v_attendance.present_days;
  ELSE
    v_base_pay := 0;
  END IF;

  -- For now, net pay = base pay (no deductions/bonuses yet)
  v_net_pay := v_base_pay;

  -- Generate payroll record
  v_payroll_id := gen_random_uuid();
  
  INSERT INTO payroll_records (
    id,
    company_id,
    employee_id,
    pay_period_start,
    pay_period_end,
    base_pay,
    overtime_pay,
    deductions,
    net_pay,
    payment_date,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_payroll_id,
    p_company_id,
    p_employee_id,
    v_start_date,
    v_end_date,
    v_base_pay,
    0, -- overtime_pay (to be implemented)
    0, -- deductions (to be implemented)
    v_net_pay,
    v_end_date, -- payment date = end of period
    'draft', -- status starts as draft
    now(),
    now()
  );

  RETURN v_payroll_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Generate Payslip ───
CREATE OR REPLACE FUNCTION public.generate_payslip(
  p_payroll_id uuid,
  p_company_id uuid
)
RETURNS TABLE (
  payslip_html text,
  payroll_id uuid,
  employee_name text,
  period_start date,
  period_end date,
  base_pay numeric,
  net_pay numeric,
  attendance_summary text
) AS $$
DECLARE
  v_payroll record;
  v_employee record;
  v_company_name text;
  v_attendance record;
  v_html text;
  v_attendance_summary text;
BEGIN
  -- Get payroll details
  SELECT * INTO v_payroll
  FROM payroll_records
  WHERE id = p_payroll_id AND company_id = p_company_id;

  IF v_payroll IS NULL THEN
    RAISE EXCEPTION 'Payroll record not found';
  END IF;

  -- Get employee details
  SELECT * INTO v_employee
  FROM employees
  WHERE id = v_payroll.employee_id AND company_id = p_company_id;

  -- Get company name
  SELECT name INTO v_company_name
  FROM companies
  WHERE id = p_company_id;

  -- Get attendance summary
  SELECT * INTO v_attendance
  FROM calculate_attendance(v_payroll.employee_id, p_company_id, v_payroll.pay_period_start, v_payroll.pay_period_end);

  -- Build attendance summary text
  v_attendance_summary := format(
    'Working Days: %s | Present: %s | Absent: %s | Late: %s | Attendance: %.1f%%',
    v_attendance.total_work_days,
    v_attendance.present_days,
    v_attendance.absent_days,
    v_attendance.late_count,
    v_attendance.attendance_percentage
  );

  -- Generate HTML payslip
  v_html := format(
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { border-bottom: 3px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .company-name { font-size: 24px; font-weight: bold; }
    .payslip-title { font-size: 16px; color: #666; margin-top: 10px; }
    .section { margin: 30px 0; }
    .section-title { font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 15px; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; }
    .label { font-weight: 500; }
    .amount { text-align: right; }
    .total { border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; font-weight: bold; font-size: 16px; }
    .footer { margin-top: 50px; border-top: 1px solid #ddd; padding-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">%s</div>
    <div class="payslip-title">PAYSLIP</div>
  </div>
  
  <div class="section">
    <div class="section-title">Employee Information</div>
    <div class="row">
      <span class="label">Name:</span>
      <span>%s %s</span>
    </div>
    <div class="row">
      <span class="label">Position:</span>
      <span>%s</span>
    </div>
    <div class="row">
      <span class="label">Department:</span>
      <span>%s</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Pay Period</div>
    <div class="row">
      <span class="label">Period Start:</span>
      <span>%s</span>
    </div>
    <div class="row">
      <span class="label">Period End:</span>
      <span>%s</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Attendance</div>
    <div class="row">
      <span class="label">Summary:</span>
      <span>%s</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Compensation</div>
    <div class="row">
      <span class="label">Base Pay:</span>
      <span class="amount">PHP %s</span>
    </div>
    <div class="row">
      <span class="label">Overtime:</span>
      <span class="amount">PHP %s</span>
    </div>
    <div class="row">
      <span class="label">Deductions:</span>
      <span class="amount">PHP %s</span>
    </div>
    <div class="row total">
      <span class="label">NET PAY:</span>
      <span class="amount">PHP %s</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Status</div>
    <div class="row">
      <span class="label">Status:</span>
      <span>%s</span>
    </div>
  </div>

  <div class="footer">
    <p>This is an automatically generated payslip. Please contact HR if you have any questions.</p>
    <p>Generated: %s</p>
  </div>
</body>
</html>',
    v_company_name,
    v_employee.first_name,
    v_employee.last_name,
    v_employee.position,
    v_employee.department,
    v_payroll.pay_period_start,
    v_payroll.pay_period_end,
    v_attendance_summary,
    ROUND(v_payroll.base_pay, 2),
    ROUND(v_payroll.overtime_pay, 2),
    ROUND(v_payroll.deductions, 2),
    ROUND(v_payroll.net_pay, 2),
    v_payroll.status,
    now()::text
  );

  RETURN QUERY SELECT
    v_html,
    p_payroll_id,
    (v_employee.first_name || ' ' || v_employee.last_name),
    v_payroll.pay_period_start,
    v_payroll.pay_period_end,
    v_payroll.base_pay,
    v_payroll.net_pay,
    v_attendance_summary;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── Comments ───
COMMENT ON FUNCTION public.calculate_attendance(uuid, uuid, date, date) IS 'Calculate attendance summary for employee during a date range';
COMMENT ON FUNCTION public.generate_payroll(uuid, uuid, integer, integer) IS 'Generate payroll record for employee in given month/year';
COMMENT ON FUNCTION public.generate_payslip(uuid, uuid) IS 'Generate HTML payslip for a payroll record';
