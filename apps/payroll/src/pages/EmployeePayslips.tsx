import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { Download } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { printPayslip } from "../lib/printPayslip";
import { formatCurrency } from "../lib/payrollEngine";
import {
  type PayComponentGroup,
  type TemplateBlock,
} from "../lib/payTemplateLayout";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

interface EmployeeProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  private_email?: string | null;
  position?: string | null;
  pay_template_id?: number | null;
}

interface EmployeePayslipEntry {
  id: number;
  pay_run_id: number;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  status: string;
  snapshot: {
    lines?: {
      code?: string;
      name: string;
      amount: number;
      category: string;
      sequence?: number;
    }[];
    pay_template_id?: number | null;
  };
  pay_runs?: {
    id: number;
    name?: string | null;
    period_start: string;
    period_end: string;
    paid_at?: string | null;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "gray",
  computed: "blue",
  validated: "green",
  paid: "teal",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Ready to Compute",
  computed: "Computed",
  validated: "Validated",
  paid: "Paid",
};

export const EmployeePayslips = () => {
  const user = useAuthStore((state) => state.user);
  const userCompanies = useAuthStore((state) => state.userCompanies);
  const activeCompanyId = useAuthStore((state) => state.activeCompanyId);
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [entries, setEntries] = useState<EmployeePayslipEntry[]>([]);
  const [downloadId, setDownloadId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headingColor = useColorModeValue("gray.800", "white");
  const subtleColor = useColorModeValue("gray.500", "gray.300");

  const activeCompany = useMemo(
    () =>
      userCompanies.find((company) => company.id === activeCompanyId) ?? null,
    [activeCompanyId, userCompanies],
  );

  useEffect(() => {
    const loadPayslips = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let employeeRecord: EmployeeProfile | null = null;

        const { data: workEmailMatch, error: workEmailError } = await supabase
          .from("employees")
          .select(
            "id, first_name, last_name, email, private_email, position, pay_template_id",
          )
          .eq("email", user.email)
          .maybeSingle();

        if (workEmailError) {
          throw workEmailError;
        }

        employeeRecord = (workEmailMatch as EmployeeProfile | null) ?? null;

        if (!employeeRecord) {
          const { data: privateEmailMatch, error: privateEmailError } =
            await supabase
              .from("employees")
              .select(
                "id, first_name, last_name, email, private_email, position, pay_template_id",
              )
              .eq("private_email", user.email)
              .maybeSingle();

          if (privateEmailError) {
            throw privateEmailError;
          }

          employeeRecord =
            (privateEmailMatch as EmployeeProfile | null) ?? null;
        }

        setEmployee(employeeRecord);

        if (!employeeRecord) {
          setEntries([]);
          setError("No employee record is linked to this login yet.");
          return;
        }

        const { data: entryRows, error: entryError } = await supabase
          .from("payroll_entries")
          .select(
            "id, pay_run_id, gross_pay, total_deductions, net_pay, status, snapshot, pay_runs(id, name, period_start, period_end, paid_at)",
          )
          .eq("employee_id", employeeRecord.id)
          .order("pay_run_id", { ascending: false });

        if (entryError) {
          throw entryError;
        }

        setEntries((entryRows as EmployeePayslipEntry[] | null) ?? []);
      } catch (loadError: any) {
        setError(loadError.message || "Unable to load your payslips.");
      } finally {
        setLoading(false);
      }
    };

    void loadPayslips();
  }, [user?.email]);

  const totalNetPay = entries.reduce(
    (sum, entry) => sum + Number(entry.net_pay || 0),
    0,
  );

  const handleDownloadPayslip = async (entry: EmployeePayslipEntry) => {
    if (!employee) return;

    setDownloadId(entry.id);
    try {
      const templateId =
        entry.snapshot?.pay_template_id ?? employee.pay_template_id ?? null;

      const templateRequest = templateId
        ? supabase
            .from("pay_templates")
            .select("layout_json")
            .eq("id", templateId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [templateResult, groupResult] = await Promise.allSettled([
        templateRequest,
        supabase
          .from("pay_component_groups")
          .select(
            "id, name, code, category, component_codes, description, active",
          )
          .eq("active", true)
          .order("name", { ascending: true }),
      ]);

      const layoutBlocks =
        templateResult.status === "fulfilled" && !templateResult.value.error
          ? ((templateResult.value.data?.layout_json as
              | TemplateBlock[]
              | null) ?? null)
          : null;

      const componentGroups =
        groupResult.status === "fulfilled" && !groupResult.value.error
          ? ((groupResult.value.data as PayComponentGroup[] | null) ?? [])
          : [];

      printPayslip({
        companyName: activeCompany?.name || "Payroll",
        employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
        employeePosition: employee.position || undefined,
        employeeId: employee.id,
        periodStart: entry.pay_runs?.period_start || "",
        periodEnd: entry.pay_runs?.period_end || "",
        lines: entry.snapshot?.lines || [],
        grossPay: entry.gross_pay,
        totalDeductions: entry.total_deductions,
        netPay: entry.net_pay,
        payRunName:
          entry.pay_runs?.name ||
          `Pay Run #${entry.pay_runs?.id ?? entry.pay_run_id}`,
        paidDate: entry.pay_runs?.paid_at || null,
        layoutBlocks,
        componentGroups,
      });
    } catch (downloadError: any) {
      toast({
        title: "Failed to open payslip",
        description:
          downloadError.message ||
          "Unable to prepare your payslip for download.",
        status: "error",
      });
    } finally {
      setDownloadId(null);
    }
  };

  const headers = [
    "Pay Run",
    "Period",
    "Status",
    "Gross Pay",
    "Deductions",
    "Net Pay",
    "Actions",
  ];

  const renderRow = (entry: EmployeePayslipEntry) => [
    <Box>
      <Text fontWeight="semibold">
        {entry.pay_runs?.name ||
          `Pay Run #${entry.pay_runs?.id ?? entry.pay_run_id}`}
      </Text>
      <Text fontSize="xs" color={subtleColor}>
        Reference #{entry.id}
      </Text>
    </Box>,
    <Text fontSize="sm">
      {entry.pay_runs?.period_start
        ? `${new Date(entry.pay_runs.period_start).toLocaleDateString()} - ${new Date(entry.pay_runs.period_end).toLocaleDateString()}`
        : "-"}
    </Text>,
    <Badge
      colorScheme={STATUS_COLORS[entry.status] || "gray"}
      rounded="full"
      px={3}
    >
      {STATUS_LABELS[entry.status] || entry.status}
    </Badge>,
    <Text>{formatCurrency(entry.gross_pay)}</Text>,
    <Text color="red.500">-{formatCurrency(entry.total_deductions)}</Text>,
    <Text fontWeight="semibold">{formatCurrency(entry.net_pay)}</Text>,
    <Button
      size="sm"
      variant="outline"
      colorScheme="blue"
      leftIcon={<Download size={14} />}
      onClick={() => void handleDownloadPayslip(entry)}
      isLoading={downloadId === entry.id}
    >
      Download PDF
    </Button>,
  ];

  return (
    <Box>
      <Flex
        justify="space-between"
        align={{ base: "start", md: "center" }}
        mb={6}
        gap={4}
      >
        <Box>
          <Heading size="lg" color={headingColor}>
            My Payslips
          </Heading>
          <Text color={subtleColor} mt={1}>
            View your payroll history and download official payslips.
          </Text>
        </Box>
      </Flex>

      {error && (
        <Alert status="warning" rounded="md" mb={6}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      <Grid
        templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
        gap={4}
        mb={6}
      >
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Employee</StatLabel>
            <StatNumber fontSize="xl">
              {employee ? `${employee.first_name} ${employee.last_name}` : "-"}
            </StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Payslips</StatLabel>
            <StatNumber>{entries.length}</StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Total Net Paid</StatLabel>
            <StatNumber fontSize="xl" color="teal.600">
              {formatCurrency(totalNetPay)}
            </StatNumber>
          </Stat>
        </Card>
      </Grid>

      <Card p={6}>
        {loading ? (
          <Flex justify="center" py={16}>
            <Spinner />
          </Flex>
        ) : (
          <Table
            headers={headers}
            data={entries}
            renderRow={renderRow}
            emptyMessage="No payslips are available for your account yet."
          />
        )}
      </Card>
    </Box>
  );
};
