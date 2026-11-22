/*
  # Align Profiles Schema

  ## Summary
  Updates public.profiles to match the company-centric schema used by the
  employee credentials flow.

  ## Final Shape
  - id uuid primary key
  - company_id uuid nullable
  - first_name text nullable
  - avatar_url text nullable
  - created_at timestamptz nullable
  - updated_at timestamptz nullable
  - role_id uuid nullable
  - last_name text nullable
  - is_deleted boolean nullable
  - role text not null
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_id uuid;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

ALTER TABLE profiles
  ALTER COLUMN role SET DEFAULT 'employee';

ALTER TABLE profiles
  ALTER COLUMN role SET NOT NULL;

UPDATE profiles
SET role = COALESCE(role, 'employee');

UPDATE profiles
SET is_deleted = COALESCE(is_deleted, false);

ALTER TABLE profiles
  DROP COLUMN IF EXISTS email;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS employee_id;

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted);