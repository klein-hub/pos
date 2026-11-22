# Phase 11: Analytics & Reporting Dashboards

## Overview

Provide comprehensive analytics and reporting capabilities for super admins, company admins, and employees.

## Features

### 11.1 - Payroll Summary Dashboard

**Goal**: Show high-level payroll metrics for the company.

#### Metrics

- Total payroll amount (month/year)
- Number of employees paid
- Pending approvals count
- Average salary
- Attendance rate
- Salary range (min/max)

#### Database Queries

```sql
CREATE VIEW payroll_summary AS
SELECT
  company_id,
  month,
  year,
  COUNT(*) as employee_count,
  SUM(gross_salary) as total_gross,
  SUM(net_salary) as total_net,
  AVG(gross_salary) as avg_salary,
  MIN(gross_salary) as min_salary,
  MAX(gross_salary) as max_salary
FROM payroll_records
GROUP BY company_id, month, year;
```

#### UI Component

```typescript
// src/pages/PayrollAnalytics.tsx
- Stat cards: total paid, employees, pending approvals
- Line chart: payroll trend over 6 months
- Bar chart: salary distribution
- Table: monthly summary with drill-down
```

### 11.2 - Employee Earnings Report

**Goal**: Detailed earnings report per employee with exports.

#### Fields

- Employee name, ID, position
- Month/year
- Gross salary, deductions, net pay
- Attendance rate
- Overtime hours (if applicable)
- Year-to-date totals

#### Export Formats

1. **CSV Export**
```typescript
export function generateEarningsCSV(records: PayrollRecord[]): string {
  const csv = [
    ['Employee ID', 'Name', 'Month', 'Gross', 'Deductions', 'Net', 'Attendance %'],
    ...records.map(r => [r.employee_id, r.employee.name, r.month, ...])
  ];
  return csv.map(row => row.join(',')).join('\n');
}
```

2. **Excel Export**
```typescript
// Use xlsx library for formatted spreadsheets with formulas
import XLSX from 'xlsx';

export function generateEarningsExcel(records: PayrollRecord[]) {
  const ws = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Earnings');
  XLSX.writeFile(wb, 'earnings_report.xlsx');
}
```

#### UI Component

```typescript
// src/pages/EmployeeEarningsReport.tsx
- Date range picker (from/to month)
- Employee filter/search
- Table view with sortable columns
- "Download CSV" button
- "Download Excel" button
- Print preview
```

### 11.3 - Department Analytics

**Goal**: Compare payroll metrics across departments (if multi-dept support exists).

#### Metrics Per Department

- Total employees
- Total payroll
- Average salary
- Attendance rate
- Salary trends

#### Dashboard

- Department comparison cards
- Payroll distribution pie chart
- Department-wise salary distribution
- Department-wise attendance

### 11.4 - Salary Trends & Variance Analysis

**Goal**: Track salary trends and identify variances.

#### Analyses

1. **Month-over-Month Growth**
```
Previous Month Total: $100,000
Current Month Total: $105,000
Variance: +5% ($5,000)
```

2. **YTD Comparison**
```
Year-to-Date vs Same Period Last Year: +8%
```

3. **Budget vs Actual**
```
Budgeted: $110,000
Actual: $105,000
Variance: -$5,000 (under budget)
```

4. **Outlier Detection**
```
Employees with unusual changes:
- John Doe: +25% (promotion/raise)
- Jane Smith: -15% (reduced hours)
```

#### Implementation

```typescript
// src/utils/analytics.ts
export function calculateVariance(
  current: number,
  previous: number
): { absolute: number; percentage: number } {
  return {
    absolute: current - previous,
    percentage: ((current - previous) / previous) * 100,
  };
}

export function identifyOutliers(
  records: PayrollRecord[],
  threshold: number = 20 // 20% variance
) {
  return records.filter(r => {
    const variance = calculateVariance(r.gross_salary, r.previous_month_salary);
    return Math.abs(variance.percentage) > threshold;
  });
}
```

#### UI Component

```typescript
// src/pages/SalaryTrendsAnalytics.tsx
- Line chart: total payroll trend over 12 months
- Variance summary: MoM, YoY, budget vs actual
- Outliers table: employees with significant changes
- Alert indicators for unusual variances
- Drill-down to employee detail on click
```

### 11.5 - Compliance Reports

**Goal**: Generate reports for compliance and auditing.

#### Report Types

1. **Payroll Register**
   - Date range
   - All employees, gross/net/deductions
   - Signed/approved by manager
   - Audit trail

2. **Tax Deduction Report**
   - Total tax withheld per month
   - Tax file format (for tax authority submission)

3. **Employee Movements**
   - New hires, terminations
   - Salary changes with dates
   - Promotions/transfers

#### Implementation

```typescript
// src/utils/complianceReports.ts

export function generatePayrollRegister(
  payrolls: PayrollRecord[],
  approvedBy: string,
  company: Company
): HTMLString {
  return `
    <h1>Payroll Register - ${company.name}</h1>
    <p>Approved by: ${approvedBy}</p>
    <table>
      ${payrolls.map(p => `<tr><td>${p.employee.name}</td><td>${p.gross}</td></tr>`)}
    </table>
  `;
}

export function generateTaxDeductionReport(
  payrolls: PayrollRecord[],
  month: number,
  year: number
): Record<string, number> {
  const report: Record<string, number> = {};
  
  payrolls.forEach(p => {
    const taxDeduction = p.deductions.find(d => d.type === 'tax');
    if (taxDeduction) {
      report[`Month_${month}`] = (report[`Month_${month}`] || 0) + taxDeduction.amount;
    }
  });
  
  return report;
}
```

### 11.6 - Audit Log Viewer

**Goal**: View all changes to payroll records.

#### Log Fields

- Action (created, updated, approved, rejected, amended)
- User who performed action
- Timestamp
- Old value, new value
- Reason/notes

#### UI Component

```typescript
// src/components/AuditLogViewer.tsx
- Table view of all payroll changes
- Filter by date, user, action type
- Side-by-side comparison of old/new values
- Search payroll records
- Export audit log to CSV
```

## Database Schema Extensions

```sql
-- Already created in Phase 10
-- payroll_audit_log table
-- payroll_amendments table

-- Add additional analytics views
CREATE VIEW monthly_payroll_trends AS
SELECT
  DATE_TRUNC('month', approval_date)::DATE as month,
  company_id,
  SUM(net_salary) as total_net,
  COUNT(*) as employee_count,
  AVG(gross_salary) as avg_salary
FROM payroll_records
WHERE status = 'approved'
GROUP BY DATE_TRUNC('month', approval_date), company_id;

CREATE VIEW department_payroll_summary AS
SELECT
  d.id,
  d.name,
  COUNT(e.id) as employee_count,
  AVG(e.base_salary) as avg_salary,
  SUM(e.base_salary) as total_salary
FROM departments d
LEFT JOIN employee e ON d.id = e.department_id
GROUP BY d.id, d.name;
```

## UI Components to Create

1. **PayrollAnalytics.tsx** - Main analytics dashboard
2. **EmployeeEarningsReport.tsx** - Employee earnings export
3. **DepartmentAnalytics.tsx** - Department comparison
4. **SalaryTrendsAnalytics.tsx** - Trends and variance
5. **ComplianceReports.tsx** - Compliance report generation
6. **AuditLogViewer.tsx** - Audit log viewer

## Navigation Updates

Add "Analytics" section to sidebar:
- Dashboard (payroll summary)
- Employee Earnings
- Department Analytics
- Salary Trends
- Compliance
- Audit Logs

## Implementation Priority

1. **Phase 11.1 - Payroll Summary** (HIGH) - Overview dashboard
2. **Phase 11.2 - Earnings Export** (HIGH) - Required feature
3. **Phase 11.4 - Salary Trends** (MEDIUM) - Analysis
4. **Phase 11.3 - Department Analytics** (MEDIUM) - If multi-dept
5. **Phase 11.5 - Compliance** (MEDIUM) - Regulatory
6. **Phase 11.6 - Audit Log** (LOW) - Logging/tracking

## Time Estimate

- Phase 11.1: 3 hours
- Phase 11.2: 3 hours
- Phase 11.3: 2 hours
- Phase 11.4: 3 hours
- Phase 11.5: 3 hours
- Phase 11.6: 2 hours

**Total: 16 hours**

## Testing Checklist

- [ ] Analytics dashboard loads correctly
- [ ] Payroll metrics are accurate
- [ ] CSV export downloads correctly
- [ ] Excel export has proper formatting
- [ ] Charts render with correct data
- [ ] Variance calculations are accurate
- [ ] Outlier detection works
- [ ] Audit log shows all changes
- [ ] Report exports are complete
