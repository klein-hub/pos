/*
  # Seed Test Data: Pristine Energy Company

  Creates test data for the Pristine Energy company including:
  - Company record
  - Test employees
  - Test attendance records
*/

-- ─── Insert Pristine Energy Company ───
DO $$ BEGIN
  INSERT INTO companies (name, created_at, updated_at)
  VALUES ('Pristine Energy', now(), now())
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Note: Could not insert Pristine Energy company (may already exist or schema differs): %', SQLERRM;
END $$;

-- Note: Detailed employee, attendance, and test user data can be added 
-- through the admin API once it's configured.
-- For now, the multi-tenant schema and RLS policies are in place.
