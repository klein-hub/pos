/*
  # Add Pay Constants Table and Link Pay Components

  1. New Table
    - `pay_constants`
      - id (bigserial PK)
      - code (text, unique) — programmatic reference (e.g. OT_REGULAR_DAY_MULTIPLIER)
      - name (text, required) — human-friendly name
      - value (numeric, default 0) — the numeric value
      - category (text) — grouping tag (e.g. working_hours, overtime, sss, philhealth, pagibig, tax)
      - description (text) — optional explanation / citation
      - active (bool, default true)
      - created_at / updated_at

  2. Modified Tables
    - `pay_components` — add `pay_constant_id` (bigint FK → pay_constants, nullable)
      replacing the legacy computation fields as the primary computation reference.
      Existing computation columns (amount, percentage, percentage_of_code, formula,
      computation_type) are preserved for backwards compatibility but no longer used
      by the Pay Component form.

  3. Seed Data
    - Philippine Labor Code constants are pre-populated from the laborCode.ts reference
      so payroll administrators can immediately edit their organization's values.

  4. Security
    - RLS enabled on pay_constants
    - Authenticated users can SELECT / INSERT / UPDATE / DELETE
*/

-- ─── Pay Constants ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pay_constants (
  id bigserial PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  value numeric(18, 6) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'general',
  description text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_constants_category ON pay_constants (category);

ALTER TABLE pay_constants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pay_constants' AND policyname = 'Authenticated can view pay constants') THEN
    CREATE POLICY "Authenticated can view pay constants"
      ON pay_constants FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pay_constants' AND policyname = 'Authenticated can insert pay constants') THEN
    CREATE POLICY "Authenticated can insert pay constants"
      ON pay_constants FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pay_constants' AND policyname = 'Authenticated can update pay constants') THEN
    CREATE POLICY "Authenticated can update pay constants"
      ON pay_constants FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pay_constants' AND policyname = 'Authenticated can delete pay constants') THEN
    CREATE POLICY "Authenticated can delete pay constants"
      ON pay_constants FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- ─── Link pay_components to pay_constants ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pay_components' AND column_name = 'pay_constant_id'
  ) THEN
    ALTER TABLE pay_components
      ADD COLUMN pay_constant_id bigint REFERENCES pay_constants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pay_components_pay_constant ON pay_components (pay_constant_id);

-- ─── Seed Labor Code Constants ─────────────────────────────────
INSERT INTO pay_constants (code, name, value, category, description) VALUES
  ('REGULAR_WORK_HOURS_PER_DAY', 'Regular Work Hours Per Day', 8, 'working_hours', 'Art. 83: Normal hours of work'),
  ('REGULAR_WORK_DAYS_PER_WEEK', 'Regular Work Days Per Week', 5, 'working_hours', 'Standard 5-day workweek'),
  ('WORKING_DAYS_PER_MONTH', 'Working Days Per Month', 22, 'working_hours', 'For monthly-rate daily rate computation'),
  ('WORKING_HOURS_PER_MONTH', 'Working Hours Per Month', 176, 'working_hours', '22 days x 8 hours'),

  ('OT_REGULAR_DAY_MULTIPLIER', 'OT Regular Day Multiplier', 1.25, 'overtime', 'Art. 87: Regular day OT = hourly rate x 125%'),
  ('OT_REST_DAY_MULTIPLIER', 'OT Rest Day Multiplier', 1.30, 'overtime', 'Rest day OT (first 8 hrs): hourly rate x 130%'),
  ('OT_REST_DAY_OT_MULTIPLIER', 'OT Rest Day OT Multiplier', 1.69, 'overtime', 'Rest day OT (excess 8 hrs): 1.30 x 1.30'),

  ('REST_DAY_MULTIPLIER', 'Rest Day Multiplier', 1.30, 'rest_day_holiday', 'Work on rest day: +30% of daily rate'),
  ('SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER', 'Special Non-Working Holiday Multiplier', 1.30, 'rest_day_holiday', 'Special non-working holiday: +30%'),
  ('SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER', 'Special Non-Working Holiday OT Multiplier', 1.69, 'rest_day_holiday', 'OT on special non-working holiday'),

  ('REGULAR_HOLIDAY_MULTIPLIER', 'Regular Holiday Multiplier', 2.00, 'rest_day_holiday', 'Art. 94: 200% of daily rate'),
  ('REGULAR_HOLIDAY_OT_MULTIPLIER', 'Regular Holiday OT Multiplier', 2.60, 'rest_day_holiday', 'OT on regular holiday: 200% + 30% thereof'),
  ('REGULAR_HOLIDAY_REST_DAY_MULTIPLIER', 'Regular Holiday + Rest Day Multiplier', 3.00, 'rest_day_holiday', 'Regular holiday on rest day: 300%'),
  ('REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER', 'Regular Holiday + Rest Day OT Multiplier', 3.90, 'rest_day_holiday', 'OT: 300% + 30% thereof'),
  ('REGULAR_HOLIDAY_NO_WORK_MULTIPLIER', 'Regular Holiday No-Work Multiplier', 1.00, 'rest_day_holiday', 'Paid even if not worked'),

  ('NIGHT_SHIFT_START_HOUR', 'Night Shift Start Hour', 22, 'night_diff', '10:00 PM'),
  ('NIGHT_SHIFT_END_HOUR', 'Night Shift End Hour', 6, 'night_diff', '6:00 AM'),
  ('NIGHT_SHIFT_DIFFERENTIAL_RATE', 'Night Shift Differential Rate', 0.10, 'night_diff', 'Art. 86: +10% per night-shift hour'),

  ('THIRTEENTH_MONTH_DIVISOR', '13th Month Divisor', 12, 'thirteenth_month', 'P.D. 851: Basic salary / 12'),

  ('SSS_EMPLOYEE_RATE', 'SSS Employee Rate', 0.045, 'sss', '4.5% employee share'),
  ('SSS_EMPLOYER_RATE', 'SSS Employer Rate', 0.095, 'sss', '9.5% employer share'),
  ('SSS_MIN_MSC', 'SSS Minimum MSC', 4000, 'sss', 'Minimum Monthly Salary Credit'),
  ('SSS_MAX_MSC', 'SSS Maximum MSC', 30000, 'sss', 'Maximum Monthly Salary Credit'),
  ('SSS_EC_LOW', 'SSS EC Low', 10, 'sss', 'EC contribution for MSC < 14,750'),
  ('SSS_EC_HIGH', 'SSS EC High', 30, 'sss', 'EC contribution for MSC >= 14,750'),
  ('SSS_EC_THRESHOLD', 'SSS EC Threshold', 14750, 'sss', 'Threshold MSC for EC rate'),

  ('PHILHEALTH_TOTAL_RATE', 'PhilHealth Total Rate', 0.05, 'philhealth', '5% of monthly basic salary'),
  ('PHILHEALTH_EMPLOYEE_RATE', 'PhilHealth Employee Rate', 0.025, 'philhealth', '2.5% employee share'),
  ('PHILHEALTH_EMPLOYER_RATE', 'PhilHealth Employer Rate', 0.025, 'philhealth', '2.5% employer share'),
  ('PHILHEALTH_MIN_SALARY', 'PhilHealth Minimum Salary Base', 10000, 'philhealth', 'Minimum salary base'),
  ('PHILHEALTH_MAX_SALARY', 'PhilHealth Maximum Salary Base', 100000, 'philhealth', 'Maximum salary base'),
  ('PHILHEALTH_MIN_CONTRIBUTION', 'PhilHealth Minimum Contribution', 250, 'philhealth', 'Minimum employee contribution'),
  ('PHILHEALTH_MAX_CONTRIBUTION', 'PhilHealth Maximum Contribution', 2500, 'philhealth', 'Maximum employee contribution'),

  ('PAGIBIG_RATE_LOW', 'Pag-IBIG Rate Low', 0.01, 'pagibig', '1% for salary <= 1,500'),
  ('PAGIBIG_RATE_HIGH', 'Pag-IBIG Rate High', 0.02, 'pagibig', '2% for salary > 1,500'),
  ('PAGIBIG_SALARY_THRESHOLD', 'Pag-IBIG Salary Threshold', 1500, 'pagibig', 'Threshold for rate change'),
  ('PAGIBIG_EMPLOYEE_MAX', 'Pag-IBIG Employee Max', 100, 'pagibig', 'Maximum employee monthly contribution'),
  ('PAGIBIG_EMPLOYER_RATE', 'Pag-IBIG Employer Rate', 0.02, 'pagibig', 'Employer always pays 2%'),
  ('PAGIBIG_EMPLOYER_MIN', 'Pag-IBIG Employer Min', 200, 'pagibig', 'Minimum employer contribution')
ON CONFLICT (code) DO NOTHING;
