/*
  # Temporarily relax RLS policies for admin API testing
  
  This migration allows the API to create companies and users without authentication.
  In production, proper authentication and user context should be implemented.
*/

-- Relax companies table RLS for testing
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'companies' AND table_schema = 'public'
  ) THEN
    -- Drop existing restrictive policies
    DROP POLICY IF EXISTS "companies_insert" ON companies;
    DROP POLICY IF EXISTS "companies_select" ON companies;
    DROP POLICY IF EXISTS "companies_update" ON companies;
    DROP POLICY IF EXISTS "companies_delete" ON companies;
    
    -- Allow anyone to create companies for testing
    CREATE POLICY "companies_insert_test"
      ON companies FOR INSERT
      WITH CHECK (true);

    -- Allow anyone to see companies
    CREATE POLICY "companies_select_test"
      ON companies FOR SELECT
      USING (true);
      
    -- Allow updates
    CREATE POLICY "companies_update_test"
      ON companies FOR UPDATE
      USING (true)
      WITH CHECK (true);
      
    -- Allow deletes
    CREATE POLICY "companies_delete_test"
      ON companies FOR DELETE
      USING (true);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error updating companies policies: %', SQLERRM;
END $$;

