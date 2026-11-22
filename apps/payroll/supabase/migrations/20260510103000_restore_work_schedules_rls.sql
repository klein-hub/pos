/*
  Repair work_schedules RLS policies.

  Some environments have RLS enabled on public.work_schedules but no policies,
  which causes attendance shift reads to return empty arrays and inserts to fail.
*/

ALTER TABLE IF EXISTS public.work_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'work_schedules'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'work_schedules'
        AND policyname = 'Authenticated can view work schedules'
    ) THEN
      CREATE POLICY "Authenticated can view work schedules"
        ON public.work_schedules
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'work_schedules'
        AND policyname = 'Authenticated can insert work schedules'
    ) THEN
      CREATE POLICY "Authenticated can insert work schedules"
        ON public.work_schedules
        FOR INSERT
        TO authenticated
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'work_schedules'
        AND policyname = 'Authenticated can update work schedules'
    ) THEN
      CREATE POLICY "Authenticated can update work schedules"
        ON public.work_schedules
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'work_schedules'
        AND policyname = 'Authenticated can delete work schedules'
    ) THEN
      CREATE POLICY "Authenticated can delete work schedules"
        ON public.work_schedules
        FOR DELETE
        TO authenticated
        USING (true);
    END IF;
  END IF;
END $$;