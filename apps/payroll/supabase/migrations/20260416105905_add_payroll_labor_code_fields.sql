/*
  # Add Philippine Labor Code fields to payroll table

  1. Changes to `payroll` table
    - day_type: regular, rest_day, special_non_working, regular_holiday, regular_holiday_rest_day
    - late_minutes, undertime_minutes, absent_days: time/attendance deductions
    - regular_pay, overtime_pay, holiday_pay, bonuses: earnings breakdown
    - other_deductions, withholding_tax: deduction breakdown
    - net_pay: final take-home pay
    - status: draft, pending, paid
    - notes: optional notes
    - created_at, updated_at: timestamps

  2. Security
    - Add RLS policies for all CRUD operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'day_type'
  ) THEN
    ALTER TABLE payroll ADD COLUMN day_type text NOT NULL DEFAULT 'regular';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'late_minutes'
  ) THEN
    ALTER TABLE payroll ADD COLUMN late_minutes numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'undertime_minutes'
  ) THEN
    ALTER TABLE payroll ADD COLUMN undertime_minutes numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'absent_days'
  ) THEN
    ALTER TABLE payroll ADD COLUMN absent_days numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'regular_pay'
  ) THEN
    ALTER TABLE payroll ADD COLUMN regular_pay numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'overtime_pay'
  ) THEN
    ALTER TABLE payroll ADD COLUMN overtime_pay numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'holiday_pay'
  ) THEN
    ALTER TABLE payroll ADD COLUMN holiday_pay numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'bonuses'
  ) THEN
    ALTER TABLE payroll ADD COLUMN bonuses numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'other_deductions'
  ) THEN
    ALTER TABLE payroll ADD COLUMN other_deductions numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'withholding_tax'
  ) THEN
    ALTER TABLE payroll ADD COLUMN withholding_tax numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'net_pay'
  ) THEN
    ALTER TABLE payroll ADD COLUMN net_pay numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'status'
  ) THEN
    ALTER TABLE payroll ADD COLUMN status text NOT NULL DEFAULT 'draft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'notes'
  ) THEN
    ALTER TABLE payroll ADD COLUMN notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE payroll ADD COLUMN created_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE payroll ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payroll' AND policyname = 'Authenticated users can read payroll'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can read payroll" ON payroll FOR SELECT TO authenticated USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payroll' AND policyname = 'Authenticated users can insert payroll'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can insert payroll" ON payroll FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payroll' AND policyname = 'Authenticated users can update payroll'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can update payroll" ON payroll FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payroll' AND policyname = 'Authenticated users can delete payroll'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can delete payroll" ON payroll FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;
