/*
  # Payroll System Schema

  1. New Tables
    - `employees`
      - `id` (uuid, primary key)
      - `first_name` (text)
      - `last_name` (text)
      - `email` (text, unique)
      - `position` (text)
      - `department` (text)
      - `hire_date` (date)
      - `base_salary` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `payroll_records`
      - `id` (uuid, primary key)
      - `employee_id` (uuid, foreign key)
      - `pay_period_start` (date)
      - `pay_period_end` (date)
      - `base_pay` (numeric)
      - `overtime_pay` (numeric)
      - `deductions` (numeric)
      - `net_pay` (numeric)
      - `payment_date` (date)
      - `status` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their data
*/

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text UNIQUE NOT NULL,
    position text NOT NULL,
    department text NOT NULL,
    hire_date date NOT NULL,
    base_salary numeric NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create payroll_records table
CREATE TABLE IF NOT EXISTS payroll_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    pay_period_start date NOT NULL,
    pay_period_end date NOT NULL,
    base_pay numeric NOT NULL,
    overtime_pay numeric DEFAULT 0,
    deductions numeric DEFAULT 0,
    net_pay numeric NOT NULL,
    payment_date date NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Create policies for employees table
CREATE POLICY "Allow authenticated users to read employees"
    ON employees
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert employees"
    ON employees
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update employees"
    ON employees
    FOR UPDATE
    TO authenticated
    USING (true);

-- Create policies for payroll_records table
CREATE POLICY "Allow authenticated users to read payroll records"
    ON payroll_records
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert payroll records"
    ON payroll_records
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update payroll records"
    ON payroll_records
    FOR UPDATE
    TO authenticated
    USING (true);