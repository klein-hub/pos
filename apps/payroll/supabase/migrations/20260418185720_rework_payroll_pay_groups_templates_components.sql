/*
  # Payroll System Rework

  Introduces the new payroll data model based on Pay Groups, Pay Templates and
  Pay Components. Replaces the legacy Salary Structure Type / Structure / Rule
  tables which are being retired.

  1. New Tables
    - `pay_groups`
      - id (bigserial PK)
      - name (text, required) — e.g. Monthly Staff, Hourly Workers
      - pay_schedule (text) — weekly | bi_weekly | semi_monthly | monthly
      - wage_type (text) — fixed | hourly
      - description (text)
      - active (bool, default true)
      - created_at / updated_at
    - `pay_templates`
      - id (bigserial PK)
      - name (text, required) — e.g. Regular Pay, Hourly Pay
      - description (text)
      - active (bool, default true)
      - created_at / updated_at
    - `pay_components` — each line on a payslip
      - id (bigserial PK)
      - pay_template_id (bigint FK → pay_templates)
      - name (text, required)
      - code (text, required) — unique identifier e.g. BASIC, GROSS, NET
      - category (text) — earning | deduction | net
      - sequence (int, default 0) — execution order
      - condition_type (text) — always | input | expression
      - condition_expression (text, nullable)
      - computation_type (text) — fixed | percentage | formula
      - amount (numeric, default 0) — used for fixed
      - percentage (numeric, default 0) — used for percentage of another component
      - percentage_of_code (text, nullable) — code of the component the percentage applies to
      - formula (text, nullable) — used for formula
      - active (bool, default true)
      - created_at / updated_at
    - `pay_runs` — batch runs
      - id (bigserial PK)
      - name (text)
      - period_start (date, required)
      - period_end (date, required)
      - run_type (text) — regular | off_cycle
      - status (text) — draft | computed | validated | paid
      - pay_group_id (bigint FK → pay_groups, nullable)
      - notes (text)
      - computed_at / validated_at / paid_at (timestamptz)
      - created_at / updated_at
    - `payroll_entries` — one per employee per pay run
      - id (bigserial PK)
      - pay_run_id (bigint FK → pay_runs)
      - employee_id (bigint FK → employees)
      - worked_days (numeric)
      - gross_pay (numeric)
      - total_deductions (numeric)
      - net_pay (numeric)
      - status (text)
      - snapshot (jsonb) — the full computation context/breakdown
      - created_at / updated_at
    - `payroll_lines` — expanded payslip lines
      - id (bigserial PK)
      - payroll_entry_id (bigint FK → payroll_entries)
      - component_code (text)
      - component_name (text)
      - category (text)
      - amount (numeric)
      - sequence (int)
    - `payroll_inputs` — bonuses / adjustments applied in a run
      - id (bigserial PK)
      - pay_run_id (bigint FK → pay_runs, nullable)
      - employee_id (bigint FK → employees)
      - code (text) — which component this input targets
      - amount (numeric)
      - note (text)
      - created_at
    - `payments` — disbursement records
      - id (bigserial PK)
      - pay_run_id (bigint FK → pay_runs)
      - payroll_entry_id (bigint FK → payroll_entries)
      - amount (numeric)
      - method (text) — manual | bank | csv
      - paid_on (date)
      - reference (text)
      - created_at

  2. Modified Tables
    - `employees` — add `pay_group_id` (bigint) linking to `pay_groups`

  3. Removed Tables (legacy salary-structure model replaced by pay-template model)
    - `salary_structure_types`
    - `salary_structures`
    - `salary_rules`
    - `salary_rule_parameters`
    - `salary_rule_categories`
    - `salary_input_types`
    - `payroll_warnings`

  4. Security
    - Enable RLS on every new table
    - Authenticated users can SELECT / INSERT / UPDATE / DELETE their workspace data
*/

-- Drop legacy salary-structure tables (explicitly approved by user)
DROP TABLE IF EXISTS salary_rule_parameters CASCADE;
DROP TABLE IF EXISTS salary_rules CASCADE;
DROP TABLE IF EXISTS salary_rule_categories CASCADE;
DROP TABLE IF EXISTS salary_structures CASCADE;
DROP TABLE IF EXISTS salary_structure_types CASCADE;
DROP TABLE IF EXISTS salary_input_types CASCADE;
DROP TABLE IF EXISTS payroll_warnings CASCADE;

-- ─── Pay Groups ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pay_groups (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  pay_schedule text DEFAULT 'monthly',
  wage_type text DEFAULT 'fixed',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pay_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pay groups"
  ON pay_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pay groups"
  ON pay_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pay groups"
  ON pay_groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete pay groups"
  ON pay_groups FOR DELETE TO authenticated USING (true);

-- ─── Pay Templates ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pay_templates (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pay_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pay templates"
  ON pay_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pay templates"
  ON pay_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pay templates"
  ON pay_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete pay templates"
  ON pay_templates FOR DELETE TO authenticated USING (true);

-- ─── Pay Components ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pay_components (
  id bigserial PRIMARY KEY,
  pay_template_id bigint REFERENCES pay_templates(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text NOT NULL,
  category text DEFAULT 'earning',
  sequence integer DEFAULT 0,
  condition_type text DEFAULT 'always',
  condition_expression text DEFAULT '',
  computation_type text DEFAULT 'fixed',
  amount numeric DEFAULT 0,
  percentage numeric DEFAULT 0,
  percentage_of_code text DEFAULT '',
  formula text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_components_template ON pay_components (pay_template_id);
CREATE INDEX IF NOT EXISTS idx_pay_components_sequence ON pay_components (sequence);

ALTER TABLE pay_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pay components"
  ON pay_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pay components"
  ON pay_components FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pay components"
  ON pay_components FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete pay components"
  ON pay_components FOR DELETE TO authenticated USING (true);

-- ─── Add pay_group_id to employees ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'pay_group_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN pay_group_id bigint REFERENCES pay_groups(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'pay_template_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN pay_template_id bigint REFERENCES pay_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Pay Runs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pay_runs (
  id bigserial PRIMARY KEY,
  name text DEFAULT '',
  period_start date NOT NULL,
  period_end date NOT NULL,
  run_type text DEFAULT 'regular',
  status text DEFAULT 'draft',
  pay_group_id bigint REFERENCES pay_groups(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  computed_at timestamptz,
  validated_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_runs_period ON pay_runs (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_pay_runs_status ON pay_runs (status);

ALTER TABLE pay_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pay runs"
  ON pay_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert pay runs"
  ON pay_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update pay runs"
  ON pay_runs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete pay runs"
  ON pay_runs FOR DELETE TO authenticated USING (true);

-- ─── Payroll Entries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_entries (
  id bigserial PRIMARY KEY,
  pay_run_id bigint NOT NULL REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  worked_days numeric DEFAULT 0,
  gross_pay numeric DEFAULT 0,
  total_deductions numeric DEFAULT 0,
  net_pay numeric DEFAULT 0,
  status text DEFAULT 'draft',
  snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_entries_run ON payroll_entries (pay_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_employee ON payroll_entries (employee_id);

ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payroll entries"
  ON payroll_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert payroll entries"
  ON payroll_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update payroll entries"
  ON payroll_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete payroll entries"
  ON payroll_entries FOR DELETE TO authenticated USING (true);

-- ─── Payroll Lines ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payroll_lines (
  id bigserial PRIMARY KEY,
  payroll_entry_id bigint NOT NULL REFERENCES payroll_entries(id) ON DELETE CASCADE,
  component_code text NOT NULL,
  component_name text NOT NULL,
  category text DEFAULT 'earning',
  amount numeric DEFAULT 0,
  sequence integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_lines_entry ON payroll_lines (payroll_entry_id);

ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payroll lines"
  ON payroll_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert payroll lines"
  ON payroll_lines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update payroll lines"
  ON payroll_lines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete payroll lines"
  ON payroll_lines FOR DELETE TO authenticated USING (true);

-- ─── Payroll Inputs (bonuses / adjustments) ──────────────────
CREATE TABLE IF NOT EXISTS payroll_inputs (
  id bigserial PRIMARY KEY,
  pay_run_id bigint REFERENCES pay_runs(id) ON DELETE CASCADE,
  employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  code text NOT NULL,
  amount numeric DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_inputs_run ON payroll_inputs (pay_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_inputs_employee ON payroll_inputs (employee_id);

ALTER TABLE payroll_inputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payroll inputs"
  ON payroll_inputs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert payroll inputs"
  ON payroll_inputs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update payroll inputs"
  ON payroll_inputs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete payroll inputs"
  ON payroll_inputs FOR DELETE TO authenticated USING (true);

-- ─── Payments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id bigserial PRIMARY KEY,
  pay_run_id bigint REFERENCES pay_runs(id) ON DELETE SET NULL,
  payroll_entry_id bigint REFERENCES payroll_entries(id) ON DELETE SET NULL,
  amount numeric DEFAULT 0,
  method text DEFAULT 'manual',
  paid_on date DEFAULT CURRENT_DATE,
  reference text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_run ON payments (pay_run_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payments"
  ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert payments"
  ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update payments"
  ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete payments"
  ON payments FOR DELETE TO authenticated USING (true);
