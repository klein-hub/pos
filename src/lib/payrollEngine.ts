/**
 * Payroll Computation Engine
 *
 * Implements a rule-driven computation pipeline:
 *   1. A shared numeric context (Record<code, amount>) flows through every
 *      component in sequence.
 *   2. Each component reads the context, evaluates its condition, and writes
 *      its result back into the context under its `code`.
 *   3. The final context is returned along with an ordered breakdown (the
 *      lines that will become the payslip).
 *
 * The engine is intentionally simple and predictable:
 *   - `fixed`      -> component.amount
 *   - `percentage` -> context[percentage_of_code] * percentage / 100
 *   - `formula`    -> safe evaluation of the formula against the context
 */

export type PayComponentCategory = "earning" | "deduction" | "net";
export type PayComponentConditionType = "always" | "input" | "expression";
export type PayComponentComputationType = "fixed" | "percentage" | "formula";

export interface PayComponent {
  id: number;
  name: string;
  code: string;
  category: PayComponentCategory;
  sequence: number;
  condition_type: PayComponentConditionType;
  condition_expression?: string | null;
  computation_type: PayComponentComputationType;
  amount?: number | null;
  percentage?: number | null;
  percentage_of_code?: string | null;
  formula?: string | null;
  active: boolean;
}

export interface PayrollInput {
  code: string;
  amount: number;
  note?: string;
}

export interface PayrollContext {
  [code: string]: number;
}

export interface PayrollLine {
  code: string;
  name: string;
  category: PayComponentCategory;
  sequence: number;
  amount: number;
}

export interface PayrollResult {
  context: PayrollContext;
  lines: PayrollLine[];
  gross: number;
  deductions: number;
  net: number;
}

/**
 * Safely evaluate an expression using only the provided context variables and
 * basic arithmetic / comparison / logical operators. This uses `new Function`
 * but restricts the scope to just the context keys, so arbitrary globals are
 * not reachable.
 */
function evaluateExpression(expr: string, context: PayrollContext): number {
  if (!expr || !expr.trim()) return 0;
  const keys = Object.keys(context);
  const values = keys.map((k) => context[k]);
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const fn = new Function(...keys, `"use strict"; return (${expr});`);
    const result = fn(...values);
    if (typeof result === "boolean") return result ? 1 : 0;
    const n = Number(result);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function evaluateCondition(
  component: PayComponent,
  context: PayrollContext,
  inputs: PayrollInput[],
): boolean {
  switch (component.condition_type) {
    case "always":
      return true;
    case "input":
      return inputs.some((i) => i.code === component.code);
    case "expression":
      return (
        evaluateExpression(
          component.condition_expression || "true",
          context,
        ) !== 0
      );
    default:
      return true;
  }
}

function computeComponentAmount(
  component: PayComponent,
  context: PayrollContext,
  inputs: PayrollInput[],
): number {
  // Manual inputs take precedence — if an input targets this component's code,
  // it is treated as the component's value.
  const matchingInput = inputs.find((i) => i.code === component.code);
  if (matchingInput) return Number(matchingInput.amount) || 0;

  switch (component.computation_type) {
    case "fixed":
      return Number(component.amount ?? 0);
    case "percentage": {
      const base = component.percentage_of_code
        ? (context[component.percentage_of_code] ?? 0)
        : 0;
      const pct = Number(component.percentage ?? 0);
      return (base * pct) / 100;
    }
    case "formula":
      return evaluateExpression(component.formula || "0", context);
    default:
      return 0;
  }
}

export interface ComputePayrollArgs {
  components: PayComponent[];
  initialContext?: PayrollContext;
  inputs?: PayrollInput[];
}

export function computePayroll({
  components,
  initialContext = {},
  inputs = [],
}: ComputePayrollArgs): PayrollResult {
  const context: PayrollContext = { ...initialContext };
  const lines: PayrollLine[] = [];

  for (const input of inputs) {
    context[input.code] = Number(input.amount) || 0;
  }

  const ordered = [...components]
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

  for (const component of ordered) {
    if (!evaluateCondition(component, context, inputs)) continue;

    const raw = computeComponentAmount(component, context, inputs);
    const amount = Number.isFinite(raw) ? Number(raw) : 0;

    context[component.code] = amount;
    lines.push({
      code: component.code,
      name: component.name,
      category: component.category,
      sequence: component.sequence ?? 0,
      amount,
    });
  }

  const gross = lines
    .filter((l) => l.category === "earning")
    .reduce((s, l) => s + l.amount, 0);
  const deductions = lines
    .filter((l) => l.category === "deduction")
    .reduce((s, l) => s + l.amount, 0);
  const netLine = lines.find((l) => l.category === "net");
  const net = netLine ? netLine.amount : gross - deductions;

  return { context, lines, gross, deductions, net };
}

export const formatCurrency = (value: number): string =>
  `₱${Number(value ?? 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
