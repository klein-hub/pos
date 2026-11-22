import { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Grid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useToast,
  useColorModeValue,
  Spinner,
  Text,
} from "@chakra-ui/react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, TrendingUp } from "lucide-react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { ModuleTabs } from "../components/layout/ModuleTabs";
import { supabase } from "../lib/supabase";
import { useCompanyContext } from "../hooks/useCompanyContext";
import { formatCurrency } from "../lib/payrollEngine";

interface PayrollData {
  month: string;
  total: number;
  count: number;
}

interface EmployeeSalary {
  name: string;
  salary: number;
}

interface DepartmentStats {
  name: string;
  employees: number;
  totalSalary: number;
  avgSalary: number;
}

interface DeductionBreakdown {
  name: string;
  value: number;
}

const CHART_COLORS = [
  "#3182CE",
  "#ED8936",
  "#38A169",
  "#DD6B20",
  "#9F7AEA",
  "#ECC94B",
];

export const PayrollAnalytics = () => {
  const toast = useToast();
  const { activeCompanyId } = useCompanyContext();
  const headingColor = useColorModeValue("gray.800", "white");
  const [loading, setLoading] = useState(false);
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedMonth] = useState(new Date().getMonth() + 1);

  const [stats, setStats] = useState({
    totalPayroll: 0,
    avgSalary: 0,
    employeeCount: 0,
    taxPaid: 0,
    totalDeductions: 0,
    leaveCost: 0,
  });

  const [payrollTrends, setPayrollTrends] = useState<PayrollData[]>([]);
  const [topEmployees, setTopEmployees] = useState<EmployeeSalary[]>([]);
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats[]>([]);
  const [deductionBreakdown, setDeductionBreakdown] = useState<
    DeductionBreakdown[]
  >([]);

  useEffect(() => {
    if (activeCompanyId) {
      loadAnalytics();
    }
  }, [activeCompanyId, selectedYear, selectedMonth]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch payroll records for the company
      const { data: payrollData, error: payrollError } = await supabase
        .from("payroll_records")
        .select("*")
        .eq("company_id", activeCompanyId)
        .order("created_at", { ascending: false })
        .limit(1000);

      if (payrollError) throw payrollError;

      // Fetch employees with departments
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, salary, department_id")
        .eq("company_id", activeCompanyId)
        .eq("active", true);

      if (employeesError) throw employeesError;

      // Fetch departments
      const { data: departmentsData } = await supabase
        .from("departments")
        .select("id, name")
        .eq("company_id", activeCompanyId);

      // Calculate stats
      if (payrollData && payrollData.length > 0 && employeesData) {
        const totalNetPay = payrollData.reduce(
          (sum, r) => sum + (r.net_pay || 0),
          0,
        );
        const totalBasePay = payrollData.reduce(
          (sum, r) => sum + (r.base_salary || 0),
          0,
        );
        const totalTax = payrollData.reduce((sum, r) => sum + (r.tax || 0), 0);
        const count = employeesData.length;

        setStats({
          totalPayroll: totalNetPay,
          avgSalary: count > 0 ? totalBasePay / count : 0,
          employeeCount: count,
          taxPaid: totalTax,
          totalDeductions: totalBasePay - totalNetPay,
          leaveCost: 0,
        });

        // Calculate payroll trends (last 12 months)
        const trends: { [key: string]: { total: number; count: number } } = {};
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          trends[key] = { total: 0, count: 0 };
        }

        payrollData.forEach((record) => {
          const date = new Date(record.created_at || Date.now());
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          if (trends[key]) {
            trends[key].total += record.net_pay || 0;
            trends[key].count += 1;
          }
        });

        const trendData = Object.entries(trends)
          .map(([month, data]) => ({
            month: month,
            total: data.total,
            count: data.count,
          }))
          .sort((a, b) => a.month.localeCompare(b.month));

        setPayrollTrends(trendData);

        // Top employees by salary
        const topEmps = employeesData
          .map((emp) => ({
            name: `${emp.first_name} ${emp.last_name}`,
            salary: emp.salary || 0,
          }))
          .sort((a, b) => b.salary - a.salary)
          .slice(0, 10);
        setTopEmployees(topEmps);

        // Department analytics
        if (departmentsData && departmentsData.length > 0) {
          const deptStats: DepartmentStats[] = departmentsData.map(
            (dept: { id: string; name: string }) => {
              const deptEmployees = employeesData.filter(
                (e) => e.department_id === dept.id,
              );
              const totalSalary = deptEmployees.reduce(
                (sum, e) => sum + (e.salary || 0),
                0,
              );
              return {
                name: dept.name,
                employees: deptEmployees.length,
                totalSalary,
                avgSalary:
                  deptEmployees.length > 0
                    ? totalSalary / deptEmployees.length
                    : 0,
              };
            },
          );
          setDepartmentStats(deptStats);
        }

        // Deduction breakdown
        const deductions: { [key: string]: number } = {
          Tax: totalTax > 0 ? totalTax : 0,
          "Benefits & Loans": Math.max(
            0,
            totalBasePay - totalNetPay - totalTax,
          ),
        };
        setDeductionBreakdown(
          Object.entries(deductions)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value })),
        );
      } else {
        // No payroll data, but we have employees - initialize with 0
        setStats({
          totalPayroll: 0,
          avgSalary: employeesData
            ? employeesData.reduce((sum, e) => sum + (e.salary || 0), 0) /
              (employeesData.length || 1)
            : 0,
          employeeCount: employeesData?.length || 0,
          taxPaid: 0,
          totalDeductions: 0,
          leaveCost: 0,
        });
        setPayrollTrends([]);
      }
    } catch (error) {
      console.error("Analytics load error:", error);
      toast({
        title: "Error loading analytics",
        status: "error",
        duration: 3,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box>
        <Heading size="lg" color={headingColor} mb={4}>
          Payroll Analytics
        </Heading>
        <ModuleTabs section="payroll" activeTab="analytics" />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minH="60vh"
        >
          <Spinner size="lg" color="blue.500" />
        </Box>
      </Box>
    );
  }

  if (!activeCompanyId) {
    return (
      <Box>
        <Heading size="lg" color={headingColor} mb={4}>
          Payroll Analytics
        </Heading>
        <ModuleTabs section="payroll" activeTab="analytics" />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minH="60vh"
        >
          <Text color="gray.500">
            Please select a company to view analytics.
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="lg" color={headingColor} mb={4}>
        Payroll Analytics
      </Heading>

      <ModuleTabs section="payroll" activeTab="analytics" />

      {/* Summary Stats */}
      <Grid
        templateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(3, 1fr)",
        }}
        gap={4}
        mb={6}
      >
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Total Payroll</StatLabel>
            <StatNumber>{formatCurrency(stats.totalPayroll)}</StatNumber>
            <StatHelpText>{stats.employeeCount} employees</StatHelpText>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Average Salary</StatLabel>
            <StatNumber>{formatCurrency(stats.avgSalary)}</StatNumber>
            <StatHelpText>per employee</StatHelpText>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Tax Paid</StatLabel>
            <StatNumber color="red.600">
              {formatCurrency(stats.taxPaid)}
            </StatNumber>
            <StatHelpText>
              {((stats.taxPaid / stats.totalPayroll) * 100).toFixed(1)}% of
              payroll
            </StatHelpText>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Total Deductions</StatLabel>
            <StatNumber color="orange.600">
              {formatCurrency(stats.totalDeductions)}
            </StatNumber>
            <StatHelpText>
              {((stats.totalDeductions / stats.totalPayroll) * 100).toFixed(1)}%
              of payroll
            </StatHelpText>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Employee Count</StatLabel>
            <StatNumber>{stats.employeeCount}</StatNumber>
            <StatHelpText>active employees</StatHelpText>
          </Stat>
        </Card>
        <Card p={5}>
          <Stat>
            <StatLabel color="gray.500">Leave Cost</StatLabel>
            <StatNumber color="purple.600">
              {formatCurrency(stats.leaveCost)}
            </StatNumber>
            <StatHelpText>estimated impact</StatHelpText>
          </Stat>
        </Card>
      </Grid>

      {/* Payroll Trends Chart */}
      {payrollTrends.length > 0 && (
        <Card p={{ base: 4, md: 6 }} mb={6}>
          <Heading
            size="md"
            mb={4}
            display="flex"
            alignItems="center"
            gap={2}
            fontSize={{ base: "md", md: "lg" }}
          >
            <TrendingUp size={20} /> Payroll Trends (Last 12 Months)
          </Heading>
          <Box h={{ base: "250px", md: "300px" }} w="100%">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={payrollTrends}
                margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(value as number)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#3182CE"
                  name="Total Payroll"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Card>
      )}

      {/* Charts Row */}
      <Grid
        templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }}
        gap={6}
        mb={6}
      >
        {/* Deduction Breakdown */}
        {deductionBreakdown.length > 0 && (
          <Card p={{ base: 4, md: 6 }}>
            <Heading size="md" mb={4} fontSize={{ base: "md", md: "lg" }}>
              Deduction Breakdown
            </Heading>
            <Box h={{ base: "250px", md: "280px" }} w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deductionBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) =>
                      `${name}: ${formatCurrency(value)}`
                    }
                    outerRadius={{ base: 60, md: 80 }}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {deductionBreakdown.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        )}

        {/* Top Employees by Salary */}
        {topEmployees.length > 0 && (
          <Card p={{ base: 4, md: 6 }}>
            <Heading size="md" mb={4} fontSize={{ base: "md", md: "lg" }}>
              Top Employees by Salary
            </Heading>
            <Box h={{ base: "250px", md: "280px" }} w="100%">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topEmployees}
                  margin={{ top: 5, right: 10, left: 0, bottom: 50 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                  />
                  <Bar dataKey="salary" fill="#38A169" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Card>
        )}
      </Grid>

      {/* Department Analytics Table */}
      {departmentStats.length > 0 && (
        <Card p={{ base: 4, md: 6 }}>
          <Heading
            size="md"
            mb={4}
            display="flex"
            alignItems="center"
            gap={2}
            fontSize={{ base: "md", md: "lg" }}
          >
            <BarChart3 size={20} /> Department Analytics
          </Heading>
          <Box overflowX={{ base: "auto", md: "visible" }}>
            <Table
              headers={[
                "Department",
                "Employees",
                "Total Salary",
                "Avg Salary",
              ]}
              data={departmentStats}
              renderRow={(dept) => [
                <Box fontWeight="semibold" fontSize={{ base: "sm", md: "md" }}>
                  {dept.name}
                </Box>,
                <Box fontSize={{ base: "sm", md: "md" }}>{dept.employees}</Box>,
                <Box fontSize={{ base: "sm", md: "md" }}>
                  {formatCurrency(dept.totalSalary)}
                </Box>,
                <Box fontSize={{ base: "sm", md: "md" }}>
                  {formatCurrency(dept.avgSalary)}
                </Box>,
              ]}
              isLoading={false}
            />
          </Box>
        </Card>
      )}
    </Box>
  );
};
