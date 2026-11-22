/**
 * Admin Service - Super Admin Dashboard Backend
 *
 * Provides endpoints and utilities for super admin management:
 * - Company management (list, create)
 * - User management (assign users to companies, manage roles)
 * - Company statistics (employees, payroll, attendance)
 */

import { supabase } from "./supabase";

export interface Company {
  id: string;
  name: string;
  brand: string | null;
  slug: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  timezone: string | null;
  currency: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CompanyStats {
  company_id: string;
  company_name: string;
  total_employees: number;
  total_attendance_records: number;
  total_payroll_records: number;
  average_salary: number;
  total_payroll_amount: number;
}

export interface UserProfile {
  user_id: string;
  email: string;
  role: string;
  company_id: string;
  company_name: string;
}

const isMissingRelationError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("does not exist");
};

const isMissingColumnError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes("column")
  );
};

type CompanyMutationInput =
  | string
  | Partial<Omit<Company, "id" | "created_at" | "updated_at">>;

const normalizeOptional = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function normalizeCompanyPayload(
  input: CompanyMutationInput,
): Omit<Company, "id" | "created_at" | "updated_at"> {
  const source = typeof input === "string" ? { name: input } : input;
  const normalizedName = (source.name || "").trim();

  if (!normalizedName) {
    throw new Error("Company name is required");
  }

  return {
    name: normalizedName,
    brand: normalizeOptional(source.brand) || normalizedName,
    slug: normalizeOptional(source.slug),
    email: normalizeOptional(source.email),
    phone: normalizeOptional(source.phone),
    website: normalizeOptional(source.website),
    logo_url: normalizeOptional(source.logo_url),
    address: normalizeOptional(source.address),
    city: normalizeOptional(source.city),
    country: normalizeOptional(source.country),
    subscription_plan: normalizeOptional(source.subscription_plan),
    subscription_status: normalizeOptional(source.subscription_status),
    timezone: normalizeOptional(source.timezone),
    currency: normalizeOptional(source.currency),
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * COMPANIES ENDPOINTS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * List all companies (super admin only)
 */
export async function listCompanies(): Promise<Company[]> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data || []) as Company[];
  } catch (error) {
    console.error("Error listing companies:", error);
    throw error;
  }
}

/**
 * Get company details
 */
export async function getCompany(companyId: string): Promise<Company | null> {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data as Company | null;
  } catch (error) {
    console.error("Error getting company:", error);
    throw error;
  }
}

/**
 * Create new company (super admin only)
 */
export async function createCompany(
  input: CompanyMutationInput,
): Promise<Company> {
  try {
    const payload = normalizeCompanyPayload(input);
    const { data, error } = await supabase
      .from("companies")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data as Company;
  } catch (error) {
    console.error("Error creating company:", error);
    throw error;
  }
}

/**
 * Update company (super admin only)
 */
export async function updateCompany(
  companyId: string,
  updates: Partial<Omit<Company, "id" | "created_at" | "updated_at">>,
): Promise<Company> {
  try {
    const payload = normalizeCompanyPayload(updates);
    const { data, error } = await supabase
      .from("companies")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", companyId)
      .select()
      .single();

    if (error) throw error;
    return data as Company;
  } catch (error) {
    console.error("Error updating company:", error);
    throw error;
  }
}

/**
 * Delete company (super admin only)
 */
export async function deleteCompany(companyId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("companies")
      .delete()
      .eq("id", companyId);

    if (error) throw error;
  } catch (error) {
    console.error("Error deleting company:", error);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * COMPANY STATS ENDPOINTS
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Get company statistics
 */
export async function getCompanyStats(
  companyId: string,
): Promise<CompanyStats | null> {
  try {
    const company = await getCompany(companyId);
    if (!company) return null;

    // Get employee count
    const { count: employeeCount, error: empError } = await supabase
      .from("employees")
      .select("id", { count: "exact" })
      .eq("company_id", companyId);

    if (empError) throw empError;

    // Get attendance count
    const { count: attendanceCountRaw, error: attError } = await supabase
      .from("attendance")
      .select("id", { count: "exact" })
      .eq("company_id", companyId);

    if (attError && !isMissingRelationError(attError)) throw attError;
    const attendanceCount = attError ? 0 : attendanceCountRaw || 0;

    // Payroll tables vary across schema versions (payroll_records vs pay_runs/payroll_entries).
    // To avoid noisy 404/42P01 errors in admin company list, keep payroll aggregates optional here.
    const payrollData: Array<{ net_pay?: number | null }> = [];
    const totalPayroll = 0;

    // Get average salary
    const { data: salaryDataBasePay, error: basePayError } = await supabase
      .from("employees")
      .select("base_pay")
      .eq("company_id", companyId);

    let salaryValues: number[] = [];

    if (!basePayError) {
      salaryValues = (salaryDataBasePay || []).map((emp: any) =>
        Number(emp.base_pay || 0),
      );
    } else if (isMissingColumnError(basePayError)) {
      const { data: salaryDataBaseSalary, error: baseSalaryError } =
        await supabase
          .from("employees")
          .select("base_salary")
          .eq("company_id", companyId);

      if (baseSalaryError && !isMissingColumnError(baseSalaryError)) {
        throw baseSalaryError;
      }

      salaryValues = (salaryDataBaseSalary || []).map((emp: any) =>
        Number(emp.base_salary || 0),
      );
    } else {
      throw basePayError;
    }

    const averageSalary =
      salaryValues.length > 0
        ? salaryValues.reduce((sum, amount) => sum + amount, 0) /
          salaryValues.length
        : 0;

    return {
      company_id: companyId,
      company_name: company.name,
      total_employees: employeeCount || 0,
      total_attendance_records: attendanceCount,
      total_payroll_records: payrollData.length,
      average_salary: averageSalary,
      total_payroll_amount: totalPayroll,
    };
  } catch (error) {
    console.error("Error getting company stats:", error);
    throw error;
  }
}

/**
 * Get all companies with their stats
 */
export async function getAllCompaniesStats(): Promise<CompanyStats[]> {
  try {
    const companies = await listCompanies();
    const stats: CompanyStats[] = [];

    for (const company of companies) {
      const stat = await getCompanyStats(company.id);
      if (stat) {
        stats.push(stat);
      }
    }

    return stats;
  } catch (error) {
    console.error("Error getting all companies stats:", error);
    throw error;
  }
}

/**
 * Get payroll summary for company
 */
export async function getCompanyPayrollSummary(
  companyId: string,
  month: number,
  year: number,
) {
  try {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("payroll_entries")
      .select(
        `
        id,
        employee_id,
        gross_pay,
        net_pay,
        status,
        employees!inner(first_name, last_name, position, company_id),
        pay_runs!inner(period_start, period_end)
      `,
      )
      .eq("employees.company_id", companyId)
      .gte("pay_runs.period_start", startDate)
      .lte("pay_runs.period_end", endDate)
      .order("employee_id", { ascending: true });

    if (
      error &&
      !isMissingRelationError(error) &&
      !isMissingColumnError(error)
    ) {
      throw error;
    }

    const payrollRows = (error ? [] : data || []).map((entry: any) => ({
      id: entry.id,
      employee_id: entry.employee_id,
      employees: entry.employees,
      base_pay: Number(entry.gross_pay || 0),
      net_pay: Number(entry.net_pay || 0),
      status: entry.status || "draft",
    }));

    return {
      company_id: companyId,
      period: `${year}-${String(month).padStart(2, "0")}`,
      payroll_count: payrollRows.length,
      total_base_pay: payrollRows.reduce(
        (sum, p) => sum + (p.base_pay || 0),
        0,
      ),
      total_net_pay: payrollRows.reduce((sum, p) => sum + (p.net_pay || 0), 0),
      by_status: {
        draft: payrollRows.filter((p) => p.status === "draft").length,
        pending: payrollRows.filter((p) => p.status === "pending").length,
        approved: payrollRows.filter((p) => p.status === "approved").length,
        paid: payrollRows.filter((p) => p.status === "paid").length,
      },
      payroll_records: payrollRows,
    };
  } catch (error) {
    console.error("Error getting company payroll summary:", error);
    throw error;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════
 * DASHBOARD UTILITIES
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Get dashboard overview for super admin
 */
export async function getDashboardOverview() {
  try {
    const companies = await listCompanies();
    const stats = await getAllCompaniesStats();

    const totalEmployees = stats.reduce((sum, s) => sum + s.total_employees, 0);
    const totalPayroll = stats.reduce(
      (sum, s) => sum + s.total_payroll_amount,
      0,
    );
    const averageSalary =
      stats.length > 0
        ? stats.reduce((sum, s) => sum + s.average_salary, 0) / stats.length
        : 0;

    return {
      total_companies: companies.length,
      total_employees: totalEmployees,
      total_payroll_amount: totalPayroll,
      average_employee_salary: averageSalary,
      companies: stats,
    };
  } catch (error) {
    console.error("Error getting dashboard overview:", error);
    throw error;
  }
}
