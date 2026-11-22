# Phase 10: Advanced Payroll Features

## Features to Implement

### 10.1 - Payroll Approval Workflow

**Goal**: Add admin approval step before payroll is finalized.

#### Database Changes

```sql
-- Add approval fields to payroll_records table
ALTER TABLE payroll_records ADD COLUMN (
  status VARCHAR(50) DEFAULT 'draft',  -- draft, pending_approval, approved, rejected, finalized
  approver_id UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP,
  rejection_reason TEXT
);

-- Create audit log table
CREATE TABLE payroll_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_id UUID REFERENCES payroll_records(id) ON DELETE CASCADE,
  action VARCHAR(50),  -- created, submitted, approved, rejected, amended
  performed_by UUID REFERENCES auth.users(id),
  timestamp TIMESTAMP DEFAULT now(),
  notes TEXT
);

-- RLS on audit log
ALTER TABLE payroll_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_company_isolation"
ON payroll_audit_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM payroll_records pr
  WHERE pr.id = payroll_audit_log.payroll_id
  AND auth.uid() IS NOT NULL
));
```

#### API Functions

```sql
-- Submit payroll for approval
CREATE OR REPLACE FUNCTION submit_payroll_for_approval(
  payroll_id UUID,
  company_id UUID
)
RETURNS payroll_records AS $$
  UPDATE payroll_records
  SET status = 'pending_approval'
  WHERE id = payroll_id AND company_id = company_id
  RETURNING *;
$$ LANGUAGE SQL;

-- Approve payroll
CREATE OR REPLACE FUNCTION approve_payroll(
  payroll_id UUID,
  company_id UUID,
  approver_id UUID
)
RETURNS payroll_records AS $$
  UPDATE payroll_records
  SET status = 'approved',
      approver_id = approver_id,
      approval_date = now()
  WHERE id = payroll_id AND company_id = company_id
  RETURNING *;
$$ LANGUAGE SQL;

-- Reject payroll with reason
CREATE OR REPLACE FUNCTION reject_payroll(
  payroll_id UUID,
  company_id UUID,
  reason TEXT
)
RETURNS payroll_records AS $$
  UPDATE payroll_records
  SET status = 'rejected',
      rejection_reason = reason
  WHERE id = payroll_id AND company_id = company_id
  RETURNING *;
$$ LANGUAGE SQL;
```

#### Frontend Components

1. **PayrollApprovalQueue.tsx**
   - List pending payroll records
   - Show employee details, amount, submission date
   - Quick approve/reject buttons
   - Comments field for rejection reason

2. **PayrollApprovalDetail.tsx**
   - Full payroll details
   - Approval/rejection modal
   - Audit log of all changes
   - Override option for admin

### 10.2 - Batch Payroll Generation

**Goal**: Generate payroll for all employees in a company at once.

#### Backend Function

```sql
CREATE OR REPLACE FUNCTION batch_generate_payroll(
  company_id UUID,
  month INT,
  year INT
)
RETURNS TABLE(
  total_records INT,
  total_amount NUMERIC,
  failed_count INT,
  errors TEXT[]
) AS $$
DECLARE
  v_emp RECORD;
  v_total_records INT := 0;
  v_total_amount NUMERIC := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_emp IN
    SELECT id FROM employee WHERE company_id = company_id
  LOOP
    BEGIN
      INSERT INTO payroll_records (...) VALUES (...);
      v_total_records := v_total_records + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors, SQLERRM);
    END;
  END LOOP;

  RETURN QUERY SELECT v_total_records, v_total_amount,
    array_length(v_errors, 1)::INT, v_errors;
END;
$$ LANGUAGE PLPGSQL;
```

#### Frontend Component

1. **BatchPayrollWizard.tsx**
   - Step 1: Select month/year
   - Step 2: Review payroll rules (deductions, bonuses)
   - Step 3: Preview generated records
   - Step 4: Confirm and generate
   - Success screen with summary

### 10.3 - PDF Payslip Export

**Goal**: Generate downloadable PDF payslips.

#### Dependencies

- `pdfkit` or `html2pdf` for PDF generation
- `jspdf` + `html2canvas` for client-side PDF

#### Implementation

```typescript
// src/utils/payslipPDF.ts
import html2pdf from "html2pdf.js";

export async function generatePayslipPDF(
  payroll: PayrollRecord,
  employee: Employee,
): Promise<Blob> {
  const element = document.getElementById("payslip-container");
  const options = {
    margin: 10,
    filename: `payslip-${employee.id}-${payroll.month}-${payroll.year}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
  };

  const pdf = await html2pdf().set(options).from(element).outputPdf();
  return pdf;
}
```

#### Components

1. **PayslipViewer.tsx**
   - Display payslip in HTML format
   - "Download PDF" button
   - Print button
   - Share/email button

2. **PayslipTemplate.tsx**
   - Reusable payslip layout
   - Company header, employee details
   - Salary breakdown (gross, deductions, net)
   - QR code with payroll ID
   - Footer with legal text

### 10.4 - Payroll Amendments

**Goal**: Edit past payroll records with audit trail.

#### Database

```sql
-- Existing payroll_audit_log table tracks amendments

-- Amendment tracking
CREATE TABLE payroll_amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_payroll_id UUID REFERENCES payroll_records(id),
  amended_payroll_id UUID REFERENCES payroll_records(id),
  field_name VARCHAR(50),  -- gross_salary, deductions, etc.
  old_value NUMERIC,
  new_value NUMERIC,
  reason TEXT,
  amended_by UUID REFERENCES auth.users(id),
  amended_at TIMESTAMP DEFAULT now(),
  company_id UUID REFERENCES companies(id)
);

ALTER TABLE payroll_amendments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amendments_company_isolation"
ON payroll_amendments FOR SELECT
USING (auth.uid() IS NOT NULL);
```

#### Frontend Components

1. **PayrollAmendmentForm.tsx**
   - Show original values
   - Allow editing specific fields
   - Reason field (required)
   - Preview changes before saving
   - Require approval from higher-level admin

2. **PayrollAmendmentHistory.tsx**
   - Timeline view of all amendments
   - Show who made the change and when
   - Original and amended values
   - Reason for amendment

### 10.5 - Overtime Calculation

**Goal**: Automatically calculate overtime pay.

#### Formula

```
Overtime Hours = Total Hours Worked - 8 hours/day
Overtime Pay Rate = 1.5x base hourly rate
Overtime Amount = Overtime Hours × (base_salary / 240 × 1.5)
```

#### Implementation

```typescript
// src/utils/payrollCalculations.ts
export function calculateOvertime(
  totalHoursWorked: number,
  baseSalary: number,
  workDays: number,
): {
  overtimeHours: number;
  overtimeAmount: number;
} {
  const hoursPerDay = 8;
  const totalHoursExpected = workDays * hoursPerDay;
  const overtimeHours = Math.max(0, totalHoursWorked - totalHoursExpected);
  const hourlyRate = baseSalary / 240; // 240 hours per month
  const overtimeAmount = overtimeHours * hourlyRate * 1.5;

  return { overtimeHours, overtimeAmount };
}
```

### 10.6 - Tax & Deduction Templates

**Goal**: Create reusable tax/deduction configurations per company.

#### Database

```sql
CREATE TABLE deduction_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(100),
  type VARCHAR(50),  -- tax, benefits, loan, etc.
  calculation_type VARCHAR(50),  -- fixed, percentage, formula
  value NUMERIC,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Apply template to payroll
CREATE TABLE payroll_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_id UUID REFERENCES payroll_records(id),
  deduction_template_id UUID REFERENCES deduction_templates(id),
  amount NUMERIC,
  reason TEXT
);
```

#### Components

1. **DeductionTemplateManager.tsx**
   - Create/edit deduction templates
   - Set calculation method (fixed, %, formula)
   - Mark as active/inactive
   - Apply to employees

2. **PayrollDeductionPanel.tsx**
   - Show applied deductions
   - Add/remove deductions
   - See calculated amounts
   - Audit trail of changes

## Implementation Priority

1. **Phase 10.1 - Approval Workflow** (HIGH) - Required for compliance
2. **Phase 10.2 - Batch Generation** (HIGH) - Core feature
3. **Phase 10.3 - PDF Export** (MEDIUM) - User convenience
4. **Phase 10.4 - Amendments** (MEDIUM) - Error correction
5. **Phase 10.5 - Overtime** (LOW) - Future enhancement
6. **Phase 10.6 - Tax Templates** (LOW) - Future enhancement

## Testing Checklist for Phase 10

- [ ] Payroll can be submitted for approval
- [ ] Admin can approve/reject with reason
- [ ] Rejected payroll can be re-submitted
- [ ] Batch generation creates records for all employees
- [ ] Batch generation handles errors gracefully
- [ ] PDF payslip downloads correctly
- [ ] PDF includes all required details
- [ ] Past payroll can be amended
- [ ] Audit log shows all changes
- [ ] Overtime calculated correctly
- [ ] Deduction templates apply to payroll

## Time Estimate

- Phase 10.1: 2-3 hours
- Phase 10.2: 2 hours
- Phase 10.3: 2-3 hours
- Phase 10.4: 2 hours
- Phase 10.5: 1.5 hours
- Phase 10.6: 2 hours

**Total: 12-16 hours**
