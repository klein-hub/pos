import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

interface Department {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

interface DepartmentState {
  departments: Department[];
  loading: boolean;
  error: string | null;
  fetchDepartments: () => Promise<void>;
  addDepartment: (department: Omit<Department, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDepartment: (id: number, department: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: number) => Promise<void>;
}

export const useDepartmentStore = create<DepartmentState>((set) => ({
  departments: [],
  loading: false,
  error: null,
  fetchDepartments: async () => {
    set({ loading: true });
    try {
      const { activeCompanyId } = useAuthStore.getState();
      if (!activeCompanyId) {
        set({ departments: [], error: null });
        return;
      }

      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('name');
      
      if (error) throw error;
      set({ departments: data || [], error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  addDepartment: async (department) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('departments')
        .insert([department]);
      
      if (error) throw error;
      const store = useDepartmentStore.getState();
      store.fetchDepartments();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateDepartment: async (id, department) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('departments')
        .update(department)
        .eq('id', id);
      
      if (error) throw error;
      const store = useDepartmentStore.getState();
      store.fetchDepartments();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  deleteDepartment: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      const store = useDepartmentStore.getState();
      store.fetchDepartments();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));