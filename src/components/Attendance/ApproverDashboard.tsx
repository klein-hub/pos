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
  Badge,
  HStack,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  FormControl,
  FormLabel,
  Select,
} from '@chakra-ui/react';
import { Card } from '../ui/Card';
import { CheckCircle, XCircle, Eye, Filter } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAttendance, LeaveRequest } from '../../hooks/useAttendance';

export const ApproverDashboard = ({ companyId, approverId }: { companyId: string; approverId: string }) => {
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { getPendingLeaveRequests, approveLeaveRequest, rejectLeaveRequest, loading } = useAttendance();
  
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.900', 'white');
  const successColor = useColorModeValue('green.50', 'green.900');
  const warningColor = useColorModeValue('yellow.50', 'yellow.900');
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.900');
  const rowBorderColor = useColorModeValue('gray.200', 'gray.700');
  const modalInfoBg = useColorModeValue('gray.50', 'gray.900');

  // Load pending requests
  useEffect(() => {
    const loadRequests = async () => {
      const requests = await getPendingLeaveRequests(companyId);
      setPendingRequests(requests);
    };
    loadRequests();
    const interval = setInterval(loadRequests, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [companyId, getPendingLeaveRequests]);

  const handleOpenModal = (request: LeaveRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setActionType(action);
    setRejectionReason('');
    onOpen();
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      await approveLeaveRequest(selectedRequest.id, approverId);

      toast({
        title: 'Leave Request Approved',
        description: `Leave request from ${selectedRequest.employee_id} has been approved`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reload requests
      const requests = await getPendingLeaveRequests(companyId);
      setPendingRequests(requests);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve';
      toast({
        title: 'Approval Failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    if (!rejectionReason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please provide a reason for rejection',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsProcessing(true);
    try {
      await rejectLeaveRequest(selectedRequest.id, rejectionReason);

      toast({
        title: 'Leave Request Rejected',
        description: `Leave request from ${selectedRequest.employee_id} has been rejected`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      // Reload requests
      const requests = await getPendingLeaveRequests(companyId);
      setPendingRequests(requests);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject';
      toast({
        title: 'Rejection Failed',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
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

  const filteredRequests = pendingRequests.filter(req => 
    filterStatus === 'all' || req.status === filterStatus
  );

  const stats = {
    pending: pendingRequests.filter(r => r.status === 'pending').length,
    approved: pendingRequests.filter(r => r.status === 'approved').length,
    rejected: pendingRequests.filter(r => r.status === 'rejected').length,
  };

  return (
    <VStack spacing={6} align="stretch">
      {/* Stats Cards */}
      <Flex gap={4} flexWrap="wrap">
        <Card p={4} flex="1" minW="150px" bg={warningColor}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Pending</Text>
            <Heading size="lg" color="yellow.600">{stats.pending}</Heading>
          </VStack>
        </Card>

        <Card p={4} flex="1" minW="150px" bg={successColor}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Approved</Text>
            <Heading size="lg" color="green.600">{stats.approved}</Heading>
          </VStack>
        </Card>

        <Card p={4} flex="1" minW="150px" bg={useColorModeValue('red.50', 'red.900')}>
          <VStack align="flex-start" spacing={2}>
            <Text fontSize="sm" color="gray.500">Rejected</Text>
            <Heading size="lg" color="red.600">{stats.rejected}</Heading>
          </VStack>
        </Card>
      </Flex>

      {/* Filter */}
      <Card p={4} bg={bgColor}>
        <Flex align="center" gap={2}>
          <Filter size={18} />
          <Select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            w="auto"
            maxW="200px"
          >
            <option value="pending">Pending Only</option>
            <option value="approved">Approved Only</option>
            <option value="rejected">Rejected Only</option>
            <option value="all">All</option>
          </Select>
        </Flex>
      </Card>

      {/* Requests Table */}
      <Card p={6} bg={bgColor}>
        <Heading size="md" mb={6} color={textColor}>
          Leave Requests
        </Heading>

        {filteredRequests.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No leave requests to review
          </Text>
        ) : (
          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr bg={tableHeaderBg}>
                  <Th color={textColor}>Employee ID</Th>
                  <Th color={textColor}>Leave Type</Th>
                  <Th color={textColor}>Start Date</Th>
                  <Th color={textColor}>End Date</Th>
                  <Th color={textColor}>Days</Th>
                  <Th color={textColor}>Status</Th>
                  <Th color={textColor}>Submitted</Th>
                  <Th color={textColor}>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredRequests.map(request => {
                  const start = new Date(request.start_date);
                  const end = new Date(request.end_date);
                  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  const submitted = new Date(request.created_at).toLocaleDateString();

                  return (
                    <Tr key={request.id} borderBottomColor={rowBorderColor}>
                      <Td color={textColor} fontSize="sm">
                        {request.employee_id}
                      </Td>
                      <Td color={textColor}>{request.leave_type}</Td>
                      <Td color={textColor}>{start.toLocaleDateString()}</Td>
                      <Td color={textColor}>{end.toLocaleDateString()}</Td>
                      <Td color={textColor}>{days}</Td>
                      <Td>
                        <Badge colorScheme={getStatusColor(request.status)}>
                          {request.status}
                        </Badge>
                      </Td>
                      <Td color={textColor} fontSize="sm">{submitted}</Td>
                      <Td>
                        <HStack spacing={2}>
                          {request.status === 'pending' ? (
                            <>
                              <Button
                                size="sm"
                                colorScheme="green"
                                variant="ghost"
                                leftIcon={<CheckCircle size={14} />}
                                onClick={() => handleOpenModal(request, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                colorScheme="red"
                                variant="ghost"
                                leftIcon={<XCircle size={14} />}
                                onClick={() => handleOpenModal(request, 'reject')}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<Eye size={14} />}
                            >
                              View
                            </Button>
                          )}
                        </HStack>
                      </Td>
                    </Tr>
                  );
                })}
              </Tbody>
            </Table>
          </Box>
        )}
      </Card>

      {/* Action Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {actionType === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
          </ModalHeader>
          <ModalBody>
            {selectedRequest && (
              <VStack spacing={4}>
                <Box p={4} bg={modalInfoBg} rounded="md" w="full">
                  <VStack align="flex-start" spacing={2}>
                    <HStack justify="space-between" w="full">
                      <Text fontSize="sm" color="gray.500">Employee ID:</Text>
                      <Text fontWeight="bold" color={textColor}>{selectedRequest.employee_id}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text fontSize="sm" color="gray.500">Leave Type:</Text>
                      <Text fontWeight="bold" color={textColor}>{selectedRequest.leave_type}</Text>
                    </HStack>
                    <HStack justify="space-between" w="full">
                      <Text fontSize="sm" color="gray.500">Period:</Text>
                      <Text fontWeight="bold" color={textColor}>
                        {new Date(selectedRequest.start_date).toLocaleDateString()} - {new Date(selectedRequest.end_date).toLocaleDateString()}
                      </Text>
                    </HStack>
                    {selectedRequest.reason && (
                      <Box w="full">
                        <Text fontSize="sm" color="gray.500" mb={1}>Reason:</Text>
                        <Text fontSize="sm" color={textColor}>{selectedRequest.reason}</Text>
                      </Box>
                    )}
                  </VStack>
                </Box>

                {actionType === 'reject' && (
                  <FormControl>
                    <FormLabel color={textColor}>Rejection Reason</FormLabel>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide a reason for rejecting this leave request..."
                      minH="120px"
                    />
                  </FormControl>
                )}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button 
              colorScheme={actionType === 'approve' ? 'green' : 'red'}
              isLoading={isProcessing || loading}
              onClick={actionType === 'approve' ? handleApprove : handleReject}
            >
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
};
