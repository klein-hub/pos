import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Flex,
  HStack,
  Heading,
  Button,
  Text,
  Badge,
  useColorModeValue,
  Textarea,
  Select,
  Checkbox,
  VStack,
  FormControl,
  FormLabel,
  useDisclosure,
  IconButton,
  Spinner,
  Center,
  Tooltip,
  Icon,
} from "@chakra-ui/react";
import {
  PlusCircle,
  Pencil,
  Trash2,
  Settings,
  ArrowLeft,
  Info,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { supabase } from "../lib/supabase";
import {
  REGULAR_WORK_HOURS_PER_DAY,
  REGULAR_WORK_DAYS_PER_WEEK,
  WORKING_DAYS_PER_MONTH,
  WORKING_HOURS_PER_MONTH,
  OT_REGULAR_DAY_MULTIPLIER,
  OT_REST_DAY_MULTIPLIER,
  OT_REST_DAY_OT_MULTIPLIER,
  REST_DAY_MULTIPLIER,
  SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER,
  SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER,
  REGULAR_HOLIDAY_MULTIPLIER,
  REGULAR_HOLIDAY_OT_MULTIPLIER,
  REGULAR_HOLIDAY_REST_DAY_MULTIPLIER,
  REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER,
  REGULAR_HOLIDAY_NO_WORK_MULTIPLIER,
  NIGHT_SHIFT_DIFFERENTIAL_RATE,
  NSD_OT_REGULAR_DAY,
  NSD_OT_REST_DAY,
  NSD_OT_REGULAR_HOLIDAY,
  THIRTEENTH_MONTH_DIVISOR,
  SSS_EMPLOYEE_RATE,
  SSS_EMPLOYER_RATE,
  SSS_MIN_MSC,
  SSS_MAX_MSC,
  SSS_EC_LOW,
  SSS_EC_HIGH,
  SSS_EC_THRESHOLD,
  PHILHEALTH_TOTAL_RATE,
  PHILHEALTH_EMPLOYEE_RATE,
  PHILHEALTH_EMPLOYER_RATE,
  PHILHEALTH_MIN_SALARY,
  PHILHEALTH_MAX_SALARY,
  PHILHEALTH_MIN_CONTRIBUTION,
  PHILHEALTH_MAX_CONTRIBUTION,
  PAGIBIG_RATE_LOW,
  PAGIBIG_RATE_HIGH,
  PAGIBIG_SALARY_THRESHOLD,
  PAGIBIG_EMPLOYEE_MAX,
  PAGIBIG_EMPLOYER_RATE,
  PAGIBIG_EMPLOYER_MIN,
} from "../lib/laborCode";
import { getConfigBySlug, ConfigField } from "../config/configRegistry";
import { ModuleTabs } from "../components/layout/ModuleTabs";
import {
  PayComponentForm,
  PayComponentFormValue,
  emptyPayComponent,
} from "../components/payroll/PayComponentForm";
import {
  PayConstantForm,
  PayConstantFormValue,
  emptyPayConstant,
} from "../components/payroll/PayConstantForm";
import {
  PayComponentGroupForm,
  PayComponentGroupFormValue,
  emptyPayComponentGroup,
} from "../components/payroll/PayComponentGroupForm";
import { normaliseComponentCodes } from "../lib/payTemplateLayout";

const PAGE_INFO: Record<string, string> = {
  "pay-templates":
    "A Pay Template defines which Payroll Rules apply to a group of employees and how the payslip is laid out. Assign a template to each employee to control what gets computed during a pay run.",
  "pay-components":
    "Payroll Rules are the computation rules that run during a pay run — fixed amounts, percentages, or formulas. They belong to a Pay Template; only the rules of an employee's assigned template are calculated.",
  "pay-component-groups":
    "Payroll Rule Groups are reusable collections of rule codes that a payslip block can render together. Use them to build grouped earnings or deductions sections in Pay Templates.",
  "pay-constants":
    "Reusable numeric values (e.g. SSS rate, PhilHealth rate) referenced inside Payroll Rule formulas. Update a constant once and every formula using it updates automatically.",
  "attendance-shifts":
    "Defines the shifts used in the Attendance List dropdown. Add, rename, or adjust shift start and end times here, and the Attendance List will use the same options.",
  "work-entry-types":
    "Defines the types of time/attendance entries that can be recorded (e.g. Regular, Overtime, Night Differential), referenced when computing Payroll Rule conditions.",
  "payroll-working-schedules":
    "Defines standard work schedules (e.g. Mon–Fri 8am–5pm) used to calculate worked hours, late deductions, and undertime during a pay run.",
};

const DEFAULT_ATTENDANCE_SHIFTS = [
  {
    name: "Morning",
    start_time: "7:00 AM",
    end_time: "4:00 PM",
  },
  {
    name: "Mid",
    start_time: "9:00 AM",
    end_time: "6:00 PM",
  },
  {
    name: "Night",
    start_time: "10:00 PM",
    end_time: "7:00 AM",
  },
];

const DEFAULT_PAY_CONSTANTS = [
  // Working Hours
  {
    name: "Regular Work Hours Per Day",
    code: "REGULAR_WORK_HOURS_PER_DAY",
    value: REGULAR_WORK_HOURS_PER_DAY,
    category: "working_hours",
    description: "Art. 83: Normal hours of work per day",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Regular Work Days Per Week",
    code: "REGULAR_WORK_DAYS_PER_WEEK",
    value: REGULAR_WORK_DAYS_PER_WEEK,
    category: "working_hours",
    description: "Standard 5-day workweek",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Working Days Per Month",
    code: "WORKING_DAYS_PER_MONTH",
    value: WORKING_DAYS_PER_MONTH,
    category: "working_hours",
    description: "Used to compute daily rate from monthly rate (22 days)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Working Hours Per Month",
    code: "WORKING_HOURS_PER_MONTH",
    value: WORKING_HOURS_PER_MONTH,
    category: "working_hours",
    description: "22 days × 8 hours = 176 hours per month",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Tardiness Rate Factor",
    code: "TARDINESS_RATE_FACTOR",
    value: OT_REGULAR_DAY_MULTIPLIER / REGULAR_WORK_HOURS_PER_DAY / 60,
    category: "general",
    description:
      "Minute-rate factor for tardiness deduction: OT Regular Day Multiplier ÷ Regular Work Hours Per Day ÷ 60.",
    value_type: "formula",
    formula_tokens: [
      { type: "constant", code: "OT_REGULAR_DAY_MULTIPLIER" },
      { type: "op", op: "/" },
      { type: "constant", code: "REGULAR_WORK_HOURS_PER_DAY" },
      { type: "op", op: "/" },
      { type: "number", val: 60 },
    ],
    active: true,
  },
  // Overtime
  {
    name: "OT Regular Day Multiplier",
    code: "OT_REGULAR_DAY_MULTIPLIER",
    value: OT_REGULAR_DAY_MULTIPLIER,
    category: "overtime",
    description: "Art. 87: Regular day overtime — 125% of hourly rate",
    value_type: "fixed",
    active: true,
  },
  {
    name: "OT Rest Day Multiplier",
    code: "OT_REST_DAY_MULTIPLIER",
    value: OT_REST_DAY_MULTIPLIER,
    category: "overtime",
    description: "Rest day first 8 hrs — 130% of hourly rate",
    value_type: "fixed",
    active: true,
  },
  {
    name: "OT Rest Day (excess 8 hrs) Multiplier",
    code: "OT_REST_DAY_OT_MULTIPLIER",
    value: OT_REST_DAY_OT_MULTIPLIER,
    category: "overtime",
    description:
      "Rest day OT beyond 8 hrs — 130% on top of rest day rate (≈1.69×)",
    value_type: "fixed",
    active: true,
  },
  // Rest Day / Holiday
  {
    name: "Rest Day Multiplier",
    code: "REST_DAY_MULTIPLIER",
    value: REST_DAY_MULTIPLIER,
    category: "rest_day_holiday",
    description: "Art. 91–93: Work on rest day — +30% of daily rate",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Special Non-Working Holiday Multiplier",
    code: "SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER",
    value: SPECIAL_NON_WORKING_HOLIDAY_MULTIPLIER,
    category: "rest_day_holiday",
    description: "Special non-working holiday — +30%",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Special Non-Working Holiday OT Multiplier",
    code: "SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER",
    value: SPECIAL_NON_WORKING_HOLIDAY_OT_MULTIPLIER,
    category: "rest_day_holiday",
    description: "OT on special non-working holiday — 130% of 130% (≈1.69×)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Regular Holiday Multiplier",
    code: "REGULAR_HOLIDAY_MULTIPLIER",
    value: REGULAR_HOLIDAY_MULTIPLIER,
    category: "rest_day_holiday",
    description:
      "Art. 94: Work on regular holiday — 200% of daily rate (double pay)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Regular Holiday OT Multiplier",
    code: "REGULAR_HOLIDAY_OT_MULTIPLIER",
    value: REGULAR_HOLIDAY_OT_MULTIPLIER,
    category: "rest_day_holiday",
    description: "OT on regular holiday — 200% + 30% thereof = 260%",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Regular Holiday Rest Day Multiplier",
    code: "REGULAR_HOLIDAY_REST_DAY_MULTIPLIER",
    value: REGULAR_HOLIDAY_REST_DAY_MULTIPLIER,
    category: "rest_day_holiday",
    description: "Regular holiday falling on rest day — 300% of daily rate",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Regular Holiday Rest Day OT Multiplier",
    code: "REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER",
    value: REGULAR_HOLIDAY_REST_DAY_OT_MULTIPLIER,
    category: "rest_day_holiday",
    description: "OT on regular holiday rest day — 300% + 30% = 390%",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Regular Holiday No Work Multiplier",
    code: "REGULAR_HOLIDAY_NO_WORK_MULTIPLIER",
    value: REGULAR_HOLIDAY_NO_WORK_MULTIPLIER,
    category: "rest_day_holiday",
    description: "Art. 94: Paid even if not worked on regular holiday",
    value_type: "fixed",
    active: true,
  },
  // Night Differential
  {
    name: "Night Shift Differential Rate",
    code: "NIGHT_SHIFT_DIFFERENTIAL_RATE",
    value: NIGHT_SHIFT_DIFFERENTIAL_RATE,
    category: "night_diff",
    description: "Art. 86: 10% additional pay for night shift (10PM–6AM)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "NSD OT Regular Day",
    code: "NSD_OT_REGULAR_DAY",
    value: NSD_OT_REGULAR_DAY,
    category: "night_diff",
    description: "NSD + OT on regular day — OT rate × 1.10",
    value_type: "fixed",
    active: true,
  },
  {
    name: "NSD OT Rest Day",
    code: "NSD_OT_REST_DAY",
    value: NSD_OT_REST_DAY,
    category: "night_diff",
    description: "NSD + OT on rest day — rest day OT rate × 1.10",
    value_type: "fixed",
    active: true,
  },
  {
    name: "NSD OT Regular Holiday",
    code: "NSD_OT_REGULAR_HOLIDAY",
    value: NSD_OT_REGULAR_HOLIDAY,
    category: "night_diff",
    description: "NSD + OT on regular holiday — holiday OT rate × 1.10",
    value_type: "fixed",
    active: true,
  },
  // 13th Month
  {
    name: "13th Month Divisor",
    code: "THIRTEENTH_MONTH_DIVISOR",
    value: THIRTEENTH_MONTH_DIVISOR,
    category: "thirteenth_month",
    description: "P.D. 851: Total basic salary earned in year ÷ 12",
    value_type: "fixed",
    active: true,
  },
  // SSS
  {
    name: "SSS Employee Rate",
    code: "SSS_EMPLOYEE_RATE",
    value: SSS_EMPLOYEE_RATE,
    category: "sss",
    description: "R.A. 11199: Employee SSS contribution rate (4.5%)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "SSS Employer Rate",
    code: "SSS_EMPLOYER_RATE",
    value: SSS_EMPLOYER_RATE,
    category: "sss",
    description: "R.A. 11199: Employer SSS contribution rate (9.5%)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "SSS Min Monthly Salary Credit",
    code: "SSS_MIN_MSC",
    value: SSS_MIN_MSC,
    category: "sss",
    description: "Minimum Monthly Salary Credit for SSS (₱4,000)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "SSS Max Monthly Salary Credit",
    code: "SSS_MAX_MSC",
    value: SSS_MAX_MSC,
    category: "sss",
    description: "Maximum Monthly Salary Credit for SSS (₱30,000)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "SSS EC Contribution Low",
    code: "SSS_EC_LOW",
    value: SSS_EC_LOW,
    category: "sss",
    description: "Employee Compensation fund for MSC below ₱14,750",
    value_type: "fixed",
    active: true,
  },
  {
    name: "SSS EC Contribution High",
    code: "SSS_EC_HIGH",
    value: SSS_EC_HIGH,
    category: "sss",
    description: "Employee Compensation fund for MSC ≥ ₱14,750",
    value_type: "fixed",
    active: true,
  },
  {
    name: "SSS EC Threshold",
    code: "SSS_EC_THRESHOLD",
    value: SSS_EC_THRESHOLD,
    category: "sss",
    description: "MSC threshold for EC contribution tier (₱14,750)",
    value_type: "fixed",
    active: true,
  },
  // PhilHealth
  {
    name: "PhilHealth Total Rate",
    code: "PHILHEALTH_TOTAL_RATE",
    value: PHILHEALTH_TOTAL_RATE,
    category: "philhealth",
    description: "R.A. 11223: Total premium rate — 5% of basic monthly salary",
    value_type: "fixed",
    active: true,
  },
  {
    name: "PhilHealth Employee Rate",
    code: "PHILHEALTH_EMPLOYEE_RATE",
    value: PHILHEALTH_EMPLOYEE_RATE,
    category: "philhealth",
    description: "Employee share — 2.5% of basic monthly salary",
    value_type: "fixed",
    active: true,
  },
  {
    name: "PhilHealth Employer Rate",
    code: "PHILHEALTH_EMPLOYER_RATE",
    value: PHILHEALTH_EMPLOYER_RATE,
    category: "philhealth",
    description: "Employer share — 2.5% of basic monthly salary",
    value_type: "fixed",
    active: true,
  },
  {
    name: "PhilHealth Min Salary Base",
    code: "PHILHEALTH_MIN_SALARY",
    value: PHILHEALTH_MIN_SALARY,
    category: "philhealth",
    description: "Minimum salary base for PhilHealth computation (₱10,000)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "PhilHealth Max Salary Base",
    code: "PHILHEALTH_MAX_SALARY",
    value: PHILHEALTH_MAX_SALARY,
    category: "philhealth",
    description: "Maximum salary base for PhilHealth computation (₱100,000)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "PhilHealth Min Employee Contribution",
    code: "PHILHEALTH_MIN_CONTRIBUTION",
    value: PHILHEALTH_MIN_CONTRIBUTION,
    category: "philhealth",
    description: "Minimum employee monthly contribution (₱250)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "PhilHealth Max Employee Contribution",
    code: "PHILHEALTH_MAX_CONTRIBUTION",
    value: PHILHEALTH_MAX_CONTRIBUTION,
    category: "philhealth",
    description: "Maximum employee monthly contribution (₱2,500)",
    value_type: "fixed",
    active: true,
  },
  // Pag-IBIG
  {
    name: "Pag-IBIG Rate Low",
    code: "PAGIBIG_RATE_LOW",
    value: PAGIBIG_RATE_LOW,
    category: "pagibig",
    description: "R.A. 9679: Employee rate for salary ≤ ₱1,500 (1%)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Pag-IBIG Rate High",
    code: "PAGIBIG_RATE_HIGH",
    value: PAGIBIG_RATE_HIGH,
    category: "pagibig",
    description: "Employee rate for salary > ₱1,500 (2%)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Pag-IBIG Salary Threshold",
    code: "PAGIBIG_SALARY_THRESHOLD",
    value: PAGIBIG_SALARY_THRESHOLD,
    category: "pagibig",
    description: "Salary threshold for Pag-IBIG rate change (₱1,500)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Pag-IBIG Employee Max Contribution",
    code: "PAGIBIG_EMPLOYEE_MAX",
    value: PAGIBIG_EMPLOYEE_MAX,
    category: "pagibig",
    description: "Maximum employee monthly Pag-IBIG contribution (₱100)",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Pag-IBIG Employer Rate",
    code: "PAGIBIG_EMPLOYER_RATE",
    value: PAGIBIG_EMPLOYER_RATE,
    category: "pagibig",
    description: "Employer always contributes 2% of monthly compensation",
    value_type: "fixed",
    active: true,
  },
  {
    name: "Pag-IBIG Employer Min Contribution",
    code: "PAGIBIG_EMPLOYER_MIN",
    value: PAGIBIG_EMPLOYER_MIN,
    category: "pagibig",
    description: "Minimum employer monthly Pag-IBIG contribution (₱200)",
    value_type: "fixed",
    active: true,
  },
];

const initialRecordForFields = (fields: ConfigField[]) => {
  const rec: Record<string, any> = {};
  fields.forEach((f) => {
    rec[f.key] =
      f.type === "boolean"
        ? f.key === "active"
          ? true
          : false
        : f.type === "number"
          ? 0
          : "";
  });
  return rec;
};

export const ConfigPage = () => {
  const { section, slug } = useParams<{ section: string; slug: string }>();
  const def = slug ? getConfigBySlug(slug) : undefined;
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<any>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const textColor = useColorModeValue("gray.900", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const bannerBg = useColorModeValue("blue.50", "blue.900");
  const bannerBorder = useColorModeValue("blue.100", "blue.800");
  const bannerText = useColorModeValue("blue.800", "blue.100");
  const linkBannerBg = useColorModeValue("cyan.50", "gray.750");
  const linkBannerBorder = useColorModeValue("cyan.200", "cyan.800");
  const linkBannerText = useColorModeValue("cyan.800", "cyan.200");

  const fetchRecords = useCallback(async () => {
    if (!def) return;
    setLoading(true);
    const query = supabase.from(def.table).select("*");
    const orderCol = def.orderBy ?? "created_at";
    const { data, error } = await query.order(orderCol, { ascending: true });
    if (error) {
      toast.error(error.message);
    } else {
      setRecords(data || []);
    }
    setLoading(false);
  }, [def]);

  const seedAttendanceShifts = async () => {
    if (
      !confirm(
        `This will insert ${DEFAULT_ATTENDANCE_SHIFTS.length} default shifts used in the Attendance List. Continue?`,
      )
    )
      return;
    setSeeding(true);
    const { error } = await supabase
      .from("work_schedules")
      .insert(DEFAULT_ATTENDANCE_SHIFTS);
    setSeeding(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Default shifts seeded successfully!");
      fetchRecords();
    }
  };

  const seedPayConstants = async () => {
    if (
      !confirm(
        `This will insert ${DEFAULT_PAY_CONSTANTS.length} Philippine labor code constants. Continue?`,
      )
    )
      return;
    setSeeding(true);
    const { error } = await supabase
      .from("pay_constants")
      .insert(DEFAULT_PAY_CONSTANTS);
    setSeeding(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        `${DEFAULT_PAY_CONSTANTS.length} constants seeded successfully!`,
      );
      fetchRecords();
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  if (!def) {
    return (
      <Center h="60vh">
        <Text color={subText}>Configuration not found.</Text>
      </Center>
    );
  }

  if (section !== def.section) {
    return (
      <Center h="60vh">
        <Text color={subText}>Configuration path mismatch.</Text>
      </Center>
    );
  }

  const handleOpenCreate = () => {
    setEditingId(null);
    if (def.slug === "pay-components") {
      setForm(emptyPayComponent() as unknown as Record<string, any>);
    } else if (def.slug === "pay-component-groups") {
      setForm(emptyPayComponentGroup() as unknown as Record<string, any>);
    } else if (def.slug === "pay-constants") {
      setForm(emptyPayConstant() as unknown as Record<string, any>);
    } else {
      setForm(initialRecordForFields(def.fields));
    }
    onOpen();
  };

  const handleOpenEdit = (rec: any) => {
    setEditingId(rec.id);
    if (def.slug === "pay-components") {
      const base = emptyPayComponent() as unknown as Record<string, any>;
      setForm({
        ...base,
        ...rec,
      });
    } else if (def.slug === "pay-component-groups") {
      const base = emptyPayComponentGroup() as unknown as Record<string, any>;
      setForm({
        ...base,
        ...rec,
        component_codes: normaliseComponentCodes(rec.component_codes),
      });
    } else if (def.slug === "pay-constants") {
      const base = emptyPayConstant() as unknown as Record<string, any>;
      setForm({
        ...base,
        ...rec,
        formula_tokens: Array.isArray(rec.formula_tokens)
          ? rec.formula_tokens
          : (() => {
              try {
                return JSON.parse(rec.formula_tokens ?? "[]");
              } catch {
                return [];
              }
            })(),
      });
    } else {
      const init = initialRecordForFields(def.fields);
      def.fields.forEach((f) => {
        init[f.key] = rec[f.key] ?? init[f.key];
      });
      setForm(init);
    }
    onOpen();
  };

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const payload: Record<string, any> = {};
    def.fields.forEach((f) => {
      let v = form[f.key];
      if (def.slug === "pay-constants" && f.key === "value") {
        v = v === "" || v == null ? 0 : Number(v);
      } else if (def.slug === "pay-constants" && f.key === "formula_tokens") {
        v = Array.isArray(v) ? v : [];
      } else if (
        def.slug === "pay-component-groups" &&
        f.key === "component_codes"
      ) {
        v = Array.isArray(v) ? v : normaliseComponentCodes(v);
      } else if (def.slug === "pay-components" && f.key === "pay_template_id") {
        v = v === "" || v == null || Number(v) === 0 ? null : Number(v);
      } else if (f.type === "number") {
        v = v === "" || v == null ? null : Number(v);
      }
      payload[f.key] = v;
    });

    setLoading(true);
    let error;
    if (editingId) {
      ({ error } = await supabase
        .from(def.table)
        .update(payload)
        .eq("id", editingId));
    } else {
      ({ error } = await supabase.from(def.table).insert([payload]));
    }
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${def.singular} ${editingId ? "updated" : "created"}`);
      onClose();
      fetchRecords();
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm(`Delete this ${def.singular.toLowerCase()}?`)) return;
    const { error } = await supabase.from(def.table).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      fetchRecords();
    }
  };

  const listFields = def.fields.filter((f) => f.showInList);
  const headers = [...listFields.map((f) => f.label), "Actions"];

  const renderCell = (rec: any, field: ConfigField) => {
    const v = rec[field.key];
    if (def.slug === "pay-constants" && field.key === "value") {
      const isFormula = rec.value_type === "formula";
      return (
        <Flex align="center" gap={2}>
          <Text fontSize="sm" fontFamily="mono" fontWeight="semibold">
            {v ?? "—"}
          </Text>
          {isFormula && (
            <Badge
              colorScheme="blue"
              fontSize="10px"
              textTransform="none"
              rounded="full"
              px={2}
            >
              formula
            </Badge>
          )}
        </Flex>
      );
    }
    if (
      def.slug === "pay-component-groups" &&
      field.key === "component_codes"
    ) {
      const codes = normaliseComponentCodes(v);
      return (
        <Badge colorScheme="purple" rounded="full" px={2}>
          {codes.length} {codes.length === 1 ? "rule" : "rules"}
        </Badge>
      );
    }
    // For pay-components, replace the computation_type cell with a richer value display
    if (def.slug === "pay-components" && field.key === "computation_type") {
      const ct = rec.computation_type;
      if (ct === "fixed") {
        return (
          <Flex align="center" gap={2}>
            <Badge colorScheme="green" rounded="full" px={2}>
              Fixed
            </Badge>
            <Text fontSize="sm" fontFamily="mono" fontWeight="semibold">
              ₱
              {Number(rec.amount ?? 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </Flex>
        );
      }
      if (ct === "percentage") {
        return (
          <Flex align="center" gap={2}>
            <Badge colorScheme="orange" rounded="full" px={2}>
              %
            </Badge>
            <Text fontSize="sm" fontFamily="mono" fontWeight="semibold">
              {rec.percentage ?? 0}% of {rec.percentage_of_code || "—"}
            </Text>
          </Flex>
        );
      }
      if (ct === "formula") {
        return (
          <Flex align="center" gap={2} maxW="260px">
            <Badge colorScheme="purple" rounded="full" px={2}>
              Formula
            </Badge>
            <Text
              fontSize="xs"
              fontFamily="mono"
              noOfLines={1}
              color={subText}
              title={rec.formula}
            >
              {rec.formula || "—"}
            </Text>
          </Flex>
        );
      }
      return (
        <Text fontSize="sm" color={subText}>
          {ct || "—"}
        </Text>
      );
    }
    if (field.type === "boolean") {
      return (
        <Badge colorScheme={v ? "green" : "gray"} rounded="full" px={2}>
          {v ? "Yes" : "No"}
        </Badge>
      );
    }
    if (field.type === "select") {
      const opt = field.options?.find((o) => o.value === v);
      return (
        <Text fontSize="sm" textTransform="capitalize">
          {opt?.label ?? v ?? "—"}
        </Text>
      );
    }
    if (!v)
      return (
        <Text fontSize="sm" color={subText}>
          —
        </Text>
      );
    return (
      <Text fontSize="sm" noOfLines={2}>
        {String(v)}
      </Text>
    );
  };

  const renderRow = (rec: any) => [
    ...listFields.map((f) => renderCell(rec, f)),
    <Flex gap={1}>
      <IconButton
        aria-label="Edit"
        icon={<Pencil size={15} />}
        size="sm"
        variant="ghost"
        colorScheme="blue"
        onClick={() => handleOpenEdit(rec)}
      />
      <IconButton
        aria-label="Delete"
        icon={<Trash2 size={15} />}
        size="sm"
        variant="ghost"
        colorScheme="red"
        onClick={() => handleDelete(rec.id)}
      />
    </Flex>,
  ];

  return (
    <Box>
      {returnTo && (
        <Flex
          mb={3}
          p={3}
          rounded="md"
          bg={bannerBg}
          border="1px solid"
          borderColor={bannerBorder}
          align="center"
          justify="space-between"
        >
          <Text fontSize="sm" color={bannerText}>
            You came here from Payroll Rules. Finish your edits and return when
            ready.
          </Text>
          <Button
            size="sm"
            leftIcon={<ArrowLeft size={14} />}
            colorScheme="blue"
            variant="solid"
            onClick={() => navigate(returnTo)}
          >
            Back to Payroll Rules
          </Button>
        </Flex>
      )}

      <Flex justify="space-between" align="center" mb={4}>
        <Box>
          <HStack spacing={2} align="center">
            <Settings size={18} />
            <Heading size="lg" color={textColor}>
              {def.title}
            </Heading>
            {PAGE_INFO[def.slug] && (
              <Tooltip
                label={PAGE_INFO[def.slug]}
                fontSize="xs"
                maxW="320px"
                placement="right"
                hasArrow
              >
                <Box as="span" cursor="help" color={subText}>
                  <Icon as={Info} boxSize={4} />
                </Box>
              </Tooltip>
            )}
          </HStack>
          <Text fontSize="sm" color={subText} mt={1}>
            {def.group} configuration
          </Text>
        </Box>
        <HStack spacing={2}>
          {def.slug === "attendance-shifts" && records.length === 0 && (
            <Button
              colorScheme="teal"
              variant="outline"
              isLoading={seeding}
              onClick={seedAttendanceShifts}
            >
              Seed Default Shifts
            </Button>
          )}
          {def.slug === "pay-constants" && records.length === 0 && (
            <Button
              colorScheme="teal"
              variant="outline"
              isLoading={seeding}
              onClick={seedPayConstants}
            >
              Seed PH Defaults
            </Button>
          )}
          <Button
            leftIcon={<PlusCircle size={18} />}
            colorScheme="blue"
            onClick={handleOpenCreate}
          >
            New {def.singular}
          </Button>
        </HStack>
      </Flex>

      {def.slug === "pay-components" && (
        <Flex
          mb={4}
          p={3}
          rounded="lg"
          bg={linkBannerBg}
          border="1px solid"
          borderColor={linkBannerBorder}
          align="center"
          justify="space-between"
          gap={4}
        >
          <Box flex={1}>
            <Text
              fontSize="sm"
              fontWeight="semibold"
              color={linkBannerText}
              mb={0.5}
            >
              Connected to Pay Templates
            </Text>
            <Text fontSize="xs" color={linkBannerText} opacity={0.85}>
              Payroll Rules define the computation rules for each Pay Template.
              Each employee is assigned a template, and only that template's
              rules run during a pay run. Go to Pay Templates to manage layouts
              and see which components are linked.
            </Text>
          </Box>
          <Button
            size="sm"
            colorScheme="teal"
            variant="solid"
            rightIcon={<ArrowRight size={13} />}
            flexShrink={0}
            onClick={() => navigate("/payroll/config/pay-templates")}
          >
            Pay Templates
          </Button>
        </Flex>
      )}

      <ModuleTabs section={def.section} activeTab="config" />

      <Card p={6}>
        {loading && !records.length ? (
          <Center py={10}>
            <Spinner color="blue.500" />
          </Center>
        ) : (
          <Table
            headers={headers}
            data={records}
            renderRow={renderRow}
            isLoading={loading}
          />
        )}
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${editingId ? "Edit" : "Create"} ${def.singular}`}
        onSubmit={handleSubmit}
        isLoading={loading}
        size={
          def.slug === "pay-components" ||
          def.slug === "pay-constants" ||
          def.slug === "pay-component-groups"
            ? "3xl"
            : "md"
        }
      >
        {def.slug === "pay-components" ? (
          <PayComponentForm
            value={form as PayComponentFormValue}
            onChange={(next) => setForm(next as Record<string, any>)}
          />
        ) : def.slug === "pay-component-groups" ? (
          <PayComponentGroupForm
            value={form as PayComponentGroupFormValue}
            onChange={(next) => setForm(next as unknown as Record<string, any>)}
          />
        ) : def.slug === "pay-constants" ? (
          <PayConstantForm
            value={form as unknown as PayConstantFormValue}
            onChange={(next) => setForm(next as unknown as Record<string, any>)}
          />
        ) : (
          <VStack spacing={4} align="stretch">
            {def.fields.map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={form[f.key]}
                onChange={(v) => handleChange(f.key, v)}
              />
            ))}
          </VStack>
        )}
      </Modal>
    </Box>
  );
};

/* ─── Field input ─────────────────────────────────────── */

const FieldInput = ({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: any;
  onChange: (v: any) => void;
}) => {
  const labelColor = useColorModeValue("gray.700", "gray.300");
  const bg = useColorModeValue("white", "gray.700");
  const border = useColorModeValue("gray.200", "gray.600");

  if (field.type === "boolean") {
    return (
      <FormControl>
        <Checkbox
          isChecked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          colorScheme="blue"
        >
          <Text fontSize="sm" fontWeight="medium" color={labelColor}>
            {field.label}
          </Text>
        </Checkbox>
      </FormControl>
    );
  }

  if (field.type === "textarea") {
    return (
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium" color={labelColor}>
          {field.label}
        </FormLabel>
        <Textarea
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          bg={bg}
          borderColor={border}
          rows={3}
        />
      </FormControl>
    );
  }

  if (field.type === "select") {
    return (
      <FormControl>
        <FormLabel fontSize="sm" fontWeight="medium" color={labelColor}>
          {field.label}
        </FormLabel>
        <Select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          bg={bg}
          borderColor={border}
          placeholder={`Select ${field.label.toLowerCase()}`}
        >
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <Input
      label={field.label}
      placeholder={field.placeholder}
      type={field.type === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
