import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface Leave {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  leave_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface LeaveState {
  leaves: Leave[];
  loading: boolean;
  error: string | null;
  fetchLeaves: () => Promise<void>;
  addLeave: (leave: Omit<Leave, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateLeave: (id: number, leave: Partial<Leave>) => Promise<void>;
  deleteLeave: (id: number) => Promise<void>;
}

export const useLeaveStore = create<LeaveState>((set) => ({
  leaves: [],
  loading: false,
  error: null,
  fetchLeaves: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select(`
          *,
          employees (
            name
          )
        `)
        .order('start_date', { ascending: false });
      
      if (error) throw error;
      set({ leaves: data || [], error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  addLeave: async (leave) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('leaves')
        .insert([leave]);
      
      if (error) throw error;
      const store = useLeaveStore.getState();
      store.fetchLeaves();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateLeave: async (id, leave) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('leaves')
        .update(leave)
        .eq('id', id);
      
      if (error) throw error;
      const store = useLeaveStore.getState();
      store.fetchLeaves();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  deleteLeave: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('leaves')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      const store = useLeaveStore.getState();
      store.fetchLeaves();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));