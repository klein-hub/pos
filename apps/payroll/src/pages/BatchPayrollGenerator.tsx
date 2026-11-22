import { useState } from "react";
import {
  Container,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  FormControl,
  FormLabel,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Stat,
  StatLabel,
  StatNumber,
  StatGroup,
} from "@chakra-ui/react";
import { supabase } from "../lib/supabase";
import { useCompanyContext } from "../hooks/useCompanyContext";
import { CheckCircle, AlertCircle } from "lucide-react";

interface BatchResult {
  totalRecords: number;
  totalAmount: number;
  failedCount: number;
  errors: string[];
  results: Array<{
    employeeId: string;
    employeeName: string;
    status: "success" | "error";
    grossSalary?: number;
    error?: string;
  }>;
}

export function BatchPayrollGenerator() {
  const { activeCompanyId } = useCompanyContext();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const toast = useToast();

  const handleGeneratePayroll = async () => {
    if (month < 1 || month > 12) {
      toast({
        title: "Invalid month",
        description: "Please select a valid month (1-12)",
        status: "error",
        duration: 3000,
      });
      return;
    }

    setGenerating(true);
    try {
      const { data: employees, error: employeesError } = await supabase
        .from("employee")
        .select("id, first_name, last_name, base_salary")
        .eq("company_id", activeCompanyId);

      if (employeesError) throw employeesError;

      if (!employees || employees.length === 0) {
        toast({
          title: "No employees found",
          description: "Please add employees before generating payroll",
          status: "warning",
          duration: 3000,
        });
        return;
      }

      const batchResult: BatchResult = {
        totalRecords: 0,
        totalAmount: 0,
        failedCount: 0,
        errors: [],
        results: [],
      };

      // Generate payroll for each employee
      for (const employee of employees) {
        try {
          // Get attendance data for the employee
          const { data: attendance, error: attendanceError } = await supabase
            .from("attendance")
            .select("status")
            .eq("employee_id", employee.id)
            .eq("company_id", activeCompanyId)
            .gte("date", `${year}-${String(month).padStart(2, "0")}-01`)
            .lte("date", `${year}-${String(month).padStart(2, "0")}-31`);

          if (attendanceError) throw attendanceError;

          const presentDays = (attendance || []).filter(
            (a) => a.status === "present",
          ).length;
          const totalDays = (attendance || []).length || 22;

          // Calculate net salary
          const baseSalary = employee.base_salary || 0;
          const grossSalary = (baseSalary / 22) * presentDays;
          const deductions = grossSalary * 0.1; // 10% deductions
          const netSalary = grossSalary - deductions;

          // Insert payroll record
          const { data: payroll, error: payrollError } = await supabase
            .from("payroll_records")
            .insert({
              company_id: activeCompanyId,
              employee_id: employee.id,
              month,
              year,
              base_salary: baseSalary,
              gross_salary: Math.round(grossSalary),
              deductions: Math.round(deductions),
              net_salary: Math.round(netSalary),
              status: "draft",
            })
            .select();

          if (payrollError) throw payrollError;

          batchResult.totalRecords += 1;
          batchResult.totalAmount += Math.round(netSalary);
          batchResult.results.push({
            employeeId: employee.id,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            status: "success",
            grossSalary: Math.round(grossSalary),
          });
        } catch (error: any) {
          batchResult.failedCount += 1;
          batchResult.errors.push(error.message);
          batchResult.results.push({
            employeeId: employee.id,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            status: "error",
            error: error.message,
          });
        }
      }

      setResult(batchResult);

      toast({
        title: "Batch generation complete",
        description: `Generated payroll for ${batchResult.totalRecords} employees`,
        status: batchResult.failedCount === 0 ? "success" : "warning",
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Error generating batch payroll",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    } finally {
      setGenerating(false);
    }
  };

  const successPercentage = result
    ? Math.round(
        (result.totalRecords / (result.totalRecords + result.failedCount)) *
          100,
      )
    : 0;

  if (!activeCompanyId) {
    return (
      <Container maxW="6xl" py={8}>
        <Text color="gray.500">
          Please select a company to use the batch payroll generator.
        </Text>
      </Container>
    );
  }

  return (
    <Container maxW="6xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading as="h1" size="xl" mb={2}>
            Batch Payroll Generator
          </Heading>
          <Text color="gray.600">
            Generate payroll for all employees in a single operation
          </Text>
        </Box>

        {!result ? (
          <Card>
            <CardHeader>
              <Heading size="md">Generate Payroll</Heading>
            </CardHeader>
            <CardBody>
              <VStack spacing={6} align="stretch">
                <HStack spacing={4}>
                  <FormControl flex={1}>
                    <FormLabel>Month</FormLabel>
                    <Input
                      type="number"
                      min="1"
                      max="12"
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormControl flex={1}>
                    <FormLabel>Year</FormLabel>
                    <Input
                      type="number"
                      min="2020"
                      max="2030"
                      value={year}
                      onChange={(e) => setYear(parseInt(e.target.value))}
                    />
                  </FormControl>
                </HStack>

                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>How it works</AlertTitle>
                    <AlertDescription>
                      This will generate payroll records for all active
                      employees based on their attendance for {month}/{year}.
                    </AlertDescription>
                  </Box>
                </Alert>

                <Button
                  colorScheme="blue"
                  size="lg"
                  onClick={handleGeneratePayroll}
                  isLoading={generating}
                  loadingText="Generating..."
                >
                  Generate Payroll
                </Button>
              </VStack>
            </CardBody>
          </Card>
        ) : (
          <>
            {/* Results Summary */}
            <Alert
              status={result.failedCount === 0 ? "success" : "warning"}
              borderRadius="md"
            >
              <AlertIcon />
              <Box>
                <AlertTitle>
                  {result.failedCount === 0
                    ? "Batch generation successful"
                    : "Batch generation completed with errors"}
                </AlertTitle>
                <AlertDescription>
                  Generated payroll for {result.totalRecords} employees. Total
                  amount: ₱{result.totalAmount.toLocaleString()}
                </AlertDescription>
              </Box>
            </Alert>

            {/* Stats */}
            <StatGroup>
              <Card flex="1">
                <CardBody>
                  <Stat>
                    <StatLabel>Successfully Generated</StatLabel>
                    <StatNumber color="green.500">
                      {result.totalRecords}
                    </StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card flex="1">
                <CardBody>
                  <Stat>
                    <StatLabel>Failed</StatLabel>
                    <StatNumber color="red.500">
                      {result.failedCount}
                    </StatNumber>
                  </Stat>
                </CardBody>
              </Card>
              <Card flex="1">
                <CardBody>
                  <Stat>
                    <StatLabel>Success Rate</StatLabel>
                    <StatNumber color="blue.500">
                      {successPercentage}%
                    </StatNumber>
                  </Stat>
                </CardBody>
              </Card>
            </StatGroup>

            {/* Progress Bar */}
            <Box>
              <Text mb={2} fontSize="sm" color="gray.600">
                Completion Progress
              </Text>
              <Progress
                value={successPercentage}
                size="lg"
                colorScheme={successPercentage === 100 ? "green" : "orange"}
                borderRadius="md"
              />
            </Box>

            {/* Results Table */}
            <Card>
              <CardHeader>
                <Heading size="md">Generation Results</Heading>
              </CardHeader>
              <CardBody overflowX="auto">
                <Table variant="simple" size="sm">
                  <Thead>
                    <Tr>
                      <Th>Employee</Th>
                      <Th>Status</Th>
                      <Th isNumeric>Gross Salary</Th>
                      <Th>Details</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {result.results.map((r, idx) => (
                      <Tr key={idx}>
                        <Td fontWeight="medium">{r.employeeName}</Td>
                        <Td>
                          <Badge
                            colorScheme={
                              r.status === "success" ? "green" : "red"
                            }
                          >
                            {r.status}
                          </Badge>
                        </Td>
                        <Td isNumeric>
                          {r.grossSalary
                            ? `₱${r.grossSalary.toLocaleString()}`
                            : "-"}
                        </Td>
                        <Td fontSize="sm" color="gray.600">
                          {r.error || "OK"}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </CardBody>
            </Card>

            {/* Errors List */}
            {result.errors.length > 0 && (
              <Card borderColor="red.200" borderWidth={1}>
                <CardHeader>
                  <Heading size="sm" color="red.600">
                    Errors ({result.errors.length})
                  </Heading>
                </CardHeader>
                <CardBody>
                  <VStack align="start" spacing={2}>
                    {result.errors.map((error, idx) => (
                      <HStack key={idx} spacing={2} width="100%">
                        <AlertCircle size={16} color="red" />
                        <Text fontSize="sm">{error}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </CardBody>
              </Card>
            )}

            {/* Action Buttons */}
            <HStack spacing={4}>
              <Button colorScheme="blue" onClick={() => setResult(null)}>
                Generate Again
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                Print Results
              </Button>
            </HStack>
          </>
        )}
      </VStack>
    </Container>
  );
}
