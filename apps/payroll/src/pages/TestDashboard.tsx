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
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Code,
  useToast,
} from "@chakra-ui/react";
import { CheckCircle, AlertCircle, Info } from "lucide-react";
import {
  validateTestSetup,
  testCompanyIsolation,
  logTestCredentials,
  TEST_USERS,
} from "../utils/testDataSeeder";
import { supabase } from "../lib/supabase";

export function TestDashboard() {
  const [loading, setLoading] = useState(false);
  const [setupValidation, setSetupValidation] = useState<any>(null);
  const [isolationTest, setIsolationTest] = useState<any>(null);
  const toast = useToast();

  const handleValidateSetup = async () => {
    setLoading(true);
    try {
      const result = await validateTestSetup();
      setSetupValidation(result);
      toast({
        title: result.success ? "Validation passed" : "Validation failed",
        status: result.success ? "success" : "error",
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestIsolation = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Not authenticated",
          status: "error",
          duration: 5000,
        });
        return;
      }

      const result = await testCompanyIsolation(user.id);
      setIsolationTest(result);
      toast({
        title: result.success ? "Test completed" : "Test failed",
        status: result.success ? "success" : "error",
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogCredentials = () => {
    logTestCredentials();
    toast({
      title: "Credentials logged to console",
      status: "info",
      duration: 3000,
    });
  };

  return (
    <Container maxW="4xl" py={8}>
      <VStack spacing={8} align="stretch">
        <Box>
          <Heading as="h1" size="xl" mb={2}>
            Payroll System - Testing & Validation
          </Heading>
          <Text color="gray.600">
            Validate test setup, company isolation, and integration tests
          </Text>
        </Box>

        <Tabs>
          <TabList>
            <Tab>Setup Validation</Tab>
            <Tab>Company Isolation</Tab>
            <Tab>Test Credentials</Tab>
            <Tab>Integration Tests</Tab>
          </TabList>

          <TabPanels>
            {/* Setup Validation Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">Validate Test Setup</Heading>
                  </CardHeader>
                  <CardBody>
                    <Text mb={4}>
                      Check if the Pristine Energy company is properly set up
                      with test data
                    </Text>
                    <Button
                      colorScheme="blue"
                      onClick={handleValidateSetup}
                      isLoading={loading}
                    >
                      Run Validation
                    </Button>
                  </CardBody>
                </Card>

                {setupValidation && (
                  <Alert
                    status={setupValidation.success ? "success" : "error"}
                    borderRadius="md"
                  >
                    <AlertIcon />
                    <Box>
                      <AlertTitle>{setupValidation.message}</AlertTitle>
                      {setupValidation.details && (
                        <AlertDescription fontSize="sm" mt={2}>
                          <Text>
                            Company: {setupValidation.details.company}
                          </Text>
                        </AlertDescription>
                      )}
                    </Box>
                  </Alert>
                )}
              </VStack>
            </TabPanel>

            {/* Company Isolation Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">Test Company Isolation (RLS)</Heading>
                  </CardHeader>
                  <CardBody>
                    <Text mb={4}>
                      Verify that Row-Level Security (RLS) policies correctly
                      isolate companies
                    </Text>
                    <Button
                      colorScheme="blue"
                      onClick={handleTestIsolation}
                      isLoading={loading}
                    >
                      Run Isolation Test
                    </Button>
                  </CardBody>
                </Card>

                {isolationTest && (
                  <>
                    <Alert
                      status={isolationTest.success ? "success" : "error"}
                      borderRadius="md"
                    >
                      <AlertIcon />
                      <AlertTitle>{isolationTest.message}</AlertTitle>
                    </Alert>

                    {isolationTest.tests && (
                      <Card>
                        <CardBody>
                          <VStack align="stretch" spacing={2}>
                            {isolationTest.tests.details.map(
                              (detail: string, idx: number) => (
                                <HStack key={idx} spacing={2}>
                                  {detail.startsWith("✓") ? (
                                    <CheckCircle size={18} color="green" />
                                  ) : (
                                    <AlertCircle size={18} color="red" />
                                  )}
                                  <Text fontSize="sm">{detail}</Text>
                                </HStack>
                              ),
                            )}
                          </VStack>
                        </CardBody>
                      </Card>
                    )}
                  </>
                )}
              </VStack>
            </TabPanel>

            {/* Test Credentials Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Card>
                  <CardHeader>
                    <Heading size="md">Test User Credentials</Heading>
                  </CardHeader>
                  <CardBody>
                    <Text mb={4}>
                      Use these credentials to test different user roles
                    </Text>
                    <Button
                      colorScheme="green"
                      mb={4}
                      onClick={handleLogCredentials}
                    >
                      Log to Console
                    </Button>

                    <Table variant="simple" size="sm">
                      <Thead>
                        <Tr>
                          <Th>Email</Th>
                          <Th>Role</Th>
                          <Th>Description</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {TEST_USERS.map((user, idx) => (
                          <Tr key={idx}>
                            <Td>
                              <Code fontSize="xs">{user.email}</Code>
                            </Td>
                            <Td>
                              <Badge colorScheme="blue">{user.role}</Badge>
                            </Td>
                            <Td fontSize="sm">{user.description}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>

                    <Box
                      mt={4}
                      p={4}
                      bg="yellow.50"
                      borderRadius="md"
                      borderLeft="4px solid #FBD38D"
                    >
                      <HStack spacing={2}>
                        <Info size={18} color="orange" />
                        <Text fontSize="sm">
                          Note: These users must be created in Supabase Auth
                          before testing. Use /register page or Supabase
                          dashboard.
                        </Text>
                      </HStack>
                    </Box>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>

            {/* Integration Tests Tab */}
            <TabPanel>
              <VStack spacing={4} align="stretch">
                <Alert status="info" borderRadius="md">
                  <AlertIcon />
                  <Box>
                    <AlertTitle>Integration Tests Coming Soon</AlertTitle>
                    <AlertDescription>
                      End-to-end tests for: login → company selection → payroll
                      generation → payslip viewing
                    </AlertDescription>
                  </Box>
                </Alert>

                <Card>
                  <CardHeader>
                    <Heading size="md">Test Checklist</Heading>
                  </CardHeader>
                  <CardBody>
                    <VStack align="stretch" spacing={2}>
                      <Box as="label">
                        <input type="checkbox" defaultChecked disabled />
                        <Text as="span" ml={2}>
                          ✓ Super Admin can create companies
                        </Text>
                      </Box>
                      <Box as="label">
                        <input type="checkbox" defaultChecked disabled />
                        <Text as="span" ml={2}>
                          ✓ Admin can manage employees
                        </Text>
                      </Box>
                      <Box as="label">
                        <input type="checkbox" defaultChecked disabled />
                        <Text as="span" ml={2}>
                          ✓ Employee can view own payslip
                        </Text>
                      </Box>
                      <Box as="label">
                        <input type="checkbox" disabled />
                        <Text as="span" ml={2}>
                          [ ] Employees cannot see other companies' data
                        </Text>
                      </Box>
                      <Box as="label">
                        <input type="checkbox" disabled />
                        <Text as="span" ml={2}>
                          [ ] Payroll calculation is accurate
                        </Text>
                      </Box>
                    </VStack>
                  </CardBody>
                </Card>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
}
