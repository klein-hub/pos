/*
  # Add Personal Information fields and Bank Accounts table

  ## Summary
  Adds personal/private contact, citizenship, emergency contact, location,
  and visa fields to the employees table, plus a separate bank_accounts table
  linked to employees (employee_id is bigint to match employees.id).

  ## New Columns on `employees`
  - private_email, private_phone
  - birthday, place_of_birth, country_of_birth, gender
  - nationality, identification_no, passport_no
  - emergency_contact_name, emergency_contact_phone
  - private_street, private_street2, private_city, private_state, private_zip, private_country
  - visa_no, work_permit_no

  ## New Table: `bank_accounts`
  - id (uuid PK), employee_id (bigint FK), account_number, clearing_number,
    bic_swift, holder_name, bank_name, bank address fields, notes, created_at

  ## Security
  - RLS enabled on bank_accounts with policies for authenticated users
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_email') THEN
    ALTER TABLE employees ADD COLUMN private_email text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_phone') THEN
    ALTER TABLE employees ADD COLUMN private_phone text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'birthday') THEN
    ALTER TABLE employees ADD COLUMN birthday date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'place_of_birth') THEN
    ALTER TABLE employees ADD COLUMN place_of_birth text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'country_of_birth') THEN
    ALTER TABLE employees ADD COLUMN country_of_birth text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'gender') THEN
    ALTER TABLE employees ADD COLUMN gender text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'nationality') THEN
    ALTER TABLE employees ADD COLUMN nationality text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'identification_no') THEN
    ALTER TABLE employees ADD COLUMN identification_no text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'passport_no') THEN
    ALTER TABLE employees ADD COLUMN passport_no text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'emergency_contact_name') THEN
    ALTER TABLE employees ADD COLUMN emergency_contact_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'emergency_contact_phone') THEN
    ALTER TABLE employees ADD COLUMN emergency_contact_phone text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_street') THEN
    ALTER TABLE employees ADD COLUMN private_street text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_street2') THEN
    ALTER TABLE employees ADD COLUMN private_street2 text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_city') THEN
    ALTER TABLE employees ADD COLUMN private_city text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_state') THEN
    ALTER TABLE employees ADD COLUMN private_state text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_zip') THEN
    ALTER TABLE employees ADD COLUMN private_zip text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'private_country') THEN
    ALTER TABLE employees ADD COLUMN private_country text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'visa_no') THEN
    ALTER TABLE employees ADD COLUMN visa_no text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'work_permit_no') THEN
    ALTER TABLE employees ADD COLUMN work_permit_no text DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  account_number text DEFAULT '',
  clearing_number text DEFAULT '',
  bic_swift text DEFAULT '',
  holder_name text DEFAULT '',
  bank_name text DEFAULT '',
  bank_street text DEFAULT '',
  bank_street2 text DEFAULT '',
  bank_city text DEFAULT '',
  bank_state text DEFAULT '',
  bank_zip text DEFAULT '',
  bank_country text DEFAULT 'Philippines',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert bank accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bank accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bank accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (true);
