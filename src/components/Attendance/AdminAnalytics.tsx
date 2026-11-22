import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  useColorModeValue,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  VStack,
  Input,
  Progress,
} from '@chakra-ui/react';
import { Card } from '../ui/Card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAttendance } from '../../hooks/useAttendance';
import { useEmployeeStore } from '../../store/employeeStore';

interface EmployeeAttendanceStats {
  employee_id: string;
  employee_name: string;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_hours: number;
  attendance_percentage: number;
  leave_balance: number;
}

export const AdminAnalytics = ({ companyId }: { companyId: string }) => {
  const toast = useToast();
  const { getAttendanceSummary } = useAttendance();
  const { employees } = useEmployeeStore();
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeAttendanceStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.900', 'white');
  const successColor = useColorModeValue('green.50', 'green.900');
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.900');
  const rowBorderColor = useColorModeValue('gray.200', 'gray.700');

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      await getAttendanceSummary(companyId, startDate, endDate);

      // Mock employee stats for demo
      const mockStats: EmployeeAttendanceStats[] = employees.map(emp => ({
        employee_id: emp.id?.toString() || '',
        employee_name: `${emp.first_name} ${emp.last_name}`,
        present_count: Math.floor(Math.random() * 20) + 5,
        absent_count: Math.floor(Math.random() * 3),
        late_count: Math.floor(Math.random() * 5),
        total_hours: Math.random() * 160 + 100,
        attendance_percentage: Math.floor(Math.random() * 20) + 80,
        leave_balance: Math.floor(Math.random() * 10) + 5,
      }));

      setEmployeeStats(mockStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      toast({
        title: 'Error Loading Analytics',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [startDate, endDate, companyId]);

  const handleExportCSV = () => {
    if (employeeStats.length === 0) {
      toast({
        title: 'No Data',
        description: 'No data to export',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Create CSV content
    const headers = ['Employee Name', 'Present', 'Absent', 'Late', 'Total Hours', 'Attendance %', 'Leave Balance'];
    const rows = employeeStats.map(stat => [
      stat.employee_name,
      stat.present_count,
      stat.absent_count,
      stat.late_count,
      stat.total_hours.toFixed(2),
      stat.attendance_percentage,
      stat.leave_balance,
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast({
      title: 'Exported',
      description: 'Report exported successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  // Summary stats
  const totalPresent = employeeStats.reduce((sum, s) => sum + s.present_count, 0);
  const totalAbsent = employeeStats.reduce((sum, s) => sum + s.absent_count, 0);
  const totalLate = employeeStats.reduce((sum, s) => sum + s.late_count, 0);
  const avgAttendance = Math.round(employeeStats.reduce((sum, s) => sum + s.attendance_percentage, 0) / (employeeStats.length || 1));

  // Chart data: Monthly trend
  const monthlyTrendData = [
    { month: 'Week 1', present: totalPresent * 0.2, absent: totalAbsent * 0.2, late: totalLate * 0.2 },
    { month: 'Week 2', present: totalPresent * 0.25, absent: totalAbsent * 0.25, late: totalLate * 0.25 },
    { month: 'Week 3', present: totalPresent * 0.25, absent: totalAbsent * 0.25, late: totalLate * 0.25 },
    { month: 'Week 4', present: totalPresent * 0.3, absent: totalAbsent * 0.3, late: totalLate * 0.3 },
  ];

  // Chart data: Leave breakdown
  const leaveBreakdownData = [
    { name: 'Approved', value: employeeStats.filter(s => s.leave_balance > 5).length },
    { name: 'Pending', value: employeeStats.filter(s => s.leave_balance > 3 && s.leave_balance <= 5).length },
    { name: 'Used', value: employeeStats.filter(s => s.leave_balance <= 3).length },
  ];

  const COLORS = ['#48bb78', '#ed8936', '#f56565'];

  return (
    <VStack spacing={6} align="stretch">
      {/* Date Range Filter */}
      <Card p={4} bg={bgColor}>
        <Flex align="center" gap={4} flexWrap="wrap">
          <HStack spacing={2}>
            <Calendar size={18} />
            <Text fontWeight="bold" color={textColor}>Period:</Text>
          </HStack>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            maxW="200px"
          />
          <Text color="gray.500">to</Text>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            maxW="200px"
          />
          <Button
            colorScheme="blue"
            size="sm"
            isLoading={isLoading}
            onClick={loadAnalytics}
          >
            Refresh
          </Button>
          <Button
            colorScheme="green"
            size="sm"
            leftIcon={<Download size={16} />}
            onClick={handleExportCSV}
            ml="auto"
          >
            Export CSV
          </Button>
        </Flex>
      </Card>

      {/* Summary Stats */}
      <Flex gap={4} flexWrap="wrap">
        <Card p={6} flex="1" minW="150px" bg={successColor}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Total Present</Text>
            <Heading size="lg" color="green.600">{totalPresent}</Heading>
            <Text fontSize="xs" color="gray.400">across all employees</Text>
          </VStack>
        </Card>

        <Card p={6} flex="1" minW="150px" bg={useColorModeValue('red.50', 'red.900')}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Total Absent</Text>
            <Heading size="lg" color="red.600">{totalAbsent}</Heading>
            <Text fontSize="xs" color="gray.400">across all employees</Text>
          </VStack>
        </Card>

        <Card p={6} flex="1" minW="150px" bg={useColorModeValue('yellow.50', 'yellow.900')}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Total Late</Text>
            <Heading size="lg" color="yellow.600">{totalLate}</Heading>
            <Text fontSize="xs" color="gray.400">across all employees</Text>
          </VStack>
        </Card>

        <Card p={6} flex="1" minW="150px" bg={useColorModeValue('blue.50', 'blue.900')}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Avg Attendance</Text>
            <Heading size="lg" color="blue.600">{avgAttendance}%</Heading>
            <Text fontSize="xs" color="gray.400">attendance rate</Text>
          </VStack>
        </Card>
      </Flex>

      {/* Charts */}
      <Flex gap={6} flexWrap="wrap">
        {/* Monthly Trend Chart */}
        <Card p={6} bg={bgColor} flex="1" minW="300px">
          <Heading size="md" mb={6} color={textColor}>
            Monthly Attendance Trend
          </Heading>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke={useColorModeValue('#e2e8f0', '#4a5568')} />
              <XAxis dataKey="month" stroke={useColorModeValue('#4a5568', '#cbd5e0')} />
              <YAxis stroke={useColorModeValue('#4a5568', '#cbd5e0')} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: useColorModeValue('#fff', '#2d3748'),
                  border: `1px solid ${useColorModeValue('#e2e8f0', '#4a5568')}`,
                  color: useColorModeValue('#1a202c', '#f7fafc')
                }}
              />
              <Legend />
              <Bar dataKey="present" fill="#48bb78" />
              <Bar dataKey="absent" fill="#f56565" />
              <Bar dataKey="late" fill="#ed8936" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Leave Breakdown Pie Chart */}
        <Card p={6} bg={bgColor} flex="1" minW="300px">
          <Heading size="md" mb={6} color={textColor}>
            Leave Balance Breakdown
          </Heading>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={leaveBreakdownData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {COLORS.map((color, index) => (
                  <Cell key={`cell-${index}`} fill={color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </Flex>

      {/* Employee Details Table */}
      <Card p={6} bg={bgColor}>
        <Heading size="md" mb={6} color={textColor}>
          Employee Attendance Details
        </Heading>

        {employeeStats.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No employee data available
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr bg={tableHeaderBg}>
                  <Th color={textColor}>Employee Name</Th>
                  <Th color={textColor} isNumeric>Present</Th>
                  <Th color={textColor} isNumeric>Absent</Th>
                  <Th color={textColor} isNumeric>Late</Th>
                  <Th color={textColor} isNumeric>Total Hours</Th>
                  <Th color={textColor}>Attendance %</Th>
                  <Th color={textColor} isNumeric>Leave Balance</Th>
                </Tr>
              </Thead>
              <Tbody>
                {employeeStats.map(stat => (
                  <Tr key={stat.employee_id} borderBottomColor={rowBorderColor}>
                    <Td color={textColor}>{stat.employee_name}</Td>
                    <Td color={textColor} isNumeric>{stat.present_count}</Td>
                    <Td color={textColor} isNumeric>{stat.absent_count}</Td>
                    <Td color={textColor} isNumeric>{stat.late_count}</Td>
                    <Td color={textColor} isNumeric>{stat.total_hours.toFixed(2)}h</Td>
                    <Td>
                      <Flex align="center" gap={2}>
                        <Progress 
                          value={stat.attendance_percentage} 
                          size="sm" 
                          colorScheme={stat.attendance_percentage >= 80 ? 'green' : stat.attendance_percentage >= 70 ? 'yellow' : 'red'}
                          flex="1"
                          maxW="150px"
                        />
                        <Text color={textColor} fontSize="sm" minW="40px">
                          {stat.attendance_percentage}%
                        </Text>
                      </Flex>
                    </Td>
                    <Td color={textColor} isNumeric>{stat.leave_balance}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        )}
      </Card>
    </VStack>
  );
};
