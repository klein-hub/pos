import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Attendance {
  id: string;
  company_id: string | null;
  employee_id: string;
  attendance_date: string;
  status: 'present' | 'absent' | 'late' | 'half-day';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendanceState {
  attendances: Attendance[];
  loading: boolean;
  error: string | null;
  fetchAttendances: () => Promise<void>;
  addAttendance: (attendance: Omit<Attendance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateAttendance: (id: string, attendance: Partial<Attendance>) => Promise<void>;
  deleteAttendance: (id: string) => Promise<void>;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  attendances: [],
  loading: false,
  error: null,
  fetchAttendances: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('attendance_date', { ascending: false });
      
      if (error) throw error;
      set({ attendances: data || [], error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  addAttendance: async (attendance) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('attendance')
        .insert([attendance]);
      
      if (error) throw error;
      const store = useAttendanceStore.getState();
      store.fetchAttendances();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateAttendance: async (id, attendance) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('attendance')
        .update(attendance)
        .eq('id', id);
      
      if (error) throw error;
      const store = useAttendanceStore.getState();
      store.fetchAttendances();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  deleteAttendance: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      const store = useAttendanceStore.getState();
      store.fetchAttendances();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));