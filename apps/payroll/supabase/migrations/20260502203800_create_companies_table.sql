/*
  # Create Companies Table

  1. New Tables
    - `companies`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on companies table
    - Add policy for super admin access (for now, unrestricted)
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on name for faster lookups
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can select all companies
CREATE POLICY "Authenticated users can select companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Super admin can insert companies (for now, allow all authenticated)
CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Super admin can update companies
CREATE POLICY "Authenticated users can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Super admin can delete companies
CREATE POLICY "Authenticated users can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (true);
