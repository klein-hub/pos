import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

interface Employee {
  id: string;  // Changed from number to string to match Supabase's UUID type
  name: string;
  department_id: number;
  email: string;
  created_at: string;
  updated_at: string;
}

interface EmployeeState {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  fetchEmployees: () => Promise<void>;
  addEmployee: (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateEmployee: (id: string, employee: Partial<Employee>) => Promise<void>;  // Changed parameter type to string
  deleteEmployee: (id: string) => Promise<void>;  // Changed parameter type to string
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  employees: [],
  loading: false,
  error: null,
  fetchEmployees: async () => {
    set({ loading: true });
    try {
      const { activeCompanyId } = useAuthStore.getState();
      if (!activeCompanyId) {
        set({ employees: [], error: null });
        return;
      }

      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          departments (
            name
          )
        `)
        .eq('company_id', activeCompanyId)
        .order('first_name');
      
      if (error) throw error;
      set({ employees: data || [], error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  addEmployee: async (employee) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('employees')
        .insert([employee]);
      
      if (error) throw error;
      const store = useEmployeeStore.getState();
      store.fetchEmployees();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateEmployee: async (id, employee) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('employees')
        .update(employee)
        .eq('id', id);
      
      if (error) throw error;
      const store = useEmployeeStore.getState();
      store.fetchEmployees();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  deleteEmployee: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      const store = useEmployeeStore.getState();
      store.fetchEmployees();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));