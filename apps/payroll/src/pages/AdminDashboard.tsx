import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  Heading,
  Text,
  useColorModeValue,
  Spinner,
  SimpleGrid,
  HStack,
  VStack,
  Icon,
  useDisclosure,
} from "@chakra-ui/react";
import { Plus, Building2 } from "lucide-react";
import { listCompanies, getDashboardOverview } from "../lib/adminService";
import { AdminStats, CompanyForm, AdminCompanyList } from "../components/admin";
import toast from "react-hot-toast";

interface Company {
  id: string;
  name: string;
  brand?: string | null;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logo_url?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  subscription_plan?: string | null;
  subscription_status?: string | null;
  timezone?: string | null;
  currency?: string | null;
  created_at: string | null;
  updated_at: string | null;
  employee_count?: number;
  total_payroll?: number;
  avg_salary?: number;
}

export const AdminDashboard = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    total_companies: 0,
    total_employees: 0,
    total_payroll_this_month: 0,
  });

  const cardBg = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.900", "white");

  const { isOpen, onOpen, onClose } = useDisclosure();

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const companies = await listCompanies();
      setCompanies(companies);

      // Get dashboard statistics
      if (companies && companies.length > 0) {
        try {
          const stats = await getDashboardOverview();
          setDashboardStats(stats);
        } catch (statsError) {
          console.warn("Failed to get dashboard stats:", statsError);
          setDashboardStats({
            total_companies: companies.length,
            total_employees: 0,
            total_payroll_this_month: 0,
          });
        }
      }
    } catch (error: any) {
      console.error("Error fetching companies:", error);
      toast.error(error.message || "Failed to load companies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCompanyCreated = () => {
    onClose();
    setTimeout(() => fetchCompanies(), 500); // Small delay to ensure backend has processed
  };

  return (
    <Box>
      <HStack justify="space-between" mb={8}>
        <Heading color={textColor}>Super Admin Dashboard</Heading>
        <Button
          leftIcon={<Plus size={20} />}
          colorScheme="cyan"
          onClick={onOpen}
        >
          New Company
        </Button>
      </HStack>

      {/* Dashboard Stats */}
      <SimpleGrid columns={{ base: 1, md: 3 }} gap={6} mb={8}>
        <AdminStats
          label="Total Companies"
          value={dashboardStats.total_companies}
          icon={Building2}
          bgColor="cyan"
        />
        <AdminStats
          label="Total Employees"
          value={dashboardStats.total_employees}
          icon={Building2}
          bgColor="blue"
        />
        <AdminStats
          label="Total Payroll (This Month)"
          value={`₱${(dashboardStats.total_payroll_this_month || 0).toLocaleString()}`}
          icon={Building2}
          bgColor="green"
        />
      </SimpleGrid>

      {/* Companies List */}
      <Box
        bg={cardBg}
        p={6}
        rounded="xl"
        shadow="sm"
        borderWidth={1}
        borderColor={borderColor}
      >
        <Heading size="md" mb={6} color={textColor}>
          Companies
        </Heading>

        {loading ? (
          <VStack justify="center" py={8}>
            <Spinner size="lg" color="cyan.500" />
            <Text color={textColor}>Loading companies...</Text>
          </VStack>
        ) : companies.length === 0 ? (
          <VStack justify="center" py={8}>
            <Icon as={Building2} boxSize={12} color="gray.300" />
            <Text color="gray.500" fontSize="lg">
              No companies yet
            </Text>
            <Button colorScheme="cyan" onClick={onOpen}>
              Create your first company
            </Button>
          </VStack>
        ) : (
          <AdminCompanyList companies={companies} onRefresh={fetchCompanies} />
        )}
      </Box>

      {/* Create Company Modal */}
      <CompanyForm
        isOpen={isOpen}
        onClose={onClose}
        onCompanyCreated={handleCompanyCreated}
      />
    </Box>
  );
};
