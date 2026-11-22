-- Seed pay_constants with all values from laborCode.ts (Philippine Labor Code)
-- Uses ON CONFLICT (code) DO NOTHING so re-running is safe and won't overwrite user edits.

INSERT INTO pay_constants (code, name, value, category, description, value_type)
VALUES

  -- ─── Standard Working Hours ────────────────────────────────────────────────
  ('REGULAR_WORK_HOURS_PER_DAY',   'Regular Work Hours Per Day',   8,   'working_hours', 'Art. 83: Normal hours of work per day', 'fixed'),
  ('REGULAR_WORK_DAYS_PER_WEEK',   'Regular Work Days Per Week',   5,   'working_hours', 'Standard 5-day workweek', 'fixed'),
  ('WORKING_DAYS_PER_MONTH',       'Working Days Per Month',       22,  'working_hours', 'Used for monthly-rate daily rate computation', 'fixed'),
  ('WORKING_HOURS_PER_MONTH',      'Working Hours Per Month',      176, 'working_hours', '22 days × 8 hours', 'fixed'),

  -- ─── Overtime Pay (Art. 87) ────────────────────────────────────────────────
  ('OT_REGULAR_DAY_MULTIPLIER',    'OT Regular Day Multiplier',    1.25,  'overtime', 'Regular day OT: hourly rate × 125% (Art. 87)', 'fixed'),
  ('OT_REST_DAY_MULTIPLIER',       'OT Rest Day Multiplier',       1.30,  'overtime', 'Rest day OT first 8 hrs: hourly rate × 130%', 'fixed'),
  ('OT_REST_DAY_OT_MULTIPLIER',    'OT Rest Day Excess Multiplier',1.69,  'overtime', 'Rest day OT excess of 8 hrs: × 130% on rest day rate = 1.69×', 'fixed'),

  -- ─── Rest Day & Special Days (Art. 91–93) ─────────────────────────────────
  ('REST_DAY_MULTIPLIER',                        'Rest Day Multiplier',                        1.30, 'rest_day_holiday', 'Work on rest day: +30% of daily rate (Art. 91)', 'fixed'),
  ('SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER',     'Special Non-Working Holiday Multiplier',     1.30, 'rest_day_holiday', 'Special non-working holiday: +30% (Art. 93)', 'fixed'),
  ('SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER',  'Special Non-Working Holiday OT Multiplier',  1.69, 'rest_day_holiday', 'OT on special non-working holiday: 1.30 × 1.30', 'fixed'),

  -- ─── Regular Holiday Pay (Art. 94) ────────────────────────────────────────
  ('REGULAR_HOLIDAY_MULTIPLIER',              'Regular Holiday Multiplier',              2.00, 'rest_day_holiday', 'Work on regular holiday: 200% of daily rate (double pay, Art. 94)', 'fixed'),
  ('REGULAR_HOLIDAY_OT_MULTIPLIER',           'Regular Holiday OT Multiplier',           2.60, 'rest_day_holiday', 'OT on regular holiday: 200% + 30% thereof = 260%', 'fixed'),
  ('REGULAR_HOLIDAY_REST_DAY_MULTIPLIER',     'Regular Holiday Rest Day Multiplier',     3.00, 'rest_day_holiday', 'Work on regular holiday that falls on rest day: 300%', 'fixed'),
  ('REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER',  'Regular Holiday Rest Day OT Multiplier',  3.90, 'rest_day_holiday', 'OT on regular holiday rest day: 300% + 30% thereof = 390%', 'fixed'),
  ('REGULAR_HOLIDAY_NO_WORK_MULTIPLIER',      'Regular Holiday No-Work Multiplier',      1.00, 'rest_day_holiday', 'Art. 94: Employee still paid 100% even if not worked', 'fixed'),

  -- ─── Night Shift Differential (Art. 86) ───────────────────────────────────
  ('NIGHT_SHIFT_DIFFERENTIAL_RATE',  'Night Shift Differential Rate',       0.10,  'night_diff', '10% additional on top of hourly rate for work between 10PM–6AM (Art. 86)', 'fixed'),
  ('NIGHT_SHIFT_START_HOUR',         'Night Shift Start Hour',              22,    'night_diff', 'Night shift starts at 10:00 PM (hour 22)', 'fixed'),
  ('NIGHT_SHIFT_END_HOUR',           'Night Shift End Hour',                6,     'night_diff', 'Night shift ends at 6:00 AM (hour 6)', 'fixed'),

  -- NSD + OT composite rates (formula-based)
  ('NSD_OT_REGULAR_DAY',      'NSD + OT Regular Day Multiplier',  1.375, 'night_diff', 'OT_REGULAR_DAY_MULTIPLIER × (1 + NSD Rate) = 1.25 × 1.10', 'formula'),
  ('NSD_OT_REST_DAY',         'NSD + OT Rest Day Multiplier',     1.859, 'night_diff', 'OT_REST_DAY_OT_MULTIPLIER × (1 + NSD Rate) = 1.69 × 1.10', 'formula'),
  ('NSD_OT_REGULAR_HOLIDAY',  'NSD + OT Regular Holiday Multiplier', 2.860, 'night_diff', 'REGULAR_HOLIDAY_OT_MULTIPLIER × (1 + NSD Rate) = 2.60 × 1.10', 'formula'),

  -- ─── 13th Month Pay (P.D. 851) ────────────────────────────────────────────
  ('THIRTEENTH_MONTH_DIVISOR', '13th Month Pay Divisor', 12, 'thirteenth_month', 'Total basic salary earned in a calendar year ÷ 12 (P.D. 851)', 'fixed'),

  -- ─── SSS Contribution (2023 Schedule, R.A. 11199) ─────────────────────────
  ('SSS_EMPLOYEE_RATE',   'SSS Employee Contribution Rate',   0.045,  'sss', '4.5% of Monthly Salary Credit (employee share)', 'fixed'),
  ('SSS_EMPLOYER_RATE',   'SSS Employer Contribution Rate',   0.095,  'sss', '9.5% of Monthly Salary Credit (employer share)', 'fixed'),
  ('SSS_MIN_MSC',         'SSS Minimum Monthly Salary Credit',4000,   'sss', 'Minimum MSC for SSS computation', 'fixed'),
  ('SSS_MAX_MSC',         'SSS Maximum Monthly Salary Credit',30000,  'sss', 'Maximum MSC for SSS computation', 'fixed'),
  ('SSS_EC_LOW',          'SSS EC Contribution (Low)',        10,     'sss', 'Employee Compensation contribution for MSC < ₱14,750', 'fixed'),
  ('SSS_EC_HIGH',         'SSS EC Contribution (High)',       30,     'sss', 'Employee Compensation contribution for MSC ≥ ₱14,750', 'fixed'),
  ('SSS_EC_THRESHOLD',    'SSS EC MSC Threshold',             14750,  'sss', 'MSC threshold that determines EC contribution level', 'fixed'),

  -- ─── PhilHealth Contribution (2024 Schedule, R.A. 11223) ─────────────────
  ('PHILHEALTH_TOTAL_RATE',          'PhilHealth Total Premium Rate',          0.05,   'philhealth', '5% of basic monthly salary total premium (UHC Act)', 'fixed'),
  ('PHILHEALTH_EMPLOYEE_RATE',       'PhilHealth Employee Share Rate',         0.025,  'philhealth', '2.5% employee share of PhilHealth premium', 'fixed'),
  ('PHILHEALTH_EMPLOYER_RATE',       'PhilHealth Employer Share Rate',         0.025,  'philhealth', '2.5% employer share of PhilHealth premium', 'fixed'),
  ('PHILHEALTH_MIN_SALARY',          'PhilHealth Minimum Salary Base',         10000,  'philhealth', 'Minimum salary base for PhilHealth computation', 'fixed'),
  ('PHILHEALTH_MAX_SALARY',          'PhilHealth Maximum Salary Base',         100000, 'philhealth', 'Maximum salary base for PhilHealth computation (₱100,000)', 'fixed'),
  ('PHILHEALTH_MIN_CONTRIBUTION',    'PhilHealth Minimum Employee Contribution',250,   'philhealth', 'Minimum employee monthly PhilHealth contribution', 'fixed'),
  ('PHILHEALTH_MAX_CONTRIBUTION',    'PhilHealth Maximum Employee Contribution',2500,  'philhealth', 'Maximum employee monthly PhilHealth contribution', 'fixed'),

  -- ─── Pag-IBIG / HDMF Contribution (R.A. 9679) ────────────────────────────
  ('PAGIBIG_RATE_LOW',          'Pag-IBIG Rate (Low Salary)',    0.01, 'pagibig', '1% employee contribution for monthly compensation ≤ ₱1,500', 'fixed'),
  ('PAGIBIG_RATE_HIGH',         'Pag-IBIG Rate (High Salary)',   0.02, 'pagibig', '2% employee contribution for monthly compensation > ₱1,500', 'fixed'),
  ('PAGIBIG_SALARY_THRESHOLD',  'Pag-IBIG Salary Threshold',     1500, 'pagibig', 'Salary threshold that determines Pag-IBIG employee rate', 'fixed'),
  ('PAGIBIG_EMPLOYEE_MAX',      'Pag-IBIG Employee Max Monthly', 100,  'pagibig', 'Maximum employee monthly Pag-IBIG contribution', 'fixed'),
  ('PAGIBIG_EMPLOYER_RATE',     'Pag-IBIG Employer Rate',        0.02, 'pagibig', 'Employer always pays 2% of employee monthly compensation', 'fixed'),
  ('PAGIBIG_EMPLOYER_MIN',      'Pag-IBIG Employer Minimum',     200,  'pagibig', 'Minimum employer monthly Pag-IBIG contribution', 'fixed')

ON CONFLICT (code) DO NOTHING;
