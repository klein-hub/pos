import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface TimeEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  clock_out_location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
  clock_in_selfie_url: string | null;
  clock_out_selfie_url?: string | null;
  status: 'active' | 'completed' | 'override';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  approver_id: string | null;
  start_date: string;
  end_date: string;
  leave_type: 'sick' | 'vacation' | 'personal' | 'unpaid';
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  leave_type: string;
  total_days: number;
  used_days: number;
}

interface UseAttendanceReturn {
  loading: boolean;
  error: string | null;
  
  // Clock in/out
  clockIn: (location: any, selfieUrl?: string) => Promise<TimeEntry>;
  clockOut: (timeEntryId: string, location: any, selfieUrl?: string) => Promise<TimeEntry>;
  getActiveClockIn: () => Promise<TimeEntry | null>;
  getTodayEntries: (employeeId: string) => Promise<TimeEntry[]>;
  
  // Leave requests
  createLeaveRequest: (data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'submitted_at' | 'approved_at'>) => Promise<LeaveRequest>;
  submitLeaveRequest: (leaveId: string) => Promise<LeaveRequest>;
  getEmployeeLeaveRequests: (employeeId: string) => Promise<LeaveRequest[]>;
  getPendingLeaveRequests: (companyId: string) => Promise<LeaveRequest[]>;
  approveLeaveRequest: (leaveId: string, approverId: string) => Promise<LeaveRequest>;
  rejectLeaveRequest: (leaveId: string, reason: string) => Promise<LeaveRequest>;
  
  // Leave balance
  getLeaveBalance: (employeeId: string, year: number) => Promise<LeaveBalance[]>;
  getLeavesSummary: (employeeId: string) => Promise<{
    approved: number;
    pending: number;
    rejected: number;
  }>;
  
  // Analytics
  getAttendanceSummary: (companyId: string, startDate: string, endDate: string) => Promise<any>;
  getEmployeeAttendanceStats: (employeeId: string, startDate: string, endDate: string) => Promise<any>;
}

export const useAttendance = (): UseAttendanceReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Clock in
  const clockIn = useCallback(async (location: any, selfieUrl?: string): Promise<TimeEntry> => {
    setLoading(true);
    clearError();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: employee } = await supabase
        .from('employee')
        .select('id, company_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error: err } = await supabase.rpc('clock_in', {
        p_company_id: employee.company_id,
        p_employee_id: employee.id,
        p_location: location,
        p_selfie_url: selfieUrl || null,
      });

      if (err) throw err;
      return data as TimeEntry;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Clock out
  const clockOut = useCallback(async (timeEntryId: string, location: any, selfieUrl?: string): Promise<TimeEntry> => {
    setLoading(true);
    clearError();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: employee } = await supabase
        .from('employee')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error: err } = await supabase.rpc('clock_out', {
        p_time_entry_id: timeEntryId,
        p_company_id: employee.company_id,
        p_location: location,
        p_selfie_url: selfieUrl || null,
      });

      if (err) throw err;
      return data as TimeEntry;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get active clock in
  const getActiveClockIn = useCallback(async (): Promise<TimeEntry | null> => {
    setLoading(true);
    clearError();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: employee } = await supabase
        .from('employee')
        .select('id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error: err } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('status', 'active')
        .order('clock_in_time', { ascending: false })
        .limit(1)
        .single();

      if (err && err.code !== 'PGRST116') throw err; // PGRST116 = no rows found
      return (data || null) as TimeEntry | null;
    } catch (err: any) {
      if (err.code !== 'PGRST116') setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get today's entries
  const getTodayEntries = useCallback(async (employeeId: string): Promise<TimeEntry[]> => {
    setLoading(true);
    clearError();
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error: err } = await supabase
        .from('time_entries')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('clock_in_time', `${today}T00:00:00`)
        .lte('clock_in_time', `${today}T23:59:59`)
        .order('clock_in_time', { ascending: false });

      if (err) throw err;
      return (data || []) as TimeEntry[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Create leave request
  const createLeaveRequest = useCallback(async (data: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'submitted_at' | 'approved_at'>): Promise<LeaveRequest> => {
    setLoading(true);
    clearError();
    try {
      const { data: result, error: err } = await supabase
        .from('leave_requests')
        .insert([{ ...data, status: 'pending' }])
        .select()
        .single();

      if (err) throw err;
      return result as LeaveRequest;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Submit leave request
  const submitLeaveRequest = useCallback(async (leaveId: string): Promise<LeaveRequest> => {
    setLoading(true);
    clearError();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: employee } = await supabase
        .from('employee')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error: err } = await supabase.rpc('submit_leave_request', {
        p_leave_request_id: leaveId,
        p_company_id: employee.company_id,
      });

      if (err) throw err;
      return data as LeaveRequest;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get employee leave requests
  const getEmployeeLeaveRequests = useCallback(async (employeeId: string): Promise<LeaveRequest[]> => {
    setLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      return (data || []) as LeaveRequest[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get pending leave requests (for approver)
  const getPendingLeaveRequests = useCallback(async (companyId: string): Promise<LeaveRequest[]> => {
    setLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (err) throw err;
      return (data || []) as LeaveRequest[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Approve leave request
  const approveLeaveRequest = useCallback(async (leaveId: string, approverId: string): Promise<LeaveRequest> => {
    setLoading(true);
    clearError();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: employee } = await supabase
        .from('employee')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error: err } = await supabase.rpc('approve_leave_request', {
        p_leave_request_id: leaveId,
        p_company_id: employee.company_id,
        p_approver_id: approverId,
      });

      if (err) throw err;
      return data as LeaveRequest;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Reject leave request
  const rejectLeaveRequest = useCallback(async (leaveId: string, reason: string): Promise<LeaveRequest> => {
    setLoading(true);
    clearError();
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: employee } = await supabase
        .from('employee')
        .select('company_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!employee) throw new Error('Employee not found');

      const { data, error: err } = await supabase.rpc('reject_leave_request', {
        p_leave_request_id: leaveId,
        p_company_id: employee.company_id,
        p_rejection_reason: reason,
      });

      if (err) throw err;
      return data as LeaveRequest;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get leave balance
  const getLeaveBalance = useCallback(async (employeeId: string, year: number): Promise<LeaveBalance[]> => {
    setLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase
        .from('leave_balance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('year', year);

      if (err) throw err;
      return (data || []) as LeaveBalance[];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get leaves summary
  const getLeavesSummary = useCallback(async (employeeId: string) => {
    setLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase
        .from('leave_requests')
        .select('status')
        .eq('employee_id', employeeId);

      if (err) throw err;

      const summary = {
        approved: (data || []).filter((r: any) => r.status === 'approved').length,
        pending: (data || []).filter((r: any) => r.status === 'pending').length,
        rejected: (data || []).filter((r: any) => r.status === 'rejected').length,
      };

      return summary;
    } catch (err: any) {
      setError(err.message);
      return { approved: 0, pending: 0, rejected: 0 };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get attendance summary (for admin analytics)
  const getAttendanceSummary = useCallback(async (companyId: string, startDate: string, endDate: string) => {
    setLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase
        .from('time_entries')
        .select('employee_id, clock_in_time')
        .eq('company_id', companyId)
        .gte('clock_in_time', `${startDate}T00:00:00`)
        .lte('clock_in_time', `${endDate}T23:59:59`);

      if (err) throw err;

      // Calculate statistics
      const byDate: Record<string, Set<string>> = {};
      (data || []).forEach((entry: any) => {
        const date = entry.clock_in_time.split('T')[0];
        if (!byDate[date]) byDate[date] = new Set();
        byDate[date].add(entry.employee_id);
      });

      return {
        present: Object.values(byDate).reduce((sum, s) => sum + s.size, 0),
        absent: 0,
        late: 0,
        byDate,
      };
    } catch (err: any) {
      setError(err.message);
      return { present: 0, absent: 0, late: 0, byDate: {} };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  // Get employee attendance stats
  const getEmployeeAttendanceStats = useCallback(async (employeeId: string, startDate: string, endDate: string) => {
    setLoading(true);
    clearError();
    try {
      const { data, error: err } = await supabase.rpc('calculate_hours_worked', {
        p_employee_id: employeeId,
        p_company_id: '', // Will be fetched from context
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (err) throw err;
      return data?.[0] || { total_hours: 0, total_days: 0, average_hours_per_day: 0 };
    } catch (err: any) {
      setError(err.message);
      return { total_hours: 0, total_days: 0, average_hours_per_day: 0 };
    } finally {
      setLoading(false);
    }
  }, [clearError]);

  return {
    loading,
    error,
    clockIn,
    clockOut,
    getActiveClockIn,
    getTodayEntries,
    createLeaveRequest,
    submitLeaveRequest,
    getEmployeeLeaveRequests,
    getPendingLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
    getLeaveBalance,
    getLeavesSummary,
    getAttendanceSummary,
    getEmployeeAttendanceStats,
  };
};
