import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  useColorModeValue,
  Text,
  Badge,
  Input,
  Select,
  FormControl,
  FormLabel,
  VStack,
  HStack,
  useDisclosure,
  useToast,
  Alert,
  AlertIcon,
  Grid,
  Stat,
  StatLabel,
  StatNumber,
  Textarea,
  Tooltip,
} from "@chakra-ui/react";
import {
  BookOpen,
  CheckCircle,
  DollarSign,
  Trash2,
  Eye,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import hotToast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Modal } from "../components/ui/Modal";
import { ModuleTabs } from "../components/layout/ModuleTabs";
import {
  PAYROLL_TUTORIAL_STORAGE_KEY,
  PayrollModuleTutorial,
} from "../components/payroll/PayrollModuleTutorial";
import { usePayRunStore, type PayRunStatus } from "../store/payRunStore";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/payrollEngine";
import { useCompanyContext } from "../hooks/useCompanyContext";

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

interface PayGroup {
  id: number;
  name: string;
  description: string | null;
  pay_schedule: string | null;
  wage_type: string | null;
}

interface EmployeeLite {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  pay_group_id: number | null;
}

type RunScope = "group" | "individual";

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfWeek = (date: Date) => {
  const next = new Date(date);
  const mondayOffset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - mondayOffset);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfWeek = (date: Date) => {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return next;
};

const normaliseSchedule = (schedule?: string | null) => {
  return (schedule || "monthly")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
};

const getScheduleLabel = (schedule?: string | null) => {
  switch (normaliseSchedule(schedule)) {
    case "weekly":
      return "Weekly";
    case "bi_weekly":
      return "Bi-weekly";
    case "semi_monthly":
      return "Semi-monthly";
    case "monthly":
    default:
      return "Monthly";
  }
};

const getPeriodRangeForSchedule = (schedule?: string | null) => {
  const today = new Date();
  const normalized = normaliseSchedule(schedule);

  if (normalized === "weekly") {
    return {
      start: formatDateInput(startOfWeek(today)),
      end: formatDateInput(endOfWeek(today)),
    };
  }

  if (normalized === "bi_weekly") {
    const currentWeekStart = startOfWeek(today);
    const yearAnchor = startOfWeek(new Date(today.getFullYear(), 0, 1));
    const diffDays = Math.floor(
      (currentWeekStart.getTime() - yearAnchor.getTime()) / 86400000,
    );
    const cycleOffset = Math.floor(diffDays / 14) * 14;
    const cycleStart = new Date(yearAnchor);
    cycleStart.setDate(yearAnchor.getDate() + cycleOffset);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + 13);
    return {
      start: formatDateInput(cycleStart),
      end: formatDateInput(cycleEnd),
    };
  }

  if (normalized === "semi_monthly") {
    const currentDay = today.getDate();
    const year = today.getFullYear();
    const month = today.getMonth();

    if (currentDay <= 15) {
      return {
        start: formatDateInput(new Date(year, month, 1)),
        end: formatDateInput(new Date(year, month, 15)),
      };
    }

    return {
      start: formatDateInput(new Date(year, month, 16)),
      end: formatDateInput(new Date(year, month + 1, 0)),
    };
  }

  return {
    start: formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: formatDateInput(
      new Date(today.getFullYear(), today.getMonth() + 1, 0),
    ),
  };
};

const formatRangePreview = (start?: string, end?: string) => {
  if (!start || !end) return "";
  return `${new Date(start).toLocaleDateString()} - ${new Date(end).toLocaleDateString()}`;
};

export const PayRuns = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const headingColor = useColorModeValue("gray.800", "white");
  const { activeCompanyId } = useCompanyContext();
  const {
    payRuns,
    loading,
    error,
    fetchPayRuns,
    createPayRun,
    deletePayRun,
    validatePayRun,
    markPayRunPaid,
  } = usePayRunStore();
  const {
    isOpen: isCreateOpen,
    onOpen: onCreateOpen,
    onClose: onCreateClose,
  } = useDisclosure();
  const {
    isOpen: isPayOpen,
    onOpen: onPayOpen,
    onClose: onPayClose,
  } = useDisclosure();
  const {
    isOpen: isTutorialOpen,
    onOpen: onTutorialOpen,
    onClose: onTutorialClose,
  } = useDisclosure();

  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [scope, setScope] = useState<RunScope>("group");
  const [form, setForm] = useState({
    name: "",
    period_start: "",
    period_end: "",
    run_type: "regular" as "regular" | "off_cycle",
    pay_group_id: "" as string | number,
    employee_id: "" as string | number,
    notes: "",
  });
  const [payingRunId, setPayingRunId] = useState<number | null>(null);
  const [paidOn, setPaidOn] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const isScheduledGroupRun = scope === "group" && form.run_type === "regular";

  const loadPayrollReferences = useCallback(async () => {
    if (!activeCompanyId) {
      setPayGroups([]);
      setEmployees([]);
      return;
    }

    const [groupResult, employeeResult] = await Promise.all([
      supabase
        .from("pay_groups")
        .select("id,name,description,pay_schedule,wage_type")
        .eq("active", true)
        .eq("company_id", activeCompanyId)
        .order("name"),
      supabase
        .from("employees")
        .select("id,first_name,last_name,position,pay_group_id")
        .eq("company_id", activeCompanyId)
        .order("first_name"),
    ]);

    if (groupResult.data) setPayGroups(groupResult.data as PayGroup[]);
    if (employeeResult.data)
      setEmployees(employeeResult.data as EmployeeLite[]);
  }, [activeCompanyId]);

  useEffect(() => {
    void fetchPayRuns();
    void loadPayrollReferences();
  }, [activeCompanyId, fetchPayRuns, loadPayrollReferences]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(PAYROLL_TUTORIAL_STORAGE_KEY)) {
      onTutorialOpen();
    }
  }, [onTutorialOpen]);

  const markTutorialSeen = () => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      PAYROLL_TUTORIAL_STORAGE_KEY,
      new Date().toISOString(),
    );
  };

  const handleSkipTutorial = () => {
    markTutorialSeen();
    onTutorialClose();
  };

  const handleCompleteTutorial = () => {
    markTutorialSeen();
    onTutorialClose();
  };

  const employeeCountByGroup = useMemo(() => {
    return employees.reduce<Record<number, number>>((accumulator, employee) => {
      if (employee.pay_group_id) {
        accumulator[employee.pay_group_id] =
          (accumulator[employee.pay_group_id] || 0) + 1;
      }
      return accumulator;
    }, {});
  }, [employees]);

  const selectedPayGroup = useMemo(() => {
    return (
      payGroups.find((group) => group.id === Number(form.pay_group_id)) || null
    );
  }, [form.pay_group_id, payGroups]);

  useEffect(() => {
    if (scope !== "group") return;
    if (form.pay_group_id || !payGroups.length) return;

    setForm((current) => ({
      ...current,
      pay_group_id: String(payGroups[0].id),
    }));
  }, [form.pay_group_id, payGroups, scope]);

  useEffect(() => {
    if (scope !== "individual") return;
    if (form.run_type === "off_cycle") return;

    setForm((current) => ({
      ...current,
      run_type: "off_cycle",
    }));
  }, [form.run_type, scope]);

  useEffect(() => {
    if (!isScheduledGroupRun || !selectedPayGroup) return;

    const nextRange = getPeriodRangeForSchedule(selectedPayGroup.pay_schedule);

    setForm((current) => {
      if (
        current.period_start === nextRange.start &&
        current.period_end === nextRange.end
      ) {
        return current;
      }

      return {
        ...current,
        period_start: nextRange.start,
        period_end: nextRange.end,
      };
    });
  }, [isScheduledGroupRun, selectedPayGroup]);

  const handleCreate = async () => {
    if (!form.period_start || !form.period_end) {
      toast({ title: "Period is required", status: "error" });
      return;
    }
          {!activeCompanyId && (
            <Card p={6} mb={4}>
              <Text color="gray.500">
                Select a company from the sidebar to view payroll runs.
              </Text>
            </Card>
          )}

    if (
      scope === "group" &&
      form.run_type === "regular" &&
      !form.pay_group_id
    ) {
      toast({
        title: "Select a pay group for scheduled payroll",
        description:
          "Regular payroll runs should target one schedule-based pay group, such as Weekly or Monthly staff.",
        status: "error",
      });
      return;
    }
    if (scope === "group" && !form.pay_group_id) {
      toast({
        title: "Select a pay group",
        description:
          "Empty all-employee pay runs are disabled. Pick a pay group with assigned employees.",
        status: "error",
      });
      return;
    }
    if (scope === "individual" && !form.employee_id) {
      toast({
        title: "Please select an employee for an individual pay run",
        status: "error",
      });
      return;
    }
    if (
      scope === "group" &&
      form.pay_group_id &&
      (employeeCountByGroup[Number(form.pay_group_id)] || 0) === 0
    ) {
      toast({
        title: "Selected pay group has no employees",
        description:
          "Assign employees to the pay group before creating a pay run.",
        status: "error",
      });
      return;
    }

    let resolvedName = form.name;
    if (scope === "group") {
      const groupName = form.pay_group_id
        ? payGroups.find((g) => g.id === Number(form.pay_group_id))?.name ||
          "Pay Group"
        : "All employees";
      resolvedName = `${groupName} · ${form.period_start} – ${form.period_end}`;
    }

    const payload: any = {
      name: resolvedName,
      period_start: form.period_start,
      period_end: form.period_end,
      run_type: form.run_type,
      notes: form.notes,
    };
    if (scope === "group" && form.pay_group_id) {
      payload.pay_group_id = Number(form.pay_group_id);
    }
    if (scope === "individual" && form.employee_id) {
      payload.employee_id = Number(form.employee_id);
    }

    const created = await createPayRun(payload);
    if (created) {
      toast({ title: "Pay run created", status: "success" });
      onCreateClose();
      setScope("group");
      setForm({
        name: "",
        period_start: "",
        period_end: "",
        run_type: "regular",
        pay_group_id: "",
        employee_id: "",
        notes: "",
      });
    }
  };

  const handleValidate = async (id: number) => {
    await validatePayRun(id);
    toast({ title: "Pay run validated and locked", status: "success" });
  };

  const handlePay = async () => {
    if (!payingRunId) return;
    await markPayRunPaid(payingRunId, paidOn);
    toast({ title: "Pay run marked as paid", status: "success" });
    setPayingRunId(null);
    onPayClose();
  };

  const handleDelete = (id: number) => {
    hotToast(
      (t) => (
        <Flex direction="column" gap={2}>
          <Text fontSize="sm">
            Delete this pay run? Associated entries will be removed.
          </Text>
          <HStack>
            <Button
              size="xs"
              colorScheme="red"
              onClick={async () => {
                hotToast.dismiss(t.id);
                try {
                  await deletePayRun(id);
                  hotToast.success("Pay run deleted");
                } catch (e: any) {
                  hotToast.error(e?.message || "Failed to delete");
                }
              }}
            >
              Delete
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => hotToast.dismiss(t.id)}
            >
              Cancel
            </Button>
          </HStack>
        </Flex>
      ),
      { duration: 6000 },
    );
  };

  const totalPaid = payRuns.filter((p) => p.status === "paid").length;
  const totalDraft = payRuns.filter((p) => p.status === "draft").length;
  const totalComputed = payRuns.filter((p) => p.status === "computed").length;

  const headers = [
    "Pay Run",
    "Period",
    "Pay Group",
    "Type",
    "Status",
    "Actions",
  ];

  const renderRow = (run: any) => [
    <Box>
      <Text fontWeight="semibold">{run.name || `Pay Run #${run.id}`}</Text>
      <Text fontSize="xs" color="gray.500">
        Created {new Date(run.created_at).toLocaleDateString()}
      </Text>
    </Box>,
    <Text fontSize="sm">
      {new Date(run.period_start).toLocaleDateString()} –{" "}
      {new Date(run.period_end).toLocaleDateString()}
    </Text>,
    <Text fontSize="sm">
      {run.employees
        ? `${run.employees.first_name} ${run.employees.last_name}`
        : run.pay_groups?.name || "All employees"}
    </Text>,
    <Badge
      colorScheme={run.run_type === "off_cycle" ? "orange" : "blue"}
      rounded="full"
      px={2}
      textTransform="capitalize"
    >
      {run.run_type.replace("_", " ")}
    </Badge>,
    <Badge
      colorScheme={STATUS_COLORS[run.status as PayRunStatus]}
      rounded="full"
      px={3}
    >
      {STATUS_LABELS[run.status as PayRunStatus]}
    </Badge>,
    <HStack spacing={1}>
      <Button
        size="xs"
        variant="ghost"
        leftIcon={<Eye size={14} />}
        onClick={() => navigate(`/payroll/runs/${run.id}`)}
      >
        Open
      </Button>
      {run.status === "computed" && (
        <Button
          size="xs"
          variant="ghost"
          colorScheme="green"
          leftIcon={<CheckCircle size={14} />}
          onClick={() => handleValidate(run.id)}
        >
          Validate
        </Button>
      )}
      {run.status === "validated" && (
        <Button
          size="xs"
          variant="ghost"
          colorScheme="teal"
          leftIcon={<DollarSign size={14} />}
          onClick={() => {
            setPayingRunId(run.id);
            onPayOpen();
          }}
        >
          Pay
        </Button>
      )}
      {run.status !== "paid" && run.status !== "validated" && (
        <Button
          size="xs"
          variant="ghost"
          colorScheme="red"
          leftIcon={<Trash2 size={14} />}
          onClick={() => handleDelete(run.id)}
        >
          Delete
        </Button>
      )}
    </HStack>,
  ];

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="lg" color={headingColor}>
          Payroll List
        </Heading>
        <Tooltip label="Open payroll tutorial" hasArrow>
          <Button
            leftIcon={<BookOpen size={16} />}
            variant="ghost"
            size="sm"
            onClick={onTutorialOpen}
          >
            Tutorial
          </Button>
        </Tooltip>
      </Flex>

      <ModuleTabs section="payroll" activeTab="list" />

      {error && (
        <Alert status="error" mb={4} rounded="md">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <Grid templateColumns="repeat(4, 1fr)" gap={4} mb={6}>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Total Pay Runs</StatLabel>
            <StatNumber>{payRuns.length}</StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Ready to Compute</StatLabel>
            <StatNumber color="gray.700">{totalDraft}</StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Computed</StatLabel>
            <StatNumber color="blue.600">{totalComputed}</StatNumber>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Paid</StatLabel>
            <StatNumber color="teal.600">{totalPaid}</StatNumber>
          </Stat>
        </Card>
      </Grid>

      <Box data-payroll-tutorial="pay-runs-panel">
        <Card p={6}>
          <Alert status="info" rounded="md" mb={4}>
            <AlertIcon />A pay run starts in "Ready to Compute" after you create
            it. The next step is opening the run, reviewing inputs, and clicking
            Compute.
          </Alert>
          {payRuns.length === 0 && !loading ? (
            <Flex direction="column" align="center" py={16} color="gray.500">
              <FileText size={40} />
              <Text mt={3} fontWeight="semibold">
                No pay runs yet
              </Text>
              <Text fontSize="sm">
                Create your first pay run to compute payroll for your employees.
              </Text>
            </Flex>
          ) : (
            <Table
              headers={headers}
              data={payRuns}
              renderRow={renderRow}
              isLoading={loading}
              searchable
              searchPlaceholder="Search pay runs..."
              searchPredicate={(run: any, q: string) => {
                const payGroupLabel = run.employees
                  ? `${run.employees.first_name} ${run.employees.last_name}`
                  : run.pay_groups?.name || "";

                return [
                  run.name,
                  run.run_type,
                  STATUS_LABELS[run.status as PayRunStatus],
                  payGroupLabel,
                  run.period_start,
                  run.period_end,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase()
                  .includes(q);
              }}
              filterable
              filterOptions={[
                {
                  label: "Type",
                  value: "run_type",
                  getValue: (run: any) =>
                    run.run_type?.replace("_", " ") || "Unknown",
                },
                {
                  label: "Status",
                  value: "status",
                  getValue: (run: any) =>
                    STATUS_LABELS[run.status as PayRunStatus] || "Unknown",
                },
              ]}
              sortable
              sortOptions={[
                {
                  label: "Name",
                  value: "name",
                  getValue: (run: any) => run.name || "",
                },
                {
                  label: "Created At",
                  value: "created_at",
                  getValue: (run: any) => run.created_at || "",
                },
                {
                  label: "Updated At",
                  value: "updated_at",
                  getValue: (run: any) => run.updated_at || "",
                },
              ]}
              defaultSortBy="created_at"
              defaultSortDirection="desc"
              onRefresh={fetchPayRuns}
              isRefreshing={loading}
              onAdd={onCreateOpen}
              tableName="Pay Run"
              addButtonDataTutorialId="new-pay-run-button"
              pagination
              defaultPageSize={10}
            />
          )}
        </Card>
      </Box>

      <Modal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        title="Create Pay Run"
        size="lg"
      >
        <VStack spacing={4} align="stretch">
          <FormControl>
            <FormLabel>Scope</FormLabel>
            <HStack spacing={2}>
              <Button
                size="sm"
                flex={1}
                variant={scope === "group" ? "solid" : "outline"}
                colorScheme={scope === "group" ? "blue" : "gray"}
                onClick={() => setScope("group")}
              >
                Group
              </Button>
              <Button
                size="sm"
                flex={1}
                variant={scope === "individual" ? "solid" : "outline"}
                colorScheme={scope === "individual" ? "blue" : "gray"}
                onClick={() => setScope("individual")}
              >
                Individual
              </Button>
            </HStack>
            <Text fontSize="xs" color="gray.500" mt={1}>
              {scope === "group"
                ? "Use pay groups for scheduled payroll cohorts like weekly, bi-weekly, semi-monthly, or monthly employees."
                : "Use this for one employee only, usually for off-cycle adjustments, final pay, or corrections."}
            </Text>
          </FormControl>

          {scope === "group" && (
            <FormControl>
              <FormLabel>Run Mode</FormLabel>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  flex={1}
                  variant={form.run_type === "regular" ? "solid" : "outline"}
                  colorScheme={form.run_type === "regular" ? "blue" : "gray"}
                  onClick={() => setForm({ ...form, run_type: "regular" })}
                >
                  Scheduled
                </Button>
                <Button
                  size="sm"
                  flex={1}
                  variant={form.run_type === "off_cycle" ? "solid" : "outline"}
                  colorScheme={
                    form.run_type === "off_cycle" ? "orange" : "gray"
                  }
                  onClick={() => setForm({ ...form, run_type: "off_cycle" })}
                >
                  Off-cycle
                </Button>
              </HStack>
              <Text fontSize="xs" color="gray.500" mt={1}>
                {form.run_type === "regular"
                  ? "Uses the selected pay group's schedule."
                  : "Manual exception run for bonuses, corrections, or final pay."}
              </Text>
            </FormControl>
          )}

          {scope === "individual" && (
            <FormControl isRequired>
              <FormLabel>Name</FormLabel>
              <Input
                placeholder="e.g. Final Pay – Jane Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormControl>
          )}

          {scope === "group" && (
            <FormControl isRequired={isScheduledGroupRun}>
              <FormLabel>Pay Group</FormLabel>
              <Select
                value={form.pay_group_id as any}
                onChange={(e) =>
                  setForm({ ...form, pay_group_id: e.target.value })
                }
              >
                {payGroups.map((group) => {
                  const employeeCount = employeeCountByGroup[group.id] || 0;
                  return (
                    <option key={group.id} value={group.id}>
                      {getScheduleLabel(group.pay_schedule)} · {group.name} ·{" "}
                      {employeeCount}
                    </option>
                  );
                })}
              </Select>
            </FormControl>
          )}

          {scope === "group" && selectedPayGroup && (
            <HStack spacing={2} flexWrap="wrap" mt={-1}>
              <Badge colorScheme="blue" rounded="full" px={3} py={1}>
                {getScheduleLabel(selectedPayGroup.pay_schedule)}
              </Badge>
              <Badge colorScheme="green" rounded="full" px={3} py={1}>
                {(employeeCountByGroup[selectedPayGroup.id] || 0).toString()}{" "}
                employees
              </Badge>
              {selectedPayGroup.description ? (
                <Text fontSize="xs" color="gray.500">
                  {selectedPayGroup.description}
                </Text>
              ) : null}
            </HStack>
          )}

          <Grid templateColumns="1fr 1fr" gap={4}>
            <FormControl isRequired>
              <FormLabel>Period Start</FormLabel>
              <Input
                type="date"
                value={form.period_start}
                isDisabled={isScheduledGroupRun && !!selectedPayGroup}
                onChange={(e) =>
                  setForm({ ...form, period_start: e.target.value })
                }
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Period End</FormLabel>
              <Input
                type="date"
                value={form.period_end}
                isDisabled={isScheduledGroupRun && !!selectedPayGroup}
                onChange={(e) =>
                  setForm({ ...form, period_end: e.target.value })
                }
              />
            </FormControl>
          </Grid>

          <Text fontSize="xs" color="gray.500" mt={-2}>
            {isScheduledGroupRun && selectedPayGroup
              ? `Auto-filled from the ${getScheduleLabel(selectedPayGroup.pay_schedule).toLowerCase()} schedule.`
              : "These dates define the run coverage."}
          </Text>

          {scope === "individual" ? (
            <FormControl isRequired>
              <FormLabel>Employee</FormLabel>
              <Select
                placeholder="Select employee"
                value={form.employee_id as any}
                onChange={(e) =>
                  setForm({ ...form, employee_id: e.target.value })
                }
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.first_name} {emp.last_name}
                    {emp.position ? ` — ${emp.position}` : ""}
                  </option>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Text fontSize="sm" color="gray.600" mt={-1}>
              {formatRangePreview(form.period_start, form.period_end)}
            </Text>
          )}

          <FormControl>
            <FormLabel>Notes</FormLabel>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </FormControl>
          <Flex justify="flex-end" gap={2} pt={2}>
            <Button variant="ghost" onClick={onCreateClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleCreate}
              isLoading={loading}
            >
              {isScheduledGroupRun
                ? "Create Scheduled Run"
                : "Create Manual Run"}
            </Button>
          </Flex>
        </VStack>
      </Modal>

      <Modal
        isOpen={isPayOpen}
        onClose={onPayClose}
        title="Mark Pay Run as Paid"
      >
        <VStack spacing={4} align="stretch">
          <Text fontSize="sm" color="gray.600">
            This will record payment for every entry in this pay run and lock it
            as paid. The current net total will be used for each payment.
          </Text>
          <FormControl>
            <FormLabel>Payment Date</FormLabel>
            <Input
              type="date"
              value={paidOn}
              onChange={(e) => setPaidOn(e.target.value)}
            />
          </FormControl>
          <Flex justify="flex-end" gap={2} pt={2}>
            <Button variant="ghost" onClick={onPayClose}>
              Cancel
            </Button>
            <Button
              colorScheme="teal"
              leftIcon={<DollarSign size={16} />}
              onClick={handlePay}
            >
              Mark as Paid
            </Button>
          </Flex>
          <Text fontSize="xs" color="gray.500">
            Total net:{" "}
            <strong>
              {formatCurrency(
                (
                  usePayRunStore.getState().entries[payingRunId || 0] || []
                ).reduce((s, e) => s + e.net_pay, 0),
              )}
            </strong>
          </Text>
        </VStack>
      </Modal>

      <PayrollModuleTutorial
        isOpen={isTutorialOpen}
        onSkip={handleSkipTutorial}
        onComplete={handleCompleteTutorial}
      />
    </Box>
  );
};
