import { useEffect, useState } from "react";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  HStack,
  VStack,
  Grid,
  Stat,
  StatLabel,
  StatNumber,
  Divider,
  useToast,
  useDisclosure,
  Spinner,
  Alert,
  AlertIcon,
  Input,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  ChevronRight,
  Play,
  CheckCircle,
  DollarSign,
  Eye,
  ArrowLeft,
  Printer,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import {
  usePayRunStore,
  type PayRun,
  type PayrollEntry,
  type PayRunStatus,
} from "../store/payRunStore";
import { formatCurrency } from "../lib/payrollEngine";
import { printPayslip } from "../lib/printPayslip";
import { supabase } from "../lib/supabase";
import {
  type PayComponentGroup,
  type TemplateBlock,
} from "../lib/payTemplateLayout";

const STATUS_COLORS: Record<PayRunStatus, string> = {
  draft: "gray",
  computed: "blue",
  validated: "green",
  paid: "teal",
};

const STATUS_LABELS: Record<PayRunStatus, string> = {
  draft: "Ready to Compute",
  computed: "Computed",
  validated: "Validated",
  paid: "Paid",
};

const DEFAULT_WORKING_DAYS_PER_MONTH = 22;
const DEFAULT_TARDINESS_RATE_FACTOR = 1.25 / 8 / 60;

interface TardinessInputEmployee {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  base_pay: number | null;
  pay_template_id: number | null;
}

export const PayRunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const runId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const {
    payRuns,
    entries,
    loading,
    fetchPayRuns,
    fetchEntries,
    computePayRun,
    deletePayRun,
    validatePayRun,
    markPayRunPaid,
  } = usePayRunStore();

  const payRun: PayRun | undefined = payRuns.find((p) => p.id === runId);
  const runEntries: PayrollEntry[] = entries[runId] || [];

  const [viewEntry, setViewEntry] = useState<PayrollEntry | null>(null);
  const [inputEmployees, setInputEmployees] = useState<
    TardinessInputEmployee[]
  >([]);
  const [tardinessMinutes, setTardinessMinutes] = useState<
    Record<number, string>
  >({});
  const [workingDaysPerMonth, setWorkingDaysPerMonth] = useState(
    DEFAULT_WORKING_DAYS_PER_MONTH,
  );
  const [tardinessRateFactor, setTardinessRateFactor] = useState(
    DEFAULT_TARDINESS_RATE_FACTOR,
  );
  const [loadingTardiness, setLoadingTardiness] = useState(false);
  const [savingTardiness, setSavingTardiness] = useState(false);
  const {
    isOpen: isSlipOpen,
    onOpen: onSlipOpen,
    onClose: onSlipClose,
  } = useDisclosure();
  const headingColor = useColorModeValue("gray.800", "white");
  const textColor = useColorModeValue("gray.700", "gray.100");
  const subtleColor = useColorModeValue("gray.500", "gray.300");
  const emptyColor = useColorModeValue("gray.500", "gray.400");
  const summaryBg = useColorModeValue("gray.50", "gray.700");

  useEffect(() => {
    if (!payRuns.length) fetchPayRuns();
    if (runId) fetchEntries(runId);
  }, [runId]);

  useEffect(() => {
    const loadTardinessInputs = async () => {
      if (!payRun) return;

      setLoadingTardiness(true);
      try {
        if (!payRun.employee_id && !payRun.pay_group_id) {
          setInputEmployees([]);
          setTardinessMinutes({});
          return;
        }

        let employeeQuery = supabase
          .from("employees")
          .select(
            "id, first_name, last_name, position, base_pay, pay_template_id",
          );

        if (payRun.employee_id) {
          employeeQuery = employeeQuery.eq("id", payRun.employee_id);
        } else if (payRun.pay_group_id) {
          employeeQuery = employeeQuery.eq("pay_group_id", payRun.pay_group_id);
        }

        const [employeeResult, inputResult, constantResult] = await Promise.all(
          [
            employeeQuery.order("last_name", { ascending: true }),
            supabase
              .from("payroll_inputs")
              .select("employee_id, amount")
              .eq("pay_run_id", runId)
              .eq("code", "TARDINESS_MINUTES"),
            supabase
              .from("pay_constants")
              .select("code, value")
              .in("code", [
                "WORKING_DAYS_PER_MONTH",
                "TARDINESS_RATE_FACTOR",
                "OT_REGULAR_DAY_MULTIPLIER",
                "REGULAR_WORK_HOURS_PER_DAY",
              ])
              .eq("active", true),
          ],
        );

        if (employeeResult.error) throw employeeResult.error;
        if (inputResult.error) throw inputResult.error;
        if (constantResult.error) throw constantResult.error;

        const employees =
          (employeeResult.data as TardinessInputEmployee[] | null) || [];
        const inputMap = (inputResult.data || []).reduce<
          Record<number, string>
        >((acc, row: any) => {
          acc[Number(row.employee_id)] = String(Number(row.amount) || 0);
          return acc;
        }, {});
        const constantMap = (constantResult.data || []).reduce<
          Record<string, number>
        >((acc, row: any) => {
          const numericValue = Number(row.value);
          if (row.code && Number.isFinite(numericValue)) {
            acc[row.code] = numericValue;
          }
          return acc;
        }, {});
        const workHoursPerDay = constantMap.REGULAR_WORK_HOURS_PER_DAY || 8;

        setInputEmployees(employees);
        setTardinessMinutes(inputMap);
        setWorkingDaysPerMonth(
          constantMap.WORKING_DAYS_PER_MONTH || DEFAULT_WORKING_DAYS_PER_MONTH,
        );
        setTardinessRateFactor(
          constantMap.TARDINESS_RATE_FACTOR ||
            (constantMap.OT_REGULAR_DAY_MULTIPLIER || 1.25) /
              workHoursPerDay /
              60,
        );
      } catch (error: any) {
        toast({
          title: "Failed to load tardiness inputs",
          description:
            error.message || "Unable to load pay run tardiness data.",
          status: "error",
        });
      } finally {
        setLoadingTardiness(false);
      }
    };

    void loadTardinessInputs();
  }, [payRun, runId, toast]);

  const hasAssignedScope = Boolean(payRun?.employee_id || payRun?.pay_group_id);
  const hasNoSourceEmployees =
    hasAssignedScope && !loadingTardiness && inputEmployees.length === 0;
  const isEmptyInvalidRun =
    !hasAssignedScope && runEntries.length === 0 && payRun?.status === "draft";

  const locked = payRun?.status === "validated" || payRun?.status === "paid";

  const totalGross = runEntries.reduce(
    (s, e) => s + Number(e.gross_pay || 0),
    0,
  );
  const totalDeductions = runEntries.reduce(
    (s, e) => s + Number(e.total_deductions || 0),
    0,
  );
  const totalNet = runEntries.reduce((s, e) => s + Number(e.net_pay || 0), 0);
  const totalTardinessMinutes = inputEmployees.reduce(
    (sum, employee) => sum + (Number(tardinessMinutes[employee.id] || 0) || 0),
    0,
  );
  const totalTardinessAmount = inputEmployees.reduce((sum, employee) => {
    const basePay = Number(employee.base_pay) || 0;
    const dailyRate =
      workingDaysPerMonth > 0 ? basePay / workingDaysPerMonth : 0;
    const minutes = Number(tardinessMinutes[employee.id] || 0) || 0;
    return sum + dailyRate * tardinessRateFactor * minutes;
  }, 0);

  const openSlip = (entry: PayrollEntry) => {
    setViewEntry(entry);
    onSlipOpen();
  };

  const handlePrintPayslip = async (entry: PayrollEntry) => {
    const templateId =
      entry.snapshot?.pay_template_id ??
      entry.employees?.pay_template_id ??
      null;

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
        ? ((templateResult.value.data?.layout_json as TemplateBlock[] | null) ??
          null)
        : null;

    const componentGroups =
      groupResult.status === "fulfilled" && !groupResult.value.error
        ? ((groupResult.value.data as PayComponentGroup[] | null) ?? [])
        : [];

    printPayslip({
      companyName:
        (payRun?.pay_groups as any)?.companies?.name ||
        (payRun as any)?.company?.name,
      employeeName:
        `${entry.employees?.first_name ?? ""} ${entry.employees?.last_name ?? ""}`.trim(),
      employeePosition: entry.employees?.position,
      employeeId: (entry as any).employee_id ?? entry.employees?.id,
      periodStart: payRun?.period_start || "",
      periodEnd: payRun?.period_end || "",
      lines: entry.snapshot?.lines || [],
      grossPay: entry.gross_pay,
      totalDeductions: entry.total_deductions,
      netPay: entry.net_pay,
      payRunName: payRun?.name || `Pay Run #${payRun?.id}`,
      paidDate: (payRun as any)?.paid_date,
      layoutBlocks,
      componentGroups,
    });
  };

  const persistTardinessInputs = async () => {
    setSavingTardiness(true);
    try {
      const { error: deleteError } = await supabase
        .from("payroll_inputs")
        .delete()
        .eq("pay_run_id", runId)
        .eq("code", "TARDINESS_MINUTES");

      if (deleteError) throw deleteError;

      const rows = inputEmployees
        .map((employee) => ({
          pay_run_id: runId,
          employee_id: employee.id,
          code: "TARDINESS_MINUTES",
          amount: Number(tardinessMinutes[employee.id] || 0),
          note: "Tardiness minutes for this pay run",
        }))
        .filter((row) => row.amount > 0);

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from("payroll_inputs")
          .insert(rows);
        if (insertError) throw insertError;
      }

      return true;
    } catch (error: any) {
      toast({
        title: "Failed to save tardiness minutes",
        description:
          error.message || "Unable to save tardiness inputs for this pay run.",
        status: "error",
      });
      return false;
    } finally {
      setSavingTardiness(false);
    }
  };

  const handleCompute = async () => {
    if (!hasAssignedScope) {
      toast({
        title: "This pay run has no employee scope",
        description:
          "Delete it and create a pay run for a pay group or employee with records.",
        status: "error",
      });
      return;
    }
    if (hasNoSourceEmployees) {
      toast({
        title: "No employees found for this pay run",
        description:
          "Assign employees to the selected pay group or recreate the run with a valid employee scope.",
        status: "error",
      });
      return;
    }
    const saved = await persistTardinessInputs();
    if (!saved) return;
    await computePayRun(runId);
    toast({ title: "Payroll computed", status: "success" });
  };

  const handleDeleteInvalidRun = async () => {
    try {
      await deletePayRun(runId);
      toast({ title: "Empty pay run deleted", status: "success" });
      navigate("/payroll");
    } catch (error: any) {
      toast({
        title: "Failed to delete pay run",
        description: error.message || "Unable to delete the empty pay run.",
        status: "error",
      });
    }
  };

  const handleValidate = async () => {
    await validatePayRun(runId);
    toast({ title: "Pay run validated", status: "success" });
  };

  const handlePay = async () => {
    const today = new Date().toISOString().slice(0, 10);
    await markPayRunPaid(runId, today);
    toast({ title: "Pay run marked as paid", status: "success" });
  };

  if (!payRun && loading) {
    return (
      <Flex justify="center" py={20}>
        <Spinner />
      </Flex>
    );
  }

  if (!payRun) {
    return (
      <Alert status="error" rounded="md">
        <AlertIcon />
        Pay run not found.
      </Alert>
    );
  }

  const headers = [
    "Employee",
    "Position",
    "Gross Pay",
    "Deductions",
    "Net Pay",
    "Status",
    "Actions",
  ];
  const renderRow = (e: PayrollEntry) => [
    <Text fontWeight="medium">
      {e.employees?.first_name} {e.employees?.last_name}
    </Text>,
    <Text fontSize="sm" color="gray.600">
      {e.employees?.position || "—"}
    </Text>,
    <Text>{formatCurrency(e.gross_pay)}</Text>,
    <Text color="red.500">-{formatCurrency(e.total_deductions)}</Text>,
    <Text fontWeight="semibold">{formatCurrency(e.net_pay)}</Text>,
    <Badge
      colorScheme={
        e.status === "paid"
          ? "teal"
          : e.status === "validated"
            ? "green"
            : "blue"
      }
      rounded="full"
      px={2}
    >
      {e.status}
    </Badge>,
    <Button
      size="xs"
      variant="ghost"
      leftIcon={<Eye size={14} />}
      onClick={() => openSlip(e)}
    >
      Payslip
    </Button>,
  ];

  return (
    <Box>
      <Breadcrumb
        separator={<ChevronRight size={14} color="#A0AEC0" />}
        mb={4}
        fontSize="sm"
      >
        <BreadcrumbItem>
          <BreadcrumbLink as={RouterLink} to="/payroll" color="gray.500">
            Payroll
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbItem isCurrentPage>
          <BreadcrumbLink color={textColor}>
            {payRun.name || `Pay Run #${payRun.id}`}
          </BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>

      <Flex justify="space-between" align="start" mb={6}>
        <Box>
          <HStack mb={1}>
            <Button
              size="xs"
              variant="ghost"
              leftIcon={<ArrowLeft size={14} />}
              onClick={() => navigate("/payroll")}
            >
              Back
            </Button>
            <Badge
              colorScheme={STATUS_COLORS[payRun.status]}
              rounded="full"
              px={3}
              textTransform="capitalize"
            >
              {STATUS_LABELS[payRun.status]}
            </Badge>
            <Badge
              variant="outline"
              rounded="full"
              px={3}
              textTransform="capitalize"
            >
              {payRun.run_type.replace("_", " ")}
            </Badge>
          </HStack>
          <Heading size="lg" color={headingColor}>
            {payRun.name || `Pay Run #${payRun.id}`}
          </Heading>
          <Text color={subtleColor} fontSize="sm" mt={1}>
            {new Date(payRun.period_start).toLocaleDateString()} –{" "}
            {new Date(payRun.period_end).toLocaleDateString()}
            {payRun.pay_groups?.name
              ? ` · ${payRun.pay_groups.name}`
              : " · All employees"}
          </Text>
        </Box>
        <HStack>
          {!locked && (
            <Button
              leftIcon={<Play size={14} />}
              colorScheme="blue"
              onClick={handleCompute}
              isDisabled={isEmptyInvalidRun || hasNoSourceEmployees}
              isLoading={loading || savingTardiness}
            >
              {payRun.status === "draft" ? "Compute" : "Recompute"}
            </Button>
          )}
          {payRun.status === "computed" && (
            <Button
              leftIcon={<CheckCircle size={14} />}
              colorScheme="green"
              onClick={handleValidate}
            >
              Validate
            </Button>
          )}
          {payRun.status === "validated" && (
            <Button
              leftIcon={<DollarSign size={14} />}
              colorScheme="teal"
              onClick={handlePay}
            >
              Mark as Paid
            </Button>
          )}
        </HStack>
      </Flex>

      {(isEmptyInvalidRun || hasNoSourceEmployees) && (
        <Alert status="warning" rounded="md" mb={6}>
          <AlertIcon />
          <Box flex="1">
            <Text fontWeight="semibold" color={textColor}>
              This pay run is empty and cannot be processed.
            </Text>
            <Text fontSize="sm" color={subtleColor}>
              {isEmptyInvalidRun
                ? "It was created without an employee or pay group."
                : "No employees matched the selected pay group for this run."}
            </Text>
          </Box>
          <Button
            size="sm"
            colorScheme="red"
            variant="outline"
            onClick={handleDeleteInvalidRun}
          >
            Delete Empty Run
          </Button>
        </Alert>
      )}

      <Grid templateColumns="repeat(4, 1fr)" gap={4} mb={6}>
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Employees</StatLabel>
            <StatNumber>{runEntries.length}</StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Total Gross</StatLabel>
            <StatNumber color="green.600" fontSize="xl">
              {formatCurrency(totalGross)}
            </StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Total Deductions</StatLabel>
            <StatNumber color="red.500" fontSize="xl">
              {formatCurrency(totalDeductions)}
            </StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color={subtleColor}>Total Net</StatLabel>
            <StatNumber color="teal.600" fontSize="xl">
              {formatCurrency(totalNet)}
            </StatNumber>
          </Stat>
        </Card>
      </Grid>

      <Card p={6} mb={6}>
        <Flex
          justify="space-between"
          align={{ base: "start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap={4}
          mb={4}
        >
          <Box>
            <Heading size="md" color={headingColor}>
              Tardiness Inputs
            </Heading>
            <Text color={subtleColor} fontSize="sm" mt={1}>
              Enter late minutes for this pay period. The deduction preview uses
              Daily Rate x Tardiness Rate Factor x Minutes.
            </Text>
            <Text color={subtleColor} fontSize="xs" mt={1}>
              Tardiness rate factor: {tardinessRateFactor.toFixed(6)} · Working
              days/month: {workingDaysPerMonth}
            </Text>
          </Box>
          <HStack>
            <Badge colorScheme="orange" rounded="full" px={3}>
              {totalTardinessMinutes} min
            </Badge>
            <Badge colorScheme="red" rounded="full" px={3}>
              {formatCurrency(totalTardinessAmount)} est. deduction
            </Badge>
            {!locked && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="blue"
                onClick={persistTardinessInputs}
                isLoading={savingTardiness}
              >
                Save Tardiness
              </Button>
            )}
          </HStack>
        </Flex>

        {loadingTardiness ? (
          <Flex justify="center" py={10}>
            <Spinner />
          </Flex>
        ) : inputEmployees.length === 0 ? (
          <VStack py={10} spacing={2} color={emptyColor}>
            <Text fontWeight="semibold">
              No employees available for tardiness input
            </Text>
            <Text fontSize="sm">
              Assign an employee or pay group to this pay run first.
            </Text>
          </VStack>
        ) : (
          <Table
            headers={[
              "Employee",
              "Base Pay",
              "Daily Rate",
              "Late Min",
              "Rate/Min",
              "Deduction Preview",
            ]}
            data={inputEmployees}
            renderRow={(employee: TardinessInputEmployee) => {
              const basePay = Number(employee.base_pay) || 0;
              const dailyRate =
                workingDaysPerMonth > 0 ? basePay / workingDaysPerMonth : 0;
              const minutes = Number(tardinessMinutes[employee.id] || 0) || 0;
              const ratePerMinute = dailyRate * tardinessRateFactor;
              const deduction = ratePerMinute * minutes;

              return [
                <Box>
                  <Text fontWeight="medium">
                    {employee.first_name} {employee.last_name}
                  </Text>
                  <Text fontSize="sm" color={subtleColor}>
                    {employee.position || "—"}
                  </Text>
                </Box>,
                <Text>{formatCurrency(basePay)}</Text>,
                <Text>{formatCurrency(dailyRate)}</Text>,
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={tardinessMinutes[employee.id] ?? ""}
                  onChange={(event) =>
                    setTardinessMinutes((current) => ({
                      ...current,
                      [employee.id]: event.target.value,
                    }))
                  }
                  isDisabled={locked}
                  maxW="120px"
                />,
                <Text>{formatCurrency(ratePerMinute)}</Text>,
                <Text color={deduction > 0 ? "red.500" : subtleColor}>
                  {deduction > 0 ? `-${formatCurrency(deduction)}` : "—"}
                </Text>,
              ];
            }}
          />
        )}
      </Card>

      <Card p={6}>
        {runEntries.length === 0 ? (
          <VStack py={16} spacing={3} color={emptyColor}>
            <Text fontWeight="semibold">No payroll entries yet</Text>
            <Text fontSize="sm">
              Click "Compute" to generate entries for every employee in this pay
              run.
            </Text>
          </VStack>
        ) : (
          <Table headers={headers} data={runEntries} renderRow={renderRow} />
        )}
      </Card>

      <Modal
        isOpen={isSlipOpen}
        onClose={onSlipClose}
        title="Payslip"
        size="lg"
      >
        {viewEntry && (
          <VStack spacing={4} align="stretch">
            <Flex justify="flex-end">
              <Button
                size="sm"
                leftIcon={<Printer size={14} />}
                colorScheme="blue"
                variant="outline"
                onClick={() => void handlePrintPayslip(viewEntry)}
              >
                Print / Save PDF
              </Button>
            </Flex>
            <Flex justify="space-between">
              <Box>
                <Text fontWeight="bold" fontSize="lg">
                  {viewEntry.employees?.first_name}{" "}
                  {viewEntry.employees?.last_name}
                </Text>
                <Text fontSize="sm" color={subtleColor}>
                  {viewEntry.employees?.position}
                </Text>
              </Box>
              <Box textAlign="right">
                <Text fontSize="xs" color={subtleColor}>
                  Period
                </Text>
                <Text fontSize="sm">
                  {new Date(payRun.period_start).toLocaleDateString()} –{" "}
                  {new Date(payRun.period_end).toLocaleDateString()}
                </Text>
              </Box>
            </Flex>
            <Divider />
            <Box>
              <Text
                fontSize="sm"
                fontWeight="semibold"
                color="green.700"
                mb={2}
              >
                Earnings
              </Text>
              <VStack align="stretch" spacing={1}>
                {viewEntry.snapshot.lines
                  .filter((l: any) => l.category === "earning")
                  .map((l: any) => (
                    <Flex key={l.code} justify="space-between" fontSize="sm">
                      <Text color={textColor}>{l.name}</Text>
                      <Text fontFamily="mono">{formatCurrency(l.amount)}</Text>
                    </Flex>
                  ))}
                {viewEntry.snapshot.lines.filter(
                  (l: any) => l.category === "earning",
                ).length === 0 && (
                  <Text fontSize="sm" color={emptyColor}>
                    No earnings.
                  </Text>
                )}
              </VStack>
            </Box>
            <Box>
              <Text fontSize="sm" fontWeight="semibold" color="red.700" mb={2}>
                Deductions
              </Text>
              <VStack align="stretch" spacing={1}>
                {viewEntry.snapshot.lines
                  .filter((l: any) => l.category === "deduction")
                  .map((l: any) => (
                    <Flex key={l.code} justify="space-between" fontSize="sm">
                      <Text color={textColor}>{l.name}</Text>
                      <Text fontFamily="mono" color="red.500">
                        -{formatCurrency(l.amount)}
                      </Text>
                    </Flex>
                  ))}
                {viewEntry.snapshot.lines.filter(
                  (l: any) => l.category === "deduction",
                ).length === 0 && (
                  <Text fontSize="sm" color={emptyColor}>
                    No deductions.
                  </Text>
                )}
              </VStack>
            </Box>
            <Divider />
            <Flex justify="space-between" fontSize="sm">
              <Text color={subtleColor}>Gross Pay</Text>
              <Text fontFamily="mono">
                {formatCurrency(viewEntry.gross_pay)}
              </Text>
            </Flex>
            <Flex justify="space-between" fontSize="sm">
              <Text color={subtleColor}>Total Deductions</Text>
              <Text fontFamily="mono" color="red.500">
                -{formatCurrency(viewEntry.total_deductions)}
              </Text>
            </Flex>
            <Flex
              justify="space-between"
              fontWeight="bold"
              fontSize="lg"
              bg={summaryBg}
              p={3}
              rounded="md"
            >
              <Text>Net Pay</Text>
              <Text color="teal.600">{formatCurrency(viewEntry.net_pay)}</Text>
            </Flex>
          </VStack>
        )}
      </Modal>
    </Box>
  );
};
