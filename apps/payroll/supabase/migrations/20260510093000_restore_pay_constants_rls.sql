/*
  Repair pay_constants RLS policies.

  Some environments already have rows in public.pay_constants, but the table has
  RLS enabled with no policies present. In that state, authenticated clients see
  an empty result set and inserts fail even though the data exists.
*/

ALTER TABLE public.pay_constants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_constants'
      AND policyname = 'Authenticated can view pay constants'
  ) THEN
    CREATE POLICY "Authenticated can view pay constants"
      ON public.pay_constants
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_constants'
      AND policyname = 'Authenticated can insert pay constants'
  ) THEN
    CREATE POLICY "Authenticated can insert pay constants"
      ON public.pay_constants
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_constants'
      AND policyname = 'Authenticated can update pay constants'
  ) THEN
    CREATE POLICY "Authenticated can update pay constants"
      ON public.pay_constants
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pay_constants'
      AND policyname = 'Authenticated can delete pay constants'
  ) THEN
    CREATE POLICY "Authenticated can delete pay constants"
      ON public.pay_constants
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;