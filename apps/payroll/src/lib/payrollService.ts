/**
 * Payroll Service - Integration with Supabase payroll functions
 * 
 * Provides TypeScript wrappers for payroll workflow functions:
 * - calculateAttendance()
 * - generatePayroll()
 * - generatePayslip()
 */

import { supabase } from './supabase';

export interface AttendanceSummary {
  present_days: number;
  absent_days: number;
  late_count: number;
  total_work_days: number;
  attendance_percentage: number;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  company_id: string;
  pay_period_start: string;
  pay_period_end: string;
  base_pay: number;
  overtime_pay: number;
  deductions: number;
  net_pay: number;
  payment_date: string;
  status: 'draft' | 'pending' | 'approved' | 'paid';
  created_at: string;
  updated_at: string;
}

export interface Payslip {
  payslip_html: string;
  payroll_id: string;
  employee_name: string;
  period_start: string;
  period_end: string;
  base_pay: number;
  net_pay: number;
  attendance_summary: string;
}

/**
 * Calculate attendance summary for an employee during a specific period
 */
export async function calculateAttendance(
  employeeId: string,
  companyId: string,
  dateStart: string, // YYYY-MM-DD format
  dateEnd: string
): Promise<AttendanceSummary> {
  try {
    const { data, error } = await supabase.rpc('calculate_attendance', {
      p_employee_id: employeeId,
      p_company_id: companyId,
      p_date_start: dateStart,
      p_date_end: dateEnd,
    });

    if (error) throw error;

    return data[0] as AttendanceSummary;
  } catch (error) {
    console.error('Error calculating attendance:', error);
    throw error;
  }
}

/**
 * Generate payroll record for an employee in a given month/year
 */
export async function generatePayroll(
  employeeId: string,
  companyId: string,
  year: number,
  month: number
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_payroll', {
      p_employee_id: employeeId,
      p_company_id: companyId,
      p_year: year,
      p_month: month,
    });

    if (error) throw error;

    return data as string; // Returns the generated payroll ID
  } catch (error) {
    console.error('Error generating payroll:', error);
    throw error;
  }
}

/**
 * Generate payslip (HTML) for a payroll record
 */
export async function generatePayslip(
  payrollId: string,
  companyId: string
): Promise<Payslip> {
  try {
    const { data, error } = await supabase.rpc('generate_payslip', {
      p_payroll_id: payrollId,
      p_company_id: companyId,
    });

    if (error) throw error;

    return data[0] as Payslip;
  } catch (error) {
    console.error('Error generating payslip:', error);
    throw error;
  }
}

/**
 * Fetch a payroll record by ID
 */
export async function getPayrollRecord(payrollId: string): Promise<PayrollRecord | null> {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('id', payrollId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    return data as PayrollRecord | null;
  } catch (error) {
    console.error('Error fetching payroll record:', error);
    throw error;
  }
}

/**
 * Fetch all payroll records for an employee
 */
export async function getEmployeePayroll(
  employeeId: string,
  companyId: string
): Promise<PayrollRecord[]> {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('company_id', companyId)
      .order('pay_period_end', { ascending: false });

    if (error) throw error;
    return (data || []) as PayrollRecord[];
  } catch (error) {
    console.error('Error fetching employee payroll:', error);
    throw error;
  }
}

/**
 * Update payroll status (draft -> pending -> approved -> paid)
 */
export async function updatePayrollStatus(
  payrollId: string,
  status: 'draft' | 'pending' | 'approved' | 'paid'
): Promise<PayrollRecord> {
  try {
    const { data, error } = await supabase
      .from('payroll_records')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', payrollId)
      .select()
      .single();

    if (error) throw error;
    return data as PayrollRecord;
  } catch (error) {
    console.error('Error updating payroll status:', error);
    throw error;
  }
}

/**
 * Get payroll records for a company in a given period
 */
export async function getCompanyPayroll(
  companyId: string,
  month: number,
  year: number
): Promise<PayrollRecord[]> {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('payroll_records')
      .select('*')
      .eq('company_id', companyId)
      .gte('pay_period_start', startDate)
      .lte('pay_period_end', endDate)
      .order('employee_id', { ascending: true });

    if (error) throw error;
    return (data || []) as PayrollRecord[];
  } catch (error) {
    console.error('Error fetching company payroll:', error);
    throw error;
  }
}
