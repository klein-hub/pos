/*
  # Add RLS Policies for Multi-Tenant Isolation

  Implements company-scoped access control:
  - Users can only access their assigned company's data
  - Admins can manage their company's employees and payroll
  - Employees can view only their own records
*/

-- ─── Helper Function: Get user's company IDs ───
CREATE OR REPLACE FUNCTION public.get_user_companies()
RETURNS TABLE(company_id uuid, role text) AS $$
SELECT c.id, COALESCE((auth.jwt() ->> 'role')::text, 'employee')
FROM companies c
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ─── Helper Function: Is user super admin? ───
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
SELECT COALESCE(auth.jwt() ->> 'role', '') = 'super_admin'
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ─── Helper Function: Is user admin of company? ───
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean AS $$
SELECT COALESCE(auth.jwt() ->> 'role', '') IN ('admin', 'super_admin')
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ─── Helper Function: Is user assigned to company? ───
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean AS $$
SELECT auth.uid() IS NOT NULL
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- ─── COMPANIES Table: RLS Policies ───
DO $$ BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Authenticated users can select companies" ON companies;
  DROP POLICY IF EXISTS "Authenticated users can insert companies" ON companies;
  DROP POLICY IF EXISTS "Authenticated users can update companies" ON companies;
  DROP POLICY IF EXISTS "Authenticated users can delete companies" ON companies;
  
  -- Super admin can select all companies, regular users see only assigned companies
  CREATE POLICY "companies_select"
    ON companies FOR SELECT
    TO authenticated
    USING (
      is_super_admin() OR 
      id IN (SELECT company_id FROM get_user_companies())
    );

  -- Super admin can insert companies
  CREATE POLICY "companies_insert"
    ON companies FOR INSERT
    TO authenticated
    WITH CHECK (is_super_admin());

  -- Super admin can update companies
  CREATE POLICY "companies_update"
    ON companies FOR UPDATE
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

  -- Super admin can delete companies
  CREATE POLICY "companies_delete"
    ON companies FOR DELETE
    TO authenticated
    USING (is_super_admin());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting policies on companies: %', SQLERRM;
END $$;

-- ─── EMPLOYEES Table: RLS Policies ───
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'employees' AND table_schema = 'public'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to read employees" ON employees;
    DROP POLICY IF EXISTS "Allow authenticated users to manage employees" ON employees;

    -- Users can view employees from their assigned companies
    CREATE POLICY "employees_select"
      ON employees FOR SELECT
      TO authenticated
      USING (
        is_super_admin() OR 
        company_id IN (SELECT company_id FROM get_user_companies())
      );

    -- Company admin can insert employees
    CREATE POLICY "employees_insert"
      ON employees FOR INSERT
      TO authenticated
      WITH CHECK (
        is_super_admin() OR is_company_admin(company_id)
      );

    -- Company admin can update employees in their company
    CREATE POLICY "employees_update"
      ON employees FOR UPDATE
      TO authenticated
      USING (is_super_admin() OR is_company_admin(company_id))
      WITH CHECK (is_super_admin() OR is_company_admin(company_id));

    -- Company admin can delete employees
    CREATE POLICY "employees_delete"
      ON employees FOR DELETE
      TO authenticated
      USING (is_super_admin() OR is_company_admin(company_id));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting policies on employees: %', SQLERRM;
END $$;

-- ─── PAYROLL_RECORDS Table: RLS Policies (if table exists) ───
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'payroll_records' AND table_schema = 'public'
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to read payroll_records" ON payroll_records;
    DROP POLICY IF EXISTS "Allow authenticated users to manage payroll_records" ON payroll_records;

    -- Users can view payroll records from their assigned companies
    CREATE POLICY "payroll_records_select"
      ON payroll_records FOR SELECT
      TO authenticated
      USING (
        is_super_admin() OR 
        company_id IN (SELECT company_id FROM get_user_companies())
      );

    -- Company admin can insert payroll records
    CREATE POLICY "payroll_records_insert"
      ON payroll_records FOR INSERT
      TO authenticated
      WITH CHECK (
        is_super_admin() OR is_company_admin(company_id)
      );

    -- Company admin can update payroll records
    CREATE POLICY "payroll_records_update"
      ON payroll_records FOR UPDATE
      TO authenticated
      USING (is_super_admin() OR is_company_admin(company_id))
      WITH CHECK (is_super_admin() OR is_company_admin(company_id));

    -- Company admin can delete payroll records
    CREATE POLICY "payroll_records_delete"
      ON payroll_records FOR DELETE
      TO authenticated
      USING (is_super_admin() OR is_company_admin(company_id));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting policies on payroll_records: %', SQLERRM;
END $$;

-- ─── ATTENDANCE Table: RLS Policies ───
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'attendance' AND table_schema = 'public'
  ) THEN
    DROP POLICY IF EXISTS "Authenticated users can select attendance" ON attendance;
    DROP POLICY IF EXISTS "Authenticated users can insert attendance" ON attendance;
    DROP POLICY IF EXISTS "Authenticated users can update attendance" ON attendance;
    DROP POLICY IF EXISTS "Authenticated users can delete attendance" ON attendance;

    -- Users can view attendance from their assigned companies
    CREATE POLICY "attendance_select"
      ON attendance FOR SELECT
      TO authenticated
      USING (
        is_super_admin() OR 
        company_id IN (SELECT company_id FROM get_user_companies())
      );

    -- Company admin can insert attendance
    CREATE POLICY "attendance_insert"
      ON attendance FOR INSERT
      TO authenticated
      WITH CHECK (
        is_super_admin() OR is_company_admin(company_id)
      );

    -- Company admin can update attendance
    CREATE POLICY "attendance_update"
      ON attendance FOR UPDATE
      TO authenticated
      USING (is_super_admin() OR is_company_admin(company_id))
      WITH CHECK (is_super_admin() OR is_company_admin(company_id));

    -- Company admin can delete attendance
    CREATE POLICY "attendance_delete"
      ON attendance FOR DELETE
      TO authenticated
      USING (is_super_admin() OR is_company_admin(company_id));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error setting policies on attendance: %', SQLERRM;
END $$;

-- ─── Comments ───
COMMENT ON FUNCTION public.get_user_companies() IS 'Returns all companies assigned to the current authenticated user with their role';
COMMENT ON FUNCTION public.is_super_admin() IS 'Checks if the current user is a super admin';
COMMENT ON FUNCTION public.is_company_admin(p_company_id uuid) IS 'Checks if the current user is an admin (or super admin) for the given company (p_company_id)';
COMMENT ON FUNCTION public.is_company_member(p_company_id uuid) IS 'Checks if the current user is assigned to the given company (p_company_id)';
