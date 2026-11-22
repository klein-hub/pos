import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "./authStore";

interface WorkSchedule {
  id: number;
  employee_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  updated_at: string;
}

interface WorkScheduleState {
  schedules: WorkSchedule[];
  loading: boolean;
  error: string | null;
  fetchSchedules: () => Promise<void>;
  addSchedule: (
    schedule: Omit<WorkSchedule, "id" | "created_at" | "updated_at">,
  ) => Promise<void>;
  updateSchedule: (
    id: number,
    schedule: Partial<WorkSchedule>,
  ) => Promise<void>;
  deleteSchedule: (id: number) => Promise<void>;
}

export const useWorkScheduleStore = create<WorkScheduleState>((set) => ({
  schedules: [],
  loading: false,
  error: null,
  fetchSchedules: async () => {
    set({ loading: true });
    try {
      const { activeCompanyId } = useAuthStore.getState();
      if (!activeCompanyId) {
        set({ schedules: [], error: null });
        return;
      }

      const { data, error } = await supabase
        .from("work_schedules")
        .select(
          `
          *,
          employees (
            name
          )
        `,
        )
        .eq("company_id", activeCompanyId)
        .order("work_date", { ascending: false });

      if (error) throw error;
      set({ schedules: data || [], error: null });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  addSchedule: async (schedule) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from("work_schedules")
        .insert([schedule]);

      if (error) throw error;
      const store = useWorkScheduleStore.getState();
      store.fetchSchedules();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  updateSchedule: async (id, schedule) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from("work_schedules")
        .update(schedule)
        .eq("id", id);

      if (error) throw error;
      const store = useWorkScheduleStore.getState();
      store.fetchSchedules();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
  deleteSchedule: async (id) => {
    set({ loading: true });
    try {
      const { error } = await supabase
        .from("work_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;
      const store = useWorkScheduleStore.getState();
      store.fetchSchedules();
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },
}));
