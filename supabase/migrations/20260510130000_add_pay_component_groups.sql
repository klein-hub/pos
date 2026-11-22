/*
  # Add reusable payroll rule groups

  1. New table `pay_component_groups`
    - stores reusable groups of payroll rule codes
    - lets pay templates point a block at a named group instead of hardcoded sample rows

  2. Security
    - enable RLS
    - authenticated users can manage groups
*/

CREATE TABLE IF NOT EXISTS pay_component_groups (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'mixed',
  description text DEFAULT '',
  component_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_component_groups_category
  ON pay_component_groups (category);

ALTER TABLE pay_component_groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_component_groups'
      AND policyname = 'Authenticated can view pay component groups'
  ) THEN
    CREATE POLICY "Authenticated can view pay component groups"
      ON public.pay_component_groups
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_component_groups'
      AND policyname = 'Authenticated can insert pay component groups'
  ) THEN
    CREATE POLICY "Authenticated can insert pay component groups"
      ON public.pay_component_groups
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_component_groups'
      AND policyname = 'Authenticated can update pay component groups'
  ) THEN
    CREATE POLICY "Authenticated can update pay component groups"
      ON public.pay_component_groups
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_component_groups'
      AND policyname = 'Authenticated can delete pay component groups'
  ) THEN
    CREATE POLICY "Authenticated can delete pay component groups"
      ON public.pay_component_groups
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;