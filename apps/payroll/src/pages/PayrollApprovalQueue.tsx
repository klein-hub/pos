import { useState, useEffect } from "react";
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  Spinner,
  Textarea,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Stat,
  StatLabel,
  StatNumber,
} from "@chakra-ui/react";
import { supabase } from "../lib/supabase";
import { useCompanyContext } from "../hooks/useCompanyContext";
import { Check, X } from "lucide-react";

interface PayrollRecord {
  id: string;
  employee_id: string;
  employee?: { first_name: string; last_name: string };
  month: number;
  year: number;
  gross_salary: number;
  net_salary: number;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  created_at: string;
}

export function PayrollApprovalQueue() {
  const { activeCompanyId } = useCompanyContext();
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  useEffect(() => {
    fetchPendingPayrolls();
  }, [activeCompanyId]);

  const fetchPendingPayrolls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("payroll_records")
        .select("*, employee(first_name, last_name)")
        .eq("company_id", activeCompanyId)
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayrolls(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading payrolls",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payroll: PayrollRecord) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update payroll status
      const { error } = await supabase
        .from("payroll_records")
        .update({
          status: "approved",
          approver_id: user.id,
          approval_date: new Date().toISOString(),
        })
        .eq("id", payroll.id)
        .eq("company_id", activeCompanyId);

      if (error) throw error;

      toast({
        title: "Payroll approved",
        description: `Payroll for ${payroll.employee?.first_name} approved successfully`,
        status: "success",
        duration: 3000,
      });

      // Refresh list
      fetchPendingPayrolls();
    } catch (error: any) {
      toast({
        title: "Error approving payroll",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    }
  };

  const handleReject = async () => {
    if (!selectedPayroll || !rejectionReason.trim()) {
      toast({
        title: "Validation error",
        description: "Please provide a rejection reason",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("payroll_records")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason,
        })
        .eq("id", selectedPayroll.id)
        .eq("company_id", activeCompanyId);

      if (error) throw error;

      toast({
        title: "Payroll rejected",
        description: `Payroll for ${selectedPayroll.employee?.first_name} has been rejected`,
        status: "info",
        duration: 3000,
      });

      setRejectionReason("");
      onClose();
      fetchPendingPayrolls();
    } catch (error: any) {
      toast({
        title: "Error rejecting payroll",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    }
  };

  const pendingCount = payrolls.length;
  const totalAmount = payrolls.reduce((sum, p) => sum + p.gross_salary, 0);

  if (!activeCompanyId) {
    return (
      <Container maxW="6xl" py={8}>
        <Text color="gray.500">
          Please select a company to view payroll approvals.
        </Text>
      </Container>
    );
  }

  return (
    <Container maxW="6xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading as="h1" size="xl" mb={2}>
            Payroll Approval Queue
          </Heading>
          <Text color="gray.600">
            Review and approve pending payroll records
          </Text>
        </Box>

        {/* Summary Cards */}
        <HStack spacing={4} wrap="wrap">
          <Card flex="1" minW="200px">
            <CardBody>
              <Stat>
                <StatLabel>Pending Approvals</StatLabel>
                <StatNumber color="orange.500">{pendingCount}</StatNumber>
              </Stat>
            </CardBody>
          </Card>
          <Card flex="1" minW="200px">
            <CardBody>
              <Stat>
                <StatLabel>Total Gross Salary</StatLabel>
                <StatNumber color="blue.500">
                  ₱{totalAmount.toLocaleString()}
                </StatNumber>
              </Stat>
            </CardBody>
          </Card>
        </HStack>

        {/* Content */}
        {loading ? (
          <HStack justify="center" py={8}>
            <Spinner size="lg" color="blue.500" />
          </HStack>
        ) : pendingCount === 0 ? (
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>No pending approvals</AlertTitle>
              <AlertDescription>
                All payroll records have been reviewed
              </AlertDescription>
            </Box>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <Heading size="md">Pending Payroll Records</Heading>
            </CardHeader>
            <CardBody overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th>Employee</Th>
                    <Th>Month/Year</Th>
                    <Th isNumeric>Gross Salary</Th>
                    <Th isNumeric>Net Salary</Th>
                    <Th>Submitted</Th>
                    <Th>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {payrolls.map((payroll) => (
                    <Tr key={payroll.id}>
                      <Td fontWeight="medium">
                        {payroll.employee?.first_name}{" "}
                        {payroll.employee?.last_name}
                      </Td>
                      <Td>
                        {payroll.month}/{payroll.year}
                      </Td>
                      <Td isNumeric>
                        ₱{payroll.gross_salary.toLocaleString()}
                      </Td>
                      <Td isNumeric>₱{payroll.net_salary.toLocaleString()}</Td>
                      <Td fontSize="sm" color="gray.600">
                        {new Date(payroll.created_at).toLocaleDateString()}
                      </Td>
                      <Td>
                        <HStack spacing={2}>
                          <Button
                            size="sm"
                            colorScheme="green"
                            leftIcon={<Check size={16} />}
                            onClick={() => handleApprove(payroll)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            colorScheme="red"
                            variant="outline"
                            leftIcon={<X size={16} />}
                            onClick={() => {
                              setSelectedPayroll(payroll);
                              onOpen();
                            }}
                          >
                            Reject
                          </Button>
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </CardBody>
          </Card>
        )}
      </VStack>

      {/* Rejection Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Reject Payroll</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedPayroll && (
              <VStack spacing={4}>
                <Text>
                  Are you sure you want to reject payroll for{" "}
                  <strong>
                    {selectedPayroll.employee?.first_name}{" "}
                    {selectedPayroll.employee?.last_name}
                  </strong>
                  ?
                </Text>
                <Textarea
                  placeholder="Reason for rejection (required)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack spacing={2}>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleReject}>
                Reject
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
