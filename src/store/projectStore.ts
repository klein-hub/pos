import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

interface Project {
  id: number;
  name: string;
  department_id: number;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

interface ProjectState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  fetchProjects: () => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateProject: (id: number, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  loading: false,
  error: null,
  fetchProjects: async () => {
    set({ loading: true });
    try {
      const { activeCompanyId } = useAuthStore.getState();
      if (!activeCompanyId) {
        set({ projects: [], error: null });
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', activeCompanyId)
        .order('name', { ascending: false });
      
      if (error) throw error;
      set({ projects: data || [], error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  addProject: async (project) => {
    set({ loading: true });
    try {
      const payload = { ...project, department_id: project.department_id || null };
      const { error } = await supabase
        .from('projects')
        .insert([payload]);
      
      if (error) throw error;
      const store = useProjectStore.getState();
      store.fetchProjects();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateProject: async (id, project) => {
    set({ loading: true });
    try {
      const payload = { ...project, department_id: project.department_id || null };
      console.log(`payload: ${JSON.stringify(payload)}`)
      const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id);
      
      if (error) throw error;
      const store = useProjectStore.getState();
      store.fetchProjects();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  deleteProject: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      const store = useProjectStore.getState();
      store.fetchProjects();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));