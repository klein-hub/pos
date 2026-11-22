export type ConfigFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select";

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  showInList?: boolean;
}

export interface ConfigDefinition {
  slug: string;
  title: string;
  singular: string;
  section: "employees" | "payroll" | "attendance";
  group: string;
  table: string;
  fields: ConfigField[];
  orderBy?: string;
}

const baseNameDescription: ConfigField[] = [
  {
    key: "name",
    label: "Name",
    type: "text",
    placeholder: "Enter name",
    required: true,
    showInList: true,
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Optional description",
    showInList: true,
  },
  { key: "active", label: "Active", type: "boolean" },
];

export const configDefinitions: ConfigDefinition[] = [
  // ─── Employee ──────────────────────────────────────────
  {
    slug: "work-locations",
    title: "Work Locations",
    singular: "Work Location",
    section: "employees",
    group: "Employee",
    table: "work_locations",
    fields: [
      {
        key: "pay_template_id",
        label: "Pay Template",
        type: "number",
        placeholder: "Template ID",
      },
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      { key: "address", label: "Address", type: "textarea", showInList: true },
      {
        key: "location_type",
        label: "Type",
        type: "select",
        showInList: true,
        options: [
          { value: "office", label: "Office" },
          { value: "home", label: "Home" },
          { value: "other", label: "Other" },
        ],
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "working-schedules",
    title: "Working Schedules",
    singular: "Working Schedule",
    section: "employees",
    group: "Employee",
    table: "work_schedules",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      {
        key: "start_time",
        label: "Start Time",
        type: "text",
        placeholder: "e.g. 09:00",
        showInList: true,
      },
      {
        key: "end_time",
        label: "End Time",
        type: "text",
        placeholder: "e.g. 18:00",
        showInList: true,
      },
    ],
  },
  {
    slug: "departure-reasons",
    title: "Departure Reasons",
    singular: "Departure Reason",
    section: "employees",
    group: "Employee",
    table: "departure_reasons",
    fields: baseNameDescription,
  },
  {
    slug: "skill-types",
    title: "Skill Types",
    singular: "Skill Type",
    section: "employees",
    group: "Employee",
    table: "skill_types",
    fields: baseNameDescription,
  },
  {
    slug: "onboarding-offboarding",
    title: "Onboarding / Offboarding",
    singular: "Plan",
    section: "employees",
    group: "Employee",
    table: "onboarding_plans",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      {
        key: "plan_type",
        label: "Plan Type",
        type: "select",
        showInList: true,
        options: [
          { value: "onboarding", label: "Onboarding" },
          { value: "offboarding", label: "Offboarding" },
        ],
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "job-positions",
    title: "Job Positions",
    singular: "Job Position",
    section: "employees",
    group: "Recruitment",
    table: "job_positions",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      {
        key: "is_published",
        label: "Published",
        type: "boolean",
        showInList: true,
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "contract-templates",
    title: "Contract Templates",
    singular: "Contract Template",
    section: "employees",
    group: "Recruitment",
    table: "contract_templates",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      { key: "body", label: "Template Body", type: "textarea" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },

  // ─── Payroll ───────────────────────────────────────────
  {
    slug: "pay-templates",
    title: "Pay Templates",
    singular: "Pay Template",
    section: "payroll",
    group: "Pay Configuration",
    table: "pay_templates",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "e.g. Regular Pay",
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "pay-components",
    title: "Payroll Rules",
    singular: "Payroll Rule",
    section: "payroll",
    group: "Pay Configuration",
    table: "pay_components",
    orderBy: "sequence",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "e.g. Basic Pay",
      },
      {
        key: "code",
        label: "Code",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "BASIC",
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        showInList: true,
        options: [
          { value: "earning", label: "Earning" },
          { value: "deduction", label: "Deduction" },
          { value: "net", label: "Net" },
        ],
      },
      {
        key: "sequence",
        label: "Sequence",
        type: "number",
        showInList: true,
        placeholder: "10",
      },
      {
        key: "condition_type",
        label: "Condition",
        type: "select",
        options: [
          { value: "always", label: "Always" },
          { value: "input", label: "Based on input" },
          { value: "expression", label: "Expression" },
        ],
      },
      {
        key: "condition_expression",
        label: "Condition Expression",
        type: "text",
        placeholder: "e.g. BASIC > 0",
      },
      {
        key: "computation_type",
        label: "Computation",
        type: "select",
        showInList: true,
        options: [
          { value: "fixed", label: "Fixed amount" },
          { value: "percentage", label: "Percentage of code" },
          { value: "formula", label: "Formula" },
        ],
      },
      { key: "amount", label: "Amount", type: "number", placeholder: "0" },
      {
        key: "percentage",
        label: "Percentage (%)",
        type: "number",
        placeholder: "e.g. 4.5",
      },
      {
        key: "percentage_of_code",
        label: "Percentage Of Code",
        type: "text",
        placeholder: "BASIC",
      },
      {
        key: "formula",
        label: "Formula",
        type: "textarea",
        placeholder: "BASIC + OVERTIME",
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "pay-component-groups",
    title: "Payroll Rule Groups",
    singular: "Payroll Rule Group",
    section: "payroll",
    group: "Pay Configuration",
    table: "pay_component_groups",
    orderBy: "name",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "e.g. Government Deductions",
      },
      {
        key: "code",
        label: "Code",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "GOV_DEDUCTIONS",
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        showInList: true,
        options: [
          { value: "earning", label: "Earnings" },
          { value: "deduction", label: "Deductions" },
          { value: "mixed", label: "Mixed" },
        ],
      },
      {
        key: "component_codes",
        label: "Rules",
        type: "text",
        showInList: true,
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "pay-constants",
    title: "Pay Constants",
    singular: "Pay Constant",
    section: "payroll",
    group: "Pay Configuration",
    table: "pay_constants",
    orderBy: "category",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "e.g. Overtime Regular Day Multiplier",
      },
      {
        key: "code",
        label: "Code",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "OT_REGULAR_DAY_MULTIPLIER",
      },
      {
        key: "value",
        label: "Value",
        type: "number",
        required: true,
        showInList: true,
        placeholder: "1.25",
      },
      {
        key: "category",
        label: "Category",
        type: "select",
        showInList: true,
        options: [
          { value: "working_hours", label: "Working Hours" },
          { value: "overtime", label: "Overtime" },
          { value: "rest_day_holiday", label: "Rest Day / Holiday" },
          { value: "night_diff", label: "Night Differential" },
          { value: "thirteenth_month", label: "13th Month" },
          { value: "sss", label: "SSS" },
          { value: "philhealth", label: "PhilHealth" },
          { value: "pagibig", label: "Pag-IBIG" },
          { value: "tax", label: "Tax" },
          { value: "general", label: "General" },
          { value: "labor_code", label: "Labor Code" },
        ],
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      { key: "value_type", label: "Value Type", type: "text" },
      { key: "formula_tokens", label: "Formula Tokens", type: "text" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "work-entry-types",
    title: "Work Entry Types",
    singular: "Work Entry Type",
    section: "payroll",
    group: "Work Entries",
    table: "work_entry_types",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      { key: "code", label: "Code", type: "text", showInList: true },
      { key: "is_paid", label: "Is Paid", type: "boolean", showInList: true },
      { key: "color", label: "Color", type: "text", placeholder: "#3B82F6" },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
  {
    slug: "payroll-working-schedules",
    title: "Working Schedules",
    singular: "Working Schedule",
    section: "payroll",
    group: "Work Entries",
    table: "work_schedules",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      {
        key: "start_time",
        label: "Start Time",
        type: "text",
        placeholder: "e.g. 09:00",
        showInList: true,
      },
      {
        key: "end_time",
        label: "End Time",
        type: "text",
        placeholder: "e.g. 18:00",
        showInList: true,
      },
    ],
  },

  // ─── Attendance ────────────────────────────────────────
  {
    slug: "attendance-shifts",
    title: "Shifts",
    singular: "Shift",
    section: "attendance",
    group: "Attendance",
    table: "work_schedules",
    orderBy: "start_time",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
        placeholder: "e.g. Mid",
      },
      {
        key: "start_time",
        label: "Start Time",
        type: "text",
        placeholder: "e.g. 09:00 AM",
        showInList: true,
      },
      {
        key: "end_time",
        label: "End Time",
        type: "text",
        placeholder: "e.g. 06:00 PM",
        showInList: true,
      },
    ],
  },
  {
    slug: "attendance-modes",
    title: "Attendance Modes",
    singular: "Attendance Mode",
    section: "attendance",
    group: "Attendance",
    table: "attendance_modes",
    fields: baseNameDescription,
  },
  {
    slug: "attendance-reasons",
    title: "Attendance Reasons",
    singular: "Attendance Reason",
    section: "attendance",
    group: "Attendance",
    table: "attendance_reasons",
    fields: [
      {
        key: "name",
        label: "Name",
        type: "text",
        required: true,
        showInList: true,
      },
      {
        key: "reason_type",
        label: "Reason Type",
        type: "select",
        showInList: true,
        options: [
          { value: "late", label: "Late" },
          { value: "absent", label: "Absent" },
          { value: "overtime", label: "Overtime" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "description",
        label: "Description",
        type: "textarea",
        showInList: true,
      },
      { key: "active", label: "Active", type: "boolean" },
    ],
  },
];

export const getConfigBySection = (section: ConfigDefinition["section"]) =>
  configDefinitions.filter((c) => c.section === section);

export const getConfigBySlug = (slug: string) =>
  configDefinitions.find((c) => c.slug === slug);

export const getGroupedConfigs = (section: ConfigDefinition["section"]) => {
  const configs = getConfigBySection(section);
  const groups: Record<string, ConfigDefinition[]> = {};
  configs.forEach((c) => {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  });
  return groups;
};
