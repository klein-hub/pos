/*
  # Add company_id to Main Tables

  Adds multi-tenant support to employees, payroll_records, and creates attendance table.
  - `employees` table: add company_id column
  - `payroll_records` table: add company_id column
  - `attendance` table: new table with company_id
*/

-- Add company_id to employees table (nullable to avoid FK violations on existing rows)
ALTER TABLE IF EXISTS employees
ADD COLUMN IF NOT EXISTS company_id uuid;

-- Add foreign key constraint for employees.company_id
ALTER TABLE IF EXISTS employees
ADD CONSTRAINT IF NOT EXISTS fk_employees_company_id
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- Create index on employees.company_id for faster queries
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- Add company_id to payroll_records table (nullable to avoid FK violations on existing rows)
ALTER TABLE IF EXISTS payroll_records
ADD COLUMN IF NOT EXISTS company_id uuid;

-- Add foreign key constraint for payroll_records.company_id
ALTER TABLE IF EXISTS payroll_records
ADD CONSTRAINT IF NOT EXISTS fk_payroll_records_company_id
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

-- Create index on payroll_records.company_id for faster queries
CREATE INDEX IF NOT EXISTS idx_payroll_records_company_id ON payroll_records(company_id);

-- Create attendance table for tracking employee attendance
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'present', -- present, absent, late, half-day
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes on attendance table (if columns exist)
DO $$ BEGIN
  -- Index on company_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'company_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_company_id ON attendance(company_id);
  END IF;
  
  -- Index on employee_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'employee_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
  END IF;
  
  -- Index on attendance_date
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'attendance_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
  END IF;
  
  -- Composite index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'company_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'employee_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'attendance_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_attendance_company_employee_date ON attendance(company_id, employee_id, attendance_date);
  END IF;
  
  -- Unique index
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'employee_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance' AND column_name = 'attendance_date'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_per_day ON attendance(employee_id, attendance_date);
  END IF;
END $$;

-- Enable RLS on attendance table
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can select attendance (refined by company later)
CREATE POLICY "Authenticated users can select attendance"
  ON attendance FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can insert attendance
CREATE POLICY "Authenticated users can insert attendance"
  ON attendance FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can update attendance
CREATE POLICY "Authenticated users can update attendance"
  ON attendance FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can delete attendance
CREATE POLICY "Authenticated users can delete attendance"
  ON attendance FOR DELETE
  TO authenticated
  USING (true);
