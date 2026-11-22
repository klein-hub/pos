import {
  Box,
  Heading,
  useColorModeValue,
  VStack,
  Grid,
  Text,
  Switch,
  Button,
  Divider,
  Badge,
} from "@chakra-ui/react";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../store/authStore";

export const Settings = () => {
  const textColor = useColorModeValue("gray.900", "white");
  const subtleColor = useColorModeValue("gray.600", "gray.300");
  const user = useAuthStore((state) => state.user);
  const userRole = useAuthStore((state) => state.userRole);
  const userCompanies = useAuthStore((state) => state.userCompanies);
  const activeCompanyId = useAuthStore((state) => state.activeCompanyId);
  const activeCompany =
    userCompanies.find((company) => company.id === activeCompanyId) ?? null;

  if (userRole === "employee") {
    return (
      <Box>
        <Heading size="lg" color={textColor} mb={8}>
          Settings
        </Heading>

        <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={8}>
          <Card p={6}>
            <Text fontSize="lg" fontWeight="medium" mb={6}>
              Account
            </Text>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontSize="sm" color={subtleColor} mb={1}>
                  Email
                </Text>
                <Text fontWeight="medium">{user?.email || "—"}</Text>
              </Box>
              <Box>
                <Text fontSize="sm" color={subtleColor} mb={1}>
                  Role
                </Text>
                <Badge colorScheme="blue" rounded="full" px={3}>
                  Employee
                </Badge>
              </Box>
              <Box>
                <Text fontSize="sm" color={subtleColor} mb={1}>
                  Active Company
                </Text>
                <Text fontWeight="medium">
                  {activeCompany?.name || "No company selected"}
                </Text>
              </Box>
            </VStack>
          </Card>

          <Card p={6}>
            <Text fontSize="lg" fontWeight="medium" mb={6}>
              Preferences
            </Text>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2}>Email Notifications</Text>
                <Switch colorScheme="blue" defaultChecked />
              </Box>
              <Divider />
              <Box>
                <Text mb={2}>Payslip Alerts</Text>
                <Switch colorScheme="blue" defaultChecked />
              </Box>
              <Divider />
              <Box>
                <Text fontSize="sm" color={subtleColor}>
                  Company-wide configuration is only available to admin users.
                </Text>
              </Box>
            </VStack>
          </Card>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="lg" color={textColor} mb={8}>
        Settings
      </Heading>

      <Grid templateColumns="repeat(2, 1fr)" gap={8}>
        <VStack align="stretch" spacing={8}>
          <Card p={6}>
            <Text fontSize="lg" fontWeight="medium" mb={6}>
              Company Information
            </Text>
            <VStack spacing={4}>
              <Input label="Company Name" defaultValue="Propel Inc." />
              <Input
                label="Company Address"
                defaultValue="123 Business Ave, Suite 100"
              />
              <Input label="Contact Email" defaultValue="contact@propel.com" />
              <Input label="Phone Number" defaultValue="+1 (555) 123-4567" />
              <Input label="Website" defaultValue="https://propel.com" />
              <Button colorScheme="blue" alignSelf="start">
                Save Changes
              </Button>
            </VStack>
          </Card>

          <Card p={6}>
            <Text fontSize="lg" fontWeight="medium" mb={6}>
              Security Settings
            </Text>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2}>Two-Factor Authentication</Text>
                <Switch colorScheme="blue" />
              </Box>
              <Box>
                <Text mb={2}>Session Timeout (minutes)</Text>
                <Input type="number" defaultValue={30} />
              </Box>
              <Box>
                <Text mb={2}>Password Expiry (days)</Text>
                <Input type="number" defaultValue={90} />
              </Box>
              <Button colorScheme="blue" alignSelf="start">
                Update Security
              </Button>
            </VStack>
          </Card>
        </VStack>

        <VStack align="stretch" spacing={8}>
          <Card p={6}>
            <Text fontSize="lg" fontWeight="medium" mb={6}>
              Notifications
            </Text>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2}>Email Notifications</Text>
                <Switch colorScheme="blue" defaultChecked />
              </Box>
              <Divider />
              <Box>
                <Text mb={2}>New Employee Alerts</Text>
                <Switch colorScheme="blue" defaultChecked />
              </Box>
              <Divider />
              <Box>
                <Text mb={2}>Payroll Processing Alerts</Text>
                <Switch colorScheme="blue" defaultChecked />
              </Box>
              <Divider />
              <Box>
                <Text mb={2}>Project Updates</Text>
                <Switch colorScheme="blue" defaultChecked />
              </Box>
              <Button colorScheme="blue" alignSelf="start">
                Save Preferences
              </Button>
            </VStack>
          </Card>

          <Card p={6}>
            <Text fontSize="lg" fontWeight="medium" mb={6}>
              System Preferences
            </Text>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text mb={2}>Default Language</Text>
                <Input defaultValue="English" />
              </Box>
              <Box>
                <Text mb={2}>Time Zone</Text>
                <Input defaultValue="UTC-8 (Pacific Time)" />
              </Box>
              <Box>
                <Text mb={2}>Date Format</Text>
                <Input defaultValue="MM/DD/YYYY" />
              </Box>
              <Box>
                <Text mb={2}>Currency</Text>
                <Input defaultValue="USD ($)" />
              </Box>
              <Button colorScheme="blue" alignSelf="start">
                Update Preferences
              </Button>
            </VStack>
          </Card>
        </VStack>
      </Grid>
    </Box>
  );
};
