/*
  # Configuration Tables for Employees, Payroll, and Attendance

  ## Summary
  Adds configuration/lookup tables used by the "Configuration" menus
  on the Employees, Payroll, and Attendance pages.

  ## New Tables

  ### Employee Configuration
  - `work_locations` - On-site, home, or other work locations
  - `departure_reasons` - Reasons employees depart the company
  - `skill_types` - Types of skills (technical, language, etc.)
  - `job_positions` - Open job positions
  - `contract_templates` - Reusable contract templates
  - `onboarding_plans` - Onboarding / offboarding checklists

  ### Payroll Configuration
  - `work_entry_types` - Types of work entries (regular, OT, sick, etc.)
  - `salary_structure_types` - Top-level salary structure types
  - `salary_structures` - Individual salary structures
  - `salary_rules` - Salary calculation rules
  - `salary_rule_parameters` - Parameters referenced by rules
  - `salary_rule_categories` - Grouping categories for rules
  - `salary_input_types` - Extra input types on payslips
  - `payroll_warnings` - Warnings surfaced on the payroll dashboard

  ### Attendance Configuration
  - `attendance_modes` - Kiosk / mobile / biometric modes
  - `attendance_reasons` - Late / absent / overtime reason codes

  ## Security
  - RLS enabled on every new table
  - Separate policies for SELECT / INSERT / UPDATE / DELETE
  - Authenticated users only
*/

-- ─── Employee configuration ──────────────────────────────

CREATE TABLE IF NOT EXISTS work_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  address text DEFAULT '',
  location_type text DEFAULT 'office',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS departure_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skill_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  department_id bigint REFERENCES departments(id) ON DELETE SET NULL,
  description text DEFAULT '',
  is_published boolean DEFAULT false,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  body text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS onboarding_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  plan_type text DEFAULT 'onboarding',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Payroll configuration ───────────────────────────────

CREATE TABLE IF NOT EXISTS work_entry_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  code text DEFAULT '',
  is_paid boolean DEFAULT true,
  color text DEFAULT '#3B82F6',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_structure_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  structure_type_id uuid REFERENCES salary_structure_types(id) ON DELETE SET NULL,
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_rule_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  code text DEFAULT '',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  code text DEFAULT '',
  amount_type text DEFAULT 'fixed',
  amount numeric DEFAULT 0,
  category_id uuid REFERENCES salary_rule_categories(id) ON DELETE SET NULL,
  structure_id uuid REFERENCES salary_structures(id) ON DELETE SET NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_rule_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  code text DEFAULT '',
  value text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salary_input_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  code text DEFAULT '',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payroll_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  message text DEFAULT '',
  severity text DEFAULT 'info',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Attendance configuration ────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_modes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  reason_type text DEFAULT 'late',
  description text DEFAULT '',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── Enable RLS + policies (authenticated full access) ───

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'work_locations','departure_reasons','skill_types','job_positions',
    'contract_templates','onboarding_plans',
    'work_entry_types','salary_structure_types','salary_structures',
    'salary_rule_categories','salary_rules','salary_rule_parameters',
    'salary_input_types','payroll_warnings',
    'attendance_modes','attendance_reasons'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format($f$
      CREATE POLICY "Authenticated users can select %1$s"
      ON %1$I FOR SELECT TO authenticated USING (true);
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Authenticated users can insert %1$s"
      ON %1$I FOR INSERT TO authenticated WITH CHECK (true);
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Authenticated users can update %1$s"
      ON %1$I FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "Authenticated users can delete %1$s"
      ON %1$I FOR DELETE TO authenticated USING (true);
    $f$, t);
  END LOOP;
END $$;
