import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Select,
  Textarea,
  VStack,
  HStack,
  useColorModeValue,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Text,
} from '@chakra-ui/react';
import { Card } from '../ui/Card';
import { Plus, Calendar, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAttendance, LeaveRequest } from '../../hooks/useAttendance';

type LeaveType = LeaveRequest['leave_type'];

const LEAVE_TYPES = [
  { value: 'sick', label: 'Sick Leave' },
  { value: 'vacation', label: 'Vacation Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
];

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'approved':
      return 'green';
    case 'pending':
      return 'yellow';
    case 'rejected':
      return 'red';
    default:
      return 'gray';
  }
};

export const LeaveRequestForm = ({ employeeId }: { employeeId: string }) => {
  const toast = useToast();
  const { createLeaveRequest, getEmployeeLeaveRequests, loading } = useAttendance();
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    leave_type: 'vacation',
    reason: '',
  });
  
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.900', 'white');
  const formBgColor = useColorModeValue('gray.50', 'gray.700');
  const daysBgColor = useColorModeValue('blue.50', 'blue.900');
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.900');
  const rowBorderColor = useColorModeValue('gray.200', 'gray.700');

  // Load leave requests
  useEffect(() => {
    const loadRequests = async () => {
      const requests = await getEmployeeLeaveRequests(employeeId);
      setLeaveRequests(requests);
    };
    loadRequests();
  }, [employeeId, getEmployeeLeaveRequests]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.start_date || !formData.end_date) {
      toast({
        title: 'Validation Error',
        description: 'Please select both start and end dates',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      toast({
        title: 'Validation Error',
        description: 'Start date must be before end date',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await createLeaveRequest({
        employee_id: employeeId,
        approver_id: null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        leave_type: formData.leave_type as LeaveType,
        reason: formData.reason || null,
        status: 'pending',
        rejection_reason: null,
      });

      toast({
        title: 'Leave Request Created',
        description: 'Your leave request has been submitted for approval',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reset form and reload requests
      setFormData({
        start_date: '',
        end_date: '',
        leave_type: 'vacation',
        reason: '',
      });

      const requests = await getEmployeeLeaveRequests(employeeId);
      setLeaveRequests(requests);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create leave request';
      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Form Card */}
      <Card p={6} bg={bgColor}>
        <Heading size="md" mb={6} color={textColor}>
          <Flex align="center" gap={2}>
            <FileText size={20} />
            Request Leave
          </Flex>
        </Heading>

        <form onSubmit={handleSubmit}>
          <VStack spacing={4}>
            {/* Leave Type */}
            <FormControl>
              <FormLabel color={textColor}>Leave Type</FormLabel>
              <Select
                name="leave_type"
                value={formData.leave_type}
                onChange={handleInputChange}
                bg={formBgColor}
                color={textColor}
              >
                {LEAVE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </FormControl>

            {/* Date Range */}
            <HStack spacing={4} w="full">
              <FormControl>
                <FormLabel color={textColor}>Start Date</FormLabel>
                <Input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  bg={formBgColor}
                  color={textColor}
                  min={new Date().toISOString().split('T')[0]}
                />
              </FormControl>

              <FormControl>
                <FormLabel color={textColor}>End Date</FormLabel>
                <Input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  bg={formBgColor}
                  color={textColor}
                  min={formData.start_date || new Date().toISOString().split('T')[0]}
                />
              </FormControl>
            </HStack>

            {/* Days Display */}
            {formData.start_date && formData.end_date && (
              <Box p={3} bg={daysBgColor} rounded="md" w="full">
                <Text color={textColor} fontWeight="bold">
                  Duration: {calculateDays()} day(s)
                </Text>
              </Box>
            )}

            {/* Reason */}
            <FormControl>
              <FormLabel color={textColor}>Reason (Optional)</FormLabel>
              <Textarea
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="Provide a reason for your leave request..."
                bg={formBgColor}
                color={textColor}
                resize="vertical"
                minH="120px"
              />
            </FormControl>

            {/* Submit Button */}
            <Button
              type="submit"
              colorScheme="blue"
              w="full"
              isLoading={isSubmitting || loading}
              leftIcon={<Plus size={16} />}
            >
              Submit Leave Request
            </Button>
          </VStack>
        </form>
      </Card>

      {/* Leave Requests List */}
      <Card p={6} bg={bgColor}>
        <Heading size="md" mb={6} color={textColor}>
          <Flex align="center" gap={2}>
            <Calendar size={20} />
            Your Leave Requests
          </Flex>
        </Heading>

        {leaveRequests.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No leave requests yet
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr bg={tableHeaderBg}>
                  <Th color={textColor}>Type</Th>
                  <Th color={textColor}>Start Date</Th>
                  <Th color={textColor}>End Date</Th>
                  <Th color={textColor}>Days</Th>
                  <Th color={textColor}>Status</Th>
                  <Th color={textColor}>Reason</Th>
                </Tr>
              </Thead>
              <Tbody>
                {leaveRequests.map(request => {
                  const start = new Date(request.start_date);
                  const end = new Date(request.end_date);
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <Tr key={request.id} borderBottomColor={rowBorderColor}>
                      <Td color={textColor}>
                        {LEAVE_TYPES.find(t => t.value === request.leave_type)?.label}
                      </Td>
                      <Td color={textColor}>
                        {start.toLocaleDateString()}
                      </Td>
                      <Td color={textColor}>
                        {end.toLocaleDateString()}
                      </Td>
                      <Td color={textColor}>{days}</Td>
                      <Td>
                        <Badge colorScheme={getStatusBadgeColor(request.status)}>
                          {request.status}
                        </Badge>
                      </Td>
                      <Td color={textColor} fontSize="sm">
                        {request.reason ? request.reason.substring(0, 30) + (request.reason.length > 30 ? '...' : '') : '-'}
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Card>
    </VStack>
  );
};
