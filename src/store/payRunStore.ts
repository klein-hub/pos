import { create } from "zustand";
import { supabase } from "../lib/supabase";
import {
  computePayroll,
  type PayComponent,
  type PayrollContext,
  type PayrollInput,
  type PayrollResult,
} from "../lib/payrollEngine";

export type PayRunStatus = "draft" | "computed" | "validated" | "paid";

export interface PayRun {
  id: number;
  name: string;
  period_start: string;
  period_end: string;
  run_type: "regular" | "off_cycle";
  status: PayRunStatus;
  pay_group_id: number | null;
  employee_id: number | null;
  notes: string;
  computed_at: string | null;
  validated_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  pay_groups?: { id: number; name: string } | null;
  employees?: { id: number; first_name: string; last_name: string } | null;
}

export interface PayrollEntry {
  id: number;
  pay_run_id: number;
  employee_id: number;
  worked_days: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status: string;
  snapshot: {
    context: PayrollContext;
    lines: {
      code: string;
      name: string;
      category: string;
      sequence: number;
      amount: number;
    }[];
    inputs?: PayrollInput[];
    pay_template_id?: number | null;
  };
  employees?: {
    id: number;
    first_name: string;
    last_name: string;
    position: string;
    base_pay: number;
    pay_group_id: number | null;
    pay_template_id: number | null;
  };
}

interface PayRunState {
  payRuns: PayRun[];
  entries: Record<number, PayrollEntry[]>;
  loading: boolean;
  error: string | null;
  fetchPayRuns: () => Promise<void>;
  fetchEntries: (payRunId: number) => Promise<void>;
  createPayRun: (input: Partial<PayRun>) => Promise<PayRun | null>;
  updatePayRun: (id: number, input: Partial<PayRun>) => Promise<void>;
  deletePayRun: (id: number) => Promise<void>;
  computePayRun: (payRunId: number) => Promise<void>;
  validatePayRun: (payRunId: number) => Promise<void>;
  markPayRunPaid: (payRunId: number, paidOn: string) => Promise<void>;
}

export const usePayRunStore = create<PayRunState>((set, get) => ({
  payRuns: [],
  entries: {},
  loading: false,
  error: null,

  fetchPayRuns: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from("pay_runs")
      .select("*, pay_groups(id,name), employees(id,first_name,last_name)")
      .order("period_start", { ascending: false });
    if (error) set({ error: error.message });
    else set({ payRuns: (data as PayRun[]) || [] });
    set({ loading: false });
  },

  fetchEntries: async (payRunId) => {
    const { data, error } = await supabase
      .from("payroll_entries")
      .select(
        "*, employees(id,first_name,last_name,position,base_pay,pay_group_id,pay_template_id)",
      )
      .eq("pay_run_id", payRunId)
      .order("id");
    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({
      entries: { ...state.entries, [payRunId]: (data as PayrollEntry[]) || [] },
    }));
  },

  createPayRun: async (input) => {
    set({ loading: true, error: null });
    const payload = {
      name: input.name || "",
      period_start: input.period_start,
      period_end: input.period_end,
      run_type: input.run_type || "regular",
      status: "draft" as PayRunStatus,
      pay_group_id: input.pay_group_id ?? null,
      employee_id: input.employee_id ?? null,
      notes: input.notes || "",
    };
    const { data, error } = await supabase
      .from("pay_runs")
      .insert(payload)
      .select("*, pay_groups(id,name), employees(id,first_name,last_name)")
      .maybeSingle();
    set({ loading: false });
    if (error) {
      set({ error: error.message });
      return null;
    }
    if (data) {
      set((state) => ({ payRuns: [data as PayRun, ...state.payRuns] }));
      return data as PayRun;
    }
    return null;
  },

  updatePayRun: async (id, input) => {
    const { error } = await supabase
      .from("pay_runs")
      .update(input)
      .eq("id", id);
    if (error) {
      set({ error: error.message });
      return;
    }
    await get().fetchPayRuns();
  },

  deletePayRun: async (id) => {
    const { error } = await supabase.from("pay_runs").delete().eq("id", id);
    if (error) {
      set({ error: error.message });
      return;
    }
    set((state) => ({ payRuns: state.payRuns.filter((p) => p.id !== id) }));
  },

  computePayRun: async (payRunId) => {
    set({ loading: true, error: null });
    try {
      const { data: payRun, error: runErr } = await supabase
        .from("pay_runs")
        .select("*")
        .eq("id", payRunId)
        .maybeSingle();
      if (runErr) throw runErr;
      if (!payRun) throw new Error("Pay run not found");
      if (payRun.status === "validated" || payRun.status === "paid") {
        throw new Error("This pay run is locked and cannot be recomputed");
      }

      // Fetch employees for the pay group or single employee scope.
      let empQuery = supabase
        .from("employees")
        .select(
          "id, first_name, last_name, position, base_pay, pay_group_id, pay_template_id",
        );
      if (payRun.employee_id) {
        empQuery = empQuery.eq("id", payRun.employee_id);
      } else if (payRun.pay_group_id) {
        empQuery = empQuery.eq("pay_group_id", payRun.pay_group_id);
      }
      const { data: employees, error: empErr } = await empQuery;
      if (empErr) throw empErr;
      if (!employees || employees.length === 0) {
        throw new Error(
          "This pay run has no employees assigned. Delete it and create a run for a pay group or employee with records.",
        );
      }

      // Fetch components for each referenced pay template
      const templateIds = Array.from(
        new Set(
          (employees || []).map((e: any) => e.pay_template_id).filter(Boolean),
        ),
      );
      const componentsByTemplate: Record<number, PayComponent[]> = {};
      if (templateIds.length) {
        const { data: comps, error: compErr } = await supabase
          .from("pay_components")
          .select("*")
          .in("pay_template_id", templateIds)
          .eq("active", true)
          .order("sequence");
        if (compErr) throw compErr;
        (comps || []).forEach((c: any) => {
          if (!componentsByTemplate[c.pay_template_id])
            componentsByTemplate[c.pay_template_id] = [];
          componentsByTemplate[c.pay_template_id].push(c as PayComponent);
        });
      }

      // Fetch inputs for this pay run
      const { data: inputs, error: inputErr } = await supabase
        .from("payroll_inputs")
        .select("*")
        .eq("pay_run_id", payRunId);
      if (inputErr) throw inputErr;

      const { data: payConstants, error: constantErr } = await supabase
        .from("pay_constants")
        .select("code, value")
        .eq("active", true);
      if (constantErr) throw constantErr;

      const constantContext: PayrollContext = (payConstants || []).reduce(
        (acc, constant: any) => {
          const numericValue = Number(constant.value);
          if (constant.code && Number.isFinite(numericValue)) {
            acc[constant.code] = numericValue;
          }
          return acc;
        },
        {} as PayrollContext,
      );

      // Remove existing entries for this run so we can recompute cleanly
      const { data: existingEntries } = await supabase
        .from("payroll_entries")
        .select("id")
        .eq("pay_run_id", payRunId);
      if (existingEntries && existingEntries.length) {
        const ids = existingEntries.map((e: any) => e.id);
        await supabase
          .from("payroll_lines")
          .delete()
          .in("payroll_entry_id", ids);
        await supabase
          .from("payroll_entries")
          .delete()
          .eq("pay_run_id", payRunId);
      }

      // Compute for each employee
      for (const emp of employees || []) {
        const components = emp.pay_template_id
          ? componentsByTemplate[emp.pay_template_id] || []
          : [];
        const empInputs: PayrollInput[] = (inputs || [])
          .filter((i: any) => i.employee_id === emp.id)
          .map((i: any) => ({
            code: i.code,
            amount: Number(i.amount) || 0,
            note: i.note,
          }));

        // Attendance-derived worked days/hours for this employee & pay period.
        // Sourced from the attendance-tracker punches via compute_attendance_summary().
        let workedDays = 0;
        let workedHours = 0;
        if (payRun.period_start && payRun.period_end) {
          const { data: att, error: attErr } = await supabase.rpc(
            "compute_attendance_summary",
            {
              p_employee_id: emp.id,
              p_start: payRun.period_start,
              p_end: payRun.period_end,
            },
          );
          if (attErr) throw attErr;
          const row: any = Array.isArray(att) ? att[0] : att;
          workedDays = Number(row?.worked_days) || 0;
          workedHours = Number(row?.worked_hours) || 0;
        }

        const basePay = Number(emp.base_pay) || 0;
        const workingDaysPerMonth =
          constantContext.WORKING_DAYS_PER_MONTH || 22;
        const regularWorkHoursPerDay =
          constantContext.REGULAR_WORK_HOURS_PER_DAY || 8;
        const tardinessRateFactor =
          constantContext.TARDINESS_RATE_FACTOR ||
          (constantContext.OT_REGULAR_DAY_MULTIPLIER || 1.25) /
            regularWorkHoursPerDay /
            60;
        const tardinessMinutes =
          empInputs.find((input) => input.code === "TARDINESS_MINUTES")
            ?.amount || 0;
        const dailyRate =
          workingDaysPerMonth > 0 ? basePay / workingDaysPerMonth : 0;
        const hourlyRate =
          regularWorkHoursPerDay > 0 ? dailyRate / regularWorkHoursPerDay : 0;
        const minuteRate = hourlyRate / 60;
        const tardinessRate = dailyRate * tardinessRateFactor;
        const tardinessAmount = tardinessMinutes * tardinessRate;

        const initialContext: PayrollContext = {
          ...constantContext,
          BASE_PAY: basePay,
          MONTHLY_RATE: basePay,
          DAILY_RATE: dailyRate,
          HOURLY_RATE: hourlyRate,
          MINUTE_RATE: minuteRate,
          TARDINESS_RATE: tardinessRate,
          TARDINESS_AMOUNT: tardinessAmount,
          // Attendance-derived, available to pay-component formulas.
          WORKED_DAYS: workedDays,
          WORKED_HOURS: workedHours,
        };

        const result: PayrollResult = computePayroll({
          components,
          initialContext,
          inputs: empInputs,
        });

        const { data: entry, error: entryErr } = await supabase
          .from("payroll_entries")
          .insert({
            pay_run_id: payRunId,
            employee_id: emp.id,
            worked_days: workedDays,
            gross_pay: result.gross,
            total_deductions: result.deductions,
            net_pay: result.net,
            status: "computed",
            snapshot: {
              context: result.context,
              lines: result.lines,
              inputs: empInputs,
              pay_template_id: emp.pay_template_id,
              attendance: {
                worked_days: workedDays,
                worked_hours: workedHours,
              },
            },
          })
          .select("id")
          .maybeSingle();
        if (entryErr) throw entryErr;

        if (entry && result.lines.length) {
          const lineRows = result.lines.map((l) => ({
            payroll_entry_id: entry.id,
            component_code: l.code,
            component_name: l.name,
            category: l.category,
            amount: l.amount,
            sequence: l.sequence,
          }));
          const { error: linesErr } = await supabase
            .from("payroll_lines")
            .insert(lineRows);
          if (linesErr) throw linesErr;
        }
      }

      await supabase
        .from("pay_runs")
        .update({ status: "computed", computed_at: new Date().toISOString() })
        .eq("id", payRunId);

      await get().fetchPayRuns();
      await get().fetchEntries(payRunId);
    } catch (err: any) {
      set({ error: err.message || "Failed to compute payroll" });
    } finally {
      set({ loading: false });
    }
  },

  validatePayRun: async (payRunId) => {
    const { error } = await supabase
      .from("pay_runs")
      .update({ status: "validated", validated_at: new Date().toISOString() })
      .eq("id", payRunId);
    if (error) {
      set({ error: error.message });
      return;
    }
    await get().fetchPayRuns();
  },

  markPayRunPaid: async (payRunId, paidOn) => {
    const { error } = await supabase
      .from("pay_runs")
      .update({ status: "paid", paid_at: new Date(paidOn).toISOString() })
      .eq("id", payRunId);
    if (error) {
      set({ error: error.message });
      return;
    }

    // Create payment records for each entry
    const entries = get().entries[payRunId] || [];
    if (entries.length) {
      const paymentRows = entries.map((e) => ({
        pay_run_id: payRunId,
        payroll_entry_id: e.id,
        amount: e.net_pay,
        method: "manual",
        paid_on: paidOn,
      }));
      await supabase.from("payments").insert(paymentRows);
    }

    await get().fetchPayRuns();
  },
}));
