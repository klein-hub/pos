/*
  # Create Profiles Table

  ## Summary
  Creates a profiles table to store user profile information linked to auth.users.
  This table is used for user accounts created for employees by super admins.

  ## New Table: `profiles`
  - id (uuid PK, references auth.users.id)
  - email (text, unique)
  - first_name (text)
  - last_name (text)
  - employee_id (uuid FK to employees.id)
  - role (text, default 'employee')
  - created_at (timestamptz)
  - updated_at (timestamptz)

  ## Security
  - RLS enabled on profiles
  - Super admin can create/view all profiles
  - Users can view their own profile
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    first_name text,
    last_name text,
    employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
    role text DEFAULT 'employee',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read their own profile
CREATE POLICY "Users can read their own profile"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Policy: Super admin can read all profiles
-- This will check if the user is a super admin by checking if their email is in the super admin list
CREATE POLICY "Super admin can read all profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (
        (SELECT auth.email() IN (
            SELECT email FROM auth.users WHERE email = 'kleinhans.esc@gmail.com'
        ))
        OR
        (SELECT auth.jwt() ->> 'role' = 'super_admin')
    );

-- Policy: Super admin can insert profiles
CREATE POLICY "Super admin can insert profiles"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (SELECT auth.email() IN (
            SELECT email FROM auth.users WHERE email = 'kleinhans.esc@gmail.com'
        ))
        OR
        (SELECT auth.jwt() ->> 'role' = 'super_admin')
    );

-- Policy: Super admin can update profiles
CREATE POLICY "Super admin can update profiles"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (
        (SELECT auth.email() IN (
            SELECT email FROM auth.users WHERE email = 'kleinhans.esc@gmail.com'
        ))
        OR
        (SELECT auth.jwt() ->> 'role' = 'super_admin')
    );

-- Index for faster lookups
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_employee_id ON profiles(employee_id);
CREATE INDEX idx_profiles_role ON profiles(role);
