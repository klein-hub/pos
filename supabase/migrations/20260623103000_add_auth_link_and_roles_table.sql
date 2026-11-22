/*
  # Add Employee Auth Link and Roles Table

  ## Summary
  - Adds employees.auth_user_id link to auth.users for deterministic account/profile updates
  - Ensures roles table exists and seeds standard roles
  - Keeps profile.role_id foreign key aligned to roles table
*/

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_auth_user_id
  ON employees(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text
);

INSERT INTO roles (id, name, created_at, description)
VALUES
  ('23972eb3-6516-4695-b0c4-6d08224b2807', 'user', '2026-03-08T10:41:41.453348+00:00', 'Default role for regular users'),
  ('2f8d98a1-abea-4d02-b6aa-5d590a56a98e', 'viewer', '2026-05-03T12:12:17.67179+00:00', 'Read-only viewer'),
  ('f493013e-ca14-4b57-a2a2-4466fe55f4bc', 'manager', '2026-05-03T12:12:17.67179+00:00', 'Have access to all comapany data except delete'),
  ('521f1775-6455-4caa-9892-da14fcdf09c1', 'super_admin', '2026-03-08T11:09:29.136058+00:00', 'Have access to all'),
  ('c5620882-5a52-4b56-8968-656975c6a74a', 'admin', '2026-03-08T11:03:58.675915+00:00', 'Administrator role')
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  created_at = EXCLUDED.created_at,
  description = EXCLUDED.description;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND constraint_name = 'profiles_role_id_fkey'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
