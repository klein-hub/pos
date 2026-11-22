import {
  Box,
  Heading,
  useColorModeValue,
  Grid,
  Text,
  Flex,
  Button,
  Select,
  Badge,
  IconButton,
  useToast,
  Editable,
  EditableInput,
  EditablePreview,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
} from "@chakra-ui/react";
import { Card } from "../components/ui/Card";
import {
  Clock,
  UserCheck,
  UserX,
  Save,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useState, useEffect, useMemo, memo } from "react";
import { useDepartmentStore } from "../store/departmentStore";
import { useProjectStore } from "../store/projectStore";
import { useEmployeeStore } from "../store/employeeStore";
import { useWorkScheduleStore } from "../store/workScheduleStore";
import { ModuleTabs } from "../components/layout/ModuleTabs";
import { supabase } from "../lib/supabase";
import { Table } from "../components/ui/Table";
import { useCompanyContext } from "../hooks/useCompanyContext";

interface ShiftOption {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface AttendanceRecord {
  employee_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "half-day";
}

const DEFAULT_SHIFTS: ShiftOption[] = [
  {
    id: "default-morning",
    name: "Morning",
    startTime: "7:00 AM",
    endTime: "4:00 PM",
  },
  { id: "default-mid", name: "Mid", startTime: "9:00 AM", endTime: "6:00 PM" },
  {
    id: "default-night",
    name: "Night",
    startTime: "10:00 PM",
    endTime: "7:00 AM",
  },
];

// Shift Dropdown Component
const ShiftDropdown = memo(
  ({
    value,
    onChange,
    shifts,
  }: {
    value: string;
    onChange: (shiftId: string) => void;
    shifts: ShiftOption[];
  }) => {
    return (
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size="sm"
        width="180px"
      >
        {shifts.map((shift) => (
          <option key={shift.id} value={shift.id}>
            {shift.name} ({shift.startTime}-{shift.endTime})
          </option>
        ))}
      </Select>
    );
  },
);

// Editable Hours Dropdown Component
const EditableHoursDropdown = memo(
  ({
    defaultValue,
    onChange,
  }: {
    defaultValue: string;
    onChange: (value: string) => void;
  }) => {
    const [value, setValue] = useState(defaultValue);
    const presetHours = ["9.0", "8.0", "0.0"];
    const textColor = useColorModeValue("gray.800", "white");
    const hoverColor = useColorModeValue("gray.500", "gray.300");
    const bgColor = useColorModeValue("white", "gray.700");

    const handleValueChange = (newValue: string) => {
      if (/^\d*\.?\d*$/.test(newValue)) {
        setValue(newValue);
        onChange(newValue);
      }
    };

    return (
      <Popover placement="bottom" closeOnBlur={true}>
        <PopoverTrigger>
          <Flex
            w="80px"
            h="32px"
            align="center"
            justify="center"
            cursor="pointer"
            bg={bgColor}
            rounded="md"
            border="1px solid"
            borderColor="gray.200"
            _hover={{ borderColor: "gray.300" }}
          >
            <Editable
              value={value}
              onChange={handleValueChange}
              placeholder="Hours"
              display="flex"
              alignItems="center"
              w="full"
            >
              <EditablePreview
                w="full"
                textAlign="center"
                color={textColor}
                _hover={{ color: hoverColor }}
                fontSize="sm"
              />
              <EditableInput
                w="full"
                textAlign="center"
                color={textColor}
                fontSize="sm"
              />
            </Editable>
            <ChevronDown size={14} style={{ marginLeft: "4px" }} />
          </Flex>
        </PopoverTrigger>
        <PopoverContent w="100px">
          <PopoverBody p={0}>
            <VStack align="stretch" spacing={0}>
              {presetHours.map((hours) => (
                <Button
                  key={hours}
                  variant="ghost"
                  size="sm"
                  w="full"
                  justifyContent="center"
                  onClick={() => {
                    setValue(hours);
                    onChange(hours);
                  }}
                  _hover={{ bg: "gray.100" }}
                >
                  {hours}
                </Button>
              ))}
            </VStack>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    );
  },
);

export const Attendance = () => {
  const { activeCompanyId } = useCompanyContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [periodDates, setPeriodDates] = useState<Date[]>([]);
  const [shiftOptions, setShiftOptions] =
    useState<ShiftOption[]>(DEFAULT_SHIFTS);
  const [employeeShifts, setEmployeeShifts] = useState<Record<string, string>>(
    {},
  );
  const [employeeHours, setEmployeeHours] = useState<
    Record<string, Record<string, string>>
  >({});
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);

  const { fetchDepartments } = useDepartmentStore();
  const { projects, fetchProjects } = useProjectStore();
  const { employees, fetchEmployees, loading } = useEmployeeStore();
  const { addSchedule } = useWorkScheduleStore();

  const toast = useToast();
  const textColor = useColorModeValue("gray.900", "white");

  useEffect(() => {
    if (activeCompanyId) {
      fetchDepartments();
      fetchProjects();
      fetchEmployees();
    }
  }, [activeCompanyId]);

  useEffect(() => {
    const fetchShiftOptions = async () => {
      if (!activeCompanyId) {
        setShiftOptions(DEFAULT_SHIFTS);
        return;
      }

      const { data, error } = await supabase
        .from("work_schedules")
        .select("id, name, start_time, end_time")
        .eq("company_id", activeCompanyId)
        .order("start_time", { ascending: true });

      if (error) {
        setShiftOptions(DEFAULT_SHIFTS);
        return;
      }

      const mapped = (data || [])
        .filter((row: any) => row.name && row.start_time && row.end_time)
        .map((row: any) => ({
          id: String(row.id),
          name: row.name,
          startTime: row.start_time,
          endTime: row.end_time,
        }));

      setShiftOptions(mapped.length ? mapped : DEFAULT_SHIFTS);
    };

    fetchShiftOptions();
  }, [activeCompanyId]);

  const handleRefresh = () => {
    fetchDepartments();
    fetchProjects();
    fetchEmployees();
  };

  useEffect(() => {
    const dates = [];
    const currentDate = new Date(selectedDate);

    // Set to the 1st or 16th of the month depending on the current date
    const day = currentDate.getDate();
    const startDay = day <= 15 ? 1 : 16;
    const endDay =
      startDay === 1
        ? 15
        : new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
          ).getDate();

    currentDate.setDate(startDay);

    // Generate dates for the entire period
    for (let i = startDay; i <= endDay; i++) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    setPeriodDates(dates);
  }, [selectedDate]);

  useEffect(() => {
    const fetchAttendanceForPeriod = async () => {
      if (!activeCompanyId || !periodDates.length || !employees.length) {
        setAttendanceRecords([]);
        return;
      }

      const employeeIds = employees
        .map((employee) => employee.id)
        .filter(Boolean);
      if (!employeeIds.length) {
        setAttendanceRecords([]);
        return;
      }

      const startDate = periodDates[0].toISOString().slice(0, 10);
      const endDate = periodDates[periodDates.length - 1]
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("attendance")
        .select("employee_id, attendance_date, status")
        .in("employee_id", employeeIds)
        .eq("company_id", activeCompanyId)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate);

      if (error) {
        setAttendanceRecords([]);
        return;
      }

      setAttendanceRecords((data || []) as AttendanceRecord[]);
    };

    fetchAttendanceForPeriod();
  }, [activeCompanyId, employees, periodDates]);

  const handlePreviousPeriod = () => {
    const newDate = new Date(selectedDate);
    // If we're in the first half of the month, go to the second half of previous month
    if (selectedDate.getDate() <= 15) {
      newDate.setDate(16);
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      // Go to first half of current month
      newDate.setDate(1);
    }
    setSelectedDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(selectedDate);
    // If we're in the first half of the month, go to the second half
    if (selectedDate.getDate() <= 15) {
      newDate.setDate(16);
    } else {
      // Go to first half of next month
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  const filteredEmployees = employees;

  const tardinessByEmployee = useMemo(() => {
    const allowedEmployeeIds = new Set(
      filteredEmployees.map((employee) => String(employee.id)),
    );
    return attendanceRecords.reduce<
      Record<string, { lateCount: number; totalCount: number }>
    >((acc, record) => {
      const employeeId = String(record.employee_id);
      if (!allowedEmployeeIds.has(employeeId)) {
        return acc;
      }

      if (!acc[employeeId]) {
        acc[employeeId] = { lateCount: 0, totalCount: 0 };
      }

      acc[employeeId].totalCount += 1;
      if (record.status === "late") {
        acc[employeeId].lateCount += 1;
      }
      return acc;
    }, {});
  }, [attendanceRecords, filteredEmployees]);

  const lateThisPeriod = useMemo(() => {
    return Object.values(tardinessByEmployee).reduce(
      (sum, record) => sum + record.lateCount,
      0,
    );
  }, [tardinessByEmployee]);

  const handleSaveSchedule = async (
    employeeId: string,
    date: Date,
    hours: string,
    shiftId: string,
  ) => {
    const shift = shiftOptions.find((s) => s.id === shiftId);
    if (!shift) return;
    void hours;

    try {
      await addSchedule({
        employee_id: employeeId,
        work_date: date.toISOString(),
        start_time: shift.startTime,
        end_time: shift.endTime,
      });

      toast({
        title: "Schedule saved",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      toast({
        title: "Error saving schedule",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const formatPeriodLabel = (date: Date) => {
    const isFirstHalf = date.getDate() <= 15;
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();
    return isFirstHalf
      ? `${month} 1-15, ${year}`
      : `${month} 16-${new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()}, ${year}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });
  };

  const formatDay = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
    });
  };

  const getEmployeeProjectLabel = (employee: any) => {
    if (employee.project_id) {
      return (
        projects.find((project) => project.id === employee.project_id)?.name ||
        "Unassigned"
      );
    }

    if (Array.isArray(employee.projects) && employee.projects.length > 0) {
      const firstProjectId = Number(employee.projects[0]);
      return (
        projects.find((project) => project.id === firstProjectId)?.name ||
        "Unassigned"
      );
    }

    return "Unassigned";
  };

  const attendanceHeaders = [
    "Employee",
    "Tardiness",
    "Shift",
    ...periodDates.map((date) => (
      <Box textAlign="center">
        <Text fontSize="xs" textTransform="uppercase" color="gray.500">
          {formatDay(date)}
        </Text>
        <Text fontSize="sm">{formatDate(date)}</Text>
      </Box>
    )),
    "Total",
    "Actions",
  ];

  const updateEmployeeShift = (employeeId: string, shiftId: string) => {
    setEmployeeShifts((prev) => ({
      ...prev,
      [employeeId]: shiftId,
    }));
  };

  const updateEmployeeHour = (
    employeeId: string,
    dateKey: string,
    value: string,
  ) => {
    setEmployeeHours((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [dateKey]: value,
      },
    }));
  };

  const getEmployeeHoursTotal = (employeeId: string) => {
    return periodDates
      .map((date) => {
        const dateKey = date.toISOString().slice(0, 10);
        const value = employeeHours[employeeId]?.[dateKey] || "9.0";
        const parsed = Number(value);
        return Number.isNaN(parsed) ? 0 : parsed;
      })
      .reduce((sum, value) => sum + value, 0)
      .toFixed(1);
  };

  const renderAttendanceRow = (employee: any) => {
    const employeeId = String(employee.id);
    const currentShift =
      employeeShifts[employeeId] || shiftOptions[0]?.id || "";
    const tardiness = tardinessByEmployee[employeeId] || {
      lateCount: 0,
      totalCount: 0,
    };

    return [
      <Text fontWeight="medium">{`${employee.first_name} ${employee.last_name}`}</Text>,
      tardiness.totalCount === 0 ? (
        <Badge colorScheme="gray" rounded="full" px={3} textTransform="none">
          No record
        </Badge>
      ) : tardiness.lateCount === 0 ? (
        <Badge colorScheme="green" rounded="full" px={3} textTransform="none">
          On time
        </Badge>
      ) : (
        <Badge
          colorScheme={tardiness.lateCount > 1 ? "red" : "orange"}
          rounded="full"
          px={3}
          textTransform="none"
        >
          {tardiness.lateCount}{" "}
          {tardiness.lateCount === 1 ? "tardy" : "tardies"}
        </Badge>
      ),
      <ShiftDropdown
        value={currentShift}
        onChange={(shiftId) => updateEmployeeShift(employeeId, shiftId)}
        shifts={shiftOptions}
      />,
      ...periodDates.map((date) => {
        const dateKey = date.toISOString().slice(0, 10);
        const defaultValue = employeeHours[employeeId]?.[dateKey] || "9.0";

        return (
          <EditableHoursDropdown
            defaultValue={defaultValue}
            onChange={(value) => {
              updateEmployeeHour(employeeId, dateKey, value);
              handleSaveSchedule(employeeId, date, value, currentShift);
            }}
          />
        );
      }),
      <Text fontWeight="bold" textAlign="center">
        {getEmployeeHoursTotal(employeeId)}
      </Text>,
      <Button
        size="sm"
        colorScheme="blue"
        leftIcon={<Save size={16} />}
        onClick={() => {
          if (!periodDates.length) return;
          const firstDate = periodDates[0];
          const firstDateKey = firstDate.toISOString().slice(0, 10);

          handleSaveSchedule(
            employeeId,
            firstDate,
            employeeHours[employeeId]?.[firstDateKey] || "9.0",
            currentShift,
          );
        }}
      >
        Save
      </Button>,
    ];
  };

  return (
    <Box>
      <Heading size="lg" color={textColor} mb={4}>
        Attendance
      </Heading>

      <ModuleTabs section="attendance" activeTab="list" />

      <Grid
        templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }}
        gap={6}
        mb={8}
      >
        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="green.100" rounded="full" mr={4}>
              <UserCheck size={24} color="green" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Present Today
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                24
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="red.100" rounded="full" mr={4}>
              <UserX size={24} color="red" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Absent Today
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                3
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="orange.100" rounded="full" mr={4}>
              <Clock size={24} color="orange" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Tardy This Period
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {lateThisPeriod}
              </Text>
              <Text fontSize="xs" color="gray.400">
                Friendly nudge for follow-up
              </Text>
            </Box>
          </Flex>
        </Card>
      </Grid>

      <Flex justify="end" align="center" gap={4} mt={6} mb={6}>
        <IconButton
          aria-label="Previous period"
          icon={<ChevronLeft size={20} />}
          onClick={handlePreviousPeriod}
        />
        <Text fontSize="md" fontWeight="medium" minW="200px" textAlign="center">
          {formatPeriodLabel(selectedDate)}
        </Text>
        <IconButton
          aria-label="Next period"
          icon={<ChevronRight size={20} />}
          onClick={handleNextPeriod}
        />
      </Flex>
      <Card p={6}>
        <Table
          headers={attendanceHeaders}
          data={filteredEmployees}
          renderRow={renderAttendanceRow}
          rowKey={(employee: any) => String(employee.id)}
          searchable
          searchPlaceholder="Search attendance by employee..."
          searchPredicate={(employee: any, q: string) => {
            const fullName =
              `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
            const departmentName = employee.departments?.name || "";
            const projectName = getEmployeeProjectLabel(employee);

            return [fullName, departmentName, projectName]
              .join(" ")
              .toLowerCase()
              .includes(q);
          }}
          filterable
          filterOptions={[
            {
              label: "Department",
              value: "department",
              getValue: (employee: any) =>
                employee.departments?.name || "Unassigned",
            },
            {
              label: "Project",
              value: "project",
              getValue: (employee: any) => getEmployeeProjectLabel(employee),
            },
            {
              label: "Tardiness",
              value: "tardiness",
              getValue: (employee: any) => {
                const tardiness = tardinessByEmployee[String(employee.id)] || {
                  lateCount: 0,
                  totalCount: 0,
                };

                if (tardiness.totalCount === 0) return "No record";
                if (tardiness.lateCount === 0) return "On time";
                return tardiness.lateCount === 1
                  ? "1 tardy"
                  : "Multiple tardies";
              },
            },
          ]}
          sortable
          sortOptions={[
            {
              label: "Name",
              value: "name",
              getValue: (employee: any) =>
                `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
            },
            {
              label: "Department",
              value: "department",
              getValue: (employee: any) => employee.departments?.name || "",
            },
            {
              label: "Project",
              value: "project",
              getValue: (employee: any) => getEmployeeProjectLabel(employee),
            },
            {
              label: "Created At",
              value: "created_at",
              getValue: (employee: any) => employee.created_at || "",
            },
            {
              label: "Updated At",
              value: "updated_at",
              getValue: (employee: any) => employee.updated_at || "",
            },
          ]}
          defaultSortBy="name"
          defaultSortDirection="asc"
          onRefresh={handleRefresh}
          isRefreshing={loading}
          pagination
          defaultPageSize={10}
          emptyMessage="No attendance rows available for this period."
          emptySearchMessage="No attendance rows match your search."
        />
      </Card>
    </Box>
  );
};
