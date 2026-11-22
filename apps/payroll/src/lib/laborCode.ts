/*
  Philippine Labor Code Constants & Pay Computation Rules
  Based on: Labor Code of the Philippines (Presidential Decree No. 442)
  Reference: DOLE - Bureau of Labor Relations

  KEY RATES & MULTIPLIERS
  -----------------------
  All rates are expressed as a multiplier of the hourly rate unless stated otherwise.
*/

// ─── Standard Working Hours ──────────────────────────────────────────────────
export const REGULAR_WORK_HOURS_PER_DAY = 8;        // Art. 83: Normal hours of work
export const REGULAR_WORK_DAYS_PER_WEEK = 5;        // Standard 5-day workweek
export const WORKING_DAYS_PER_MONTH = 22;           // For monthly-rate daily rate computation
export const WORKING_HOURS_PER_MONTH = 176;         // 22 days × 8 hours

// ─── Overtime Pay (Art. 87) ───────────────────────────────────────────────────
// Overtime = regular hourly rate + at least 25% thereof
export const OT_REGULAR_DAY_MULTIPLIER = 1.25;       // Regular day OT: hourly rate × 125%
export const OT_REST_DAY_MULTIPLIER = 1.30;          // Rest day OT (first 8 hrs): hourly rate × 130%
export const OT_REST_DAY_OT_MULTIPLIER = 1.30 * 1.30;  // Rest day OT (excess 8 hrs): × 130% on top of rest day rate
                                                         // i.e., 1.69x hourly rate

// ─── Rest Day & Special Days (Art. 91–93) ────────────────────────────────────
export const REST_DAY_MULTIPLIER = 1.30;             // Work on rest day: +30% of daily rate
export const SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER = 1.30; // Special non-working holiday: +30%
export const SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER = 1.30 * 1.30; // OT on special non-working holiday

// ─── Regular Holiday Pay (Art. 94) ───────────────────────────────────────────
export const REGULAR_HOLIDAY_MULTIPLIER = 2.00;      // Work on regular holiday: 200% of daily rate (double pay)
export const REGULAR_HOLIDAY_OT_MULTIPLIER = 2.00 * 1.30; // OT on regular holiday: 200% + 30% thereof = 260%
export const REGULAR_HOLIDAY_REST_DAY_MULTIPLIER = 3.00;  // Work on regular holiday that falls on rest day: 300%
export const REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER = 3.00 * 1.30; // OT: 300% + 30% thereof = 390%

// If employee did NOT work on a regular holiday, they still get 100% of daily rate
export const REGULAR_HOLIDAY_NO_WORK_MULTIPLIER = 1.00; // Art. 94: paid even if not worked

// ─── Night Shift Differential (Art. 86) ──────────────────────────────────────
// Night shift: 10:00 PM to 6:00 AM
// NSD = at least 10% of the hourly rate for every hour of night shift work
export const NIGHT_SHIFT_START_HOUR = 22;           // 10:00 PM
export const NIGHT_SHIFT_END_HOUR = 6;              // 6:00 AM
export const NIGHT_SHIFT_DIFFERENTIAL_RATE = 0.10; // 10% additional on top of hourly rate

// NSD on overtime: computed on top of overtime rate
// NSD + OT on Regular Day = (hourly rate × 1.25) × 1.10
export const NSD_OT_REGULAR_DAY = OT_REGULAR_DAY_MULTIPLIER * (1 + NIGHT_SHIFT_DIFFERENTIAL_RATE);
// NSD + OT on Rest Day = (hourly rate × 1.30 × 1.30) × 1.10
export const NSD_OT_REST_DAY = OT_REST_DAY_OT_MULTIPLIER * (1 + NIGHT_SHIFT_DIFFERENTIAL_RATE);
// NSD + OT on Regular Holiday = (hourly rate × 2.00 × 1.30) × 1.10
export const NSD_OT_REGULAR_HOLIDAY = REGULAR_HOLIDAY_OT_MULTIPLIER * (1 + NIGHT_SHIFT_DIFFERENTIAL_RATE);

// ─── 13th Month Pay (P.D. 851) ───────────────────────────────────────────────
// Mandatory for all rank-and-file employees. Due on or before December 24.
// = Total Basic Salary Earned in a Calendar Year / 12
export const THIRTEENTH_MONTH_DIVISOR = 12;

// ─── SSS Contribution Table (2023 Schedule) ──────────────────────────────────
// R.A. 11199 – Social Security Act of 2018
// Employee share: 4.5% of Monthly Salary Credit (MSC)
// Employer share: 9.5% of MSC
// EC (Employee Compensation): ₱10 for MSC below ₱14,750, ₱30 for ₱14,750+
// MSC range: ₱4,000 – ₱30,000
export const SSS_EMPLOYEE_RATE = 0.045;   // 4.5%
export const SSS_EMPLOYER_RATE = 0.095;   // 9.5%
export const SSS_MIN_MSC = 4000;
export const SSS_MAX_MSC = 30000;
export const SSS_EC_LOW = 10;             // EC contribution for MSC < 14,750
export const SSS_EC_HIGH = 30;            // EC contribution for MSC >= 14,750
export const SSS_EC_THRESHOLD = 14750;

// ─── PhilHealth Contribution (2024 Schedule) ─────────────────────────────────
// R.A. 11223 – Universal Health Care Act
// Premium Rate: 5% of basic monthly salary
// Employee share: 2.5% | Employer share: 2.5%
// Floor: ₱500 total (₱250 each) | Ceiling: ₱5,000 total (₱2,500 each) based on ₱100,000 max
export const PHILHEALTH_TOTAL_RATE = 0.05;         // 5% of monthly basic salary
export const PHILHEALTH_EMPLOYEE_RATE = 0.025;     // 2.5% employee share
export const PHILHEALTH_EMPLOYER_RATE = 0.025;     // 2.5% employer share
export const PHILHEALTH_MIN_SALARY = 10000;        // Minimum salary base for computation
export const PHILHEALTH_MAX_SALARY = 100000;       // Maximum salary base for computation
export const PHILHEALTH_MIN_CONTRIBUTION = 250;   // Minimum employee contribution
export const PHILHEALTH_MAX_CONTRIBUTION = 2500;  // Maximum employee contribution

// ─── Pag-IBIG / HDMF Contribution ───────────────────────────────────────────
// R.A. 9679 – Home Development Mutual Fund Law of 2009
// Employee share: 1% if monthly compensation <= ₱1,500; 2% if > ₱1,500 (max ₱100 employee)
// Employer share: 2% of employee's monthly compensation (minimum ₱200)
export const PAGIBIG_RATE_LOW = 0.01;             // 1% for salary ≤ 1,500
export const PAGIBIG_RATE_HIGH = 0.02;            // 2% for salary > 1,500
export const PAGIBIG_SALARY_THRESHOLD = 1500;     // Threshold for rate change
export const PAGIBIG_EMPLOYEE_MAX = 100;          // Maximum employee monthly contribution
export const PAGIBIG_EMPLOYER_RATE = 0.02;        // Employer always pays 2%
export const PAGIBIG_EMPLOYER_MIN = 200;          // Minimum employer contribution

// ─── Withholding Tax (BIR 2023 Tax Table) ────────────────────────────────────
// TRAIN Law (R.A. 10963) - Effective January 1, 2023
// Annual taxable income brackets:
export const TAX_BRACKETS_ANNUAL = [
  { min: 0,         max: 250000,      base: 0,      rate: 0.00 },
  { min: 250001,    max: 400000,      base: 0,      rate: 0.15 },
  { min: 400001,    max: 800000,      base: 22500,  rate: 0.20 },
  { min: 800001,    max: 2000000,     base: 102500, rate: 0.25 },
  { min: 2000001,   max: 8000000,     base: 402500, rate: 0.30 },
  { min: 8000001,   max: Infinity,    base: 2202500,rate: 0.35 },
];

// ─── Utility: Compute Hourly Rate ─────────────────────────────────────────────
export const computeHourlyRate = (monthlyRate: number): number => {
  return monthlyRate / WORKING_HOURS_PER_MONTH;
};

export const computeDailyRate = (monthlyRate: number): number => {
  return monthlyRate / WORKING_DAYS_PER_MONTH;
};

// ─── Utility: SSS Contribution ────────────────────────────────────────────────
export const computeSSSContribution = (monthlySalary: number): { employee: number; employer: number; ec: number } => {
  const msc = Math.max(SSS_MIN_MSC, Math.min(SSS_MAX_MSC, Math.round(monthlySalary / 500) * 500));
  const employee = Math.round(msc * SSS_EMPLOYEE_RATE);
  const employer = Math.round(msc * SSS_EMPLOYER_RATE);
  const ec = msc >= SSS_EC_THRESHOLD ? SSS_EC_HIGH : SSS_EC_LOW;
  return { employee, employer, ec };
};

// ─── Utility: PhilHealth Contribution ────────────────────────────────────────
export const computePhilHealthContribution = (monthlySalary: number): { employee: number; employer: number } => {
  const base = Math.max(PHILHEALTH_MIN_SALARY, Math.min(PHILHEALTH_MAX_SALARY, monthlySalary));
  const total = base * PHILHEALTH_TOTAL_RATE;
  const employee = Math.max(PHILHEALTH_MIN_CONTRIBUTION, Math.min(PHILHEALTH_MAX_CONTRIBUTION, total / 2));
  return { employee, employer: employee };
};

// ─── Utility: Pag-IBIG Contribution ──────────────────────────────────────────
export const computePagIbigContribution = (monthlySalary: number): { employee: number; employer: number } => {
  const rate = monthlySalary <= PAGIBIG_SALARY_THRESHOLD ? PAGIBIG_RATE_LOW : PAGIBIG_RATE_HIGH;
  const employee = Math.min(PAGIBIG_EMPLOYEE_MAX, monthlySalary * rate);
  const employer = Math.max(PAGIBIG_EMPLOYER_MIN, monthlySalary * PAGIBIG_EMPLOYER_RATE);
  return { employee, employer };
};

// ─── Utility: Withholding Tax ─────────────────────────────────────────────────
export const computeWithholdingTax = (annualTaxableIncome: number): number => {
  const bracket = TAX_BRACKETS_ANNUAL.find(
    (b) => annualTaxableIncome >= b.min && annualTaxableIncome <= b.max
  );
  if (!bracket) return 0;
  return bracket.base + (annualTaxableIncome - bracket.min) * bracket.rate;
};

// ─── Day Type Enum ────────────────────────────────────────────────────────────
export type DayType =
  | 'regular'
  | 'rest_day'
  | 'special_non_working'
  | 'regular_holiday'
  | 'regular_holiday_rest_day';

export interface PayrollBreakdown {
  regularPay: number;
  overtimePay: number;
  nightDiffPay: number;
  holidayPay: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  withholdingTax: number;
  totalDeductions: number;
  netPay: number;
}

// ─── Master Payroll Computation ───────────────────────────────────────────────
export interface PayrollInputs {
  monthlyRate: number;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  absentDays: number;
  dayType: DayType;
  isOvertimeOnHoliday?: boolean;
  bonuses?: number;
  otherDeductions?: number;
}

export const computePayroll = (inputs: PayrollInputs): PayrollBreakdown => {
  const {
    monthlyRate,
    regularHours,
    overtimeHours,
    nightDiffHours,
    lateMinutes,
    undertimeMinutes,
    absentDays,
    dayType,
    isOvertimeOnHoliday = false,
    bonuses = 0,
    otherDeductions = 0,
  } = inputs;

  const hourlyRate = computeHourlyRate(monthlyRate);
  const dailyRate = computeDailyRate(monthlyRate);
  const minuteRate = hourlyRate / 60;

  // Regular Pay (adjusted for late, undertime, absences)
  const lateDeduction = lateMinutes * minuteRate;
  const undertimeDeduction = undertimeMinutes * minuteRate;
  const absentDeduction = absentDays * dailyRate;
  const regularPay = Math.max(0, (regularHours * hourlyRate) - lateDeduction - undertimeDeduction - absentDeduction);

  // Overtime Pay
  let otRate = OT_REGULAR_DAY_MULTIPLIER;
  if (dayType === 'rest_day') otRate = OT_REST_DAY_OT_MULTIPLIER;
  else if (dayType === 'special_non_working') otRate = SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER;
  else if (dayType === 'regular_holiday' || dayType === 'regular_holiday_rest_day') {
    otRate = dayType === 'regular_holiday_rest_day'
      ? REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER
      : REGULAR_HOLIDAY_OT_MULTIPLIER;
  }
  const overtimePay = overtimeHours * hourlyRate * otRate;

  // Night Shift Differential
  const nightDiffPay = nightDiffHours * hourlyRate * NIGHT_SHIFT_DIFFERENTIAL_RATE;

  // Holiday Pay (if worked on holiday)
  let holidayPay = 0;
  if (dayType === 'regular_holiday') {
    holidayPay = dailyRate * (REGULAR_HOLIDAY_MULTIPLIER - 1); // extra 100% on top
  } else if (dayType === 'regular_holiday_rest_day') {
    holidayPay = dailyRate * (REGULAR_HOLIDAY_REST_DAY_MULTIPLIER - 1);
  } else if (dayType === 'special_non_working' || dayType === 'rest_day') {
    holidayPay = dailyRate * (SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER - 1);
  }

  const grossPay = regularPay + overtimePay + nightDiffPay + holidayPay + bonuses;

  // Mandatory deductions
  const sss = computeSSSContribution(monthlyRate);
  const philhealth = computePhilHealthContribution(monthlyRate);
  const pagibig = computePagIbigContribution(monthlyRate);

  const totalMandatory = sss.employee + philhealth.employee + pagibig.employee;

  // Withholding tax: based on taxable income (gross - mandatory deductions - 13th month etc.)
  const monthlyTaxable = grossPay - totalMandatory;
  const annualTaxable = monthlyTaxable * 12;
  const annualTax = computeWithholdingTax(annualTaxable);
  const monthlyTax = annualTax / 12;

  const totalDeductions = totalMandatory + monthlyTax + otherDeductions;
  const netPay = Math.max(0, grossPay - totalDeductions);

  return {
    regularPay,
    overtimePay,
    nightDiffPay,
    holidayPay,
    grossPay,
    sssEmployee: sss.employee,
    philhealthEmployee: philhealth.employee,
    pagibigEmployee: pagibig.employee,
    withholdingTax: monthlyTax,
    totalDeductions,
    netPay,
  };
};
