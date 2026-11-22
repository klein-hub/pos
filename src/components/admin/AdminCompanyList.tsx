import { useState, useEffect } from "react";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  HStack,
  useColorModeValue,
  Text,
  Flex,
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  useDisclosure,
} from "@chakra-ui/react";
import { MoreVertical, DollarSign, Edit2, Trash2 } from "lucide-react";
import {
  getCompanyStats as getCompanyStatsFromAPI,
  deleteCompany,
} from "../../lib/adminService";
import { CompanyForm } from "./CompanyForm";
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

interface AdminCompanyListProps {
  companies: Company[];
  onRefresh: () => void;
}

interface CompanyStatsRecord {
  total_employees: number;
  total_payroll: number;
  avg_salary: number;
}

export const AdminCompanyList = ({
  companies,
  onRefresh,
}: AdminCompanyListProps) => {
  const [companyStats, setCompanyStats] = useState<
    Record<string, CompanyStatsRecord>
  >({});
  const [loadingStats, setLoadingStats] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const {
    isOpen: isEditModalOpen,
    onOpen: onOpenEditModal,
    onClose: onCloseEditModal,
  } = useDisclosure();

  const textColor = useColorModeValue("gray.900", "white");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const hoverBg = useColorModeValue("gray.50", "gray.700");

  useEffect(() => {
    loadAllStats();
  }, [companies]);

  const loadAllStats = async () => {
    setLoadingStats(true);
    try {
      const stats: Record<string, CompanyStatsRecord> = {};

      for (const company of companies) {
        try {
          // Fetch stats from API
          const data = await getCompanyStatsFromAPI(company.id);
          stats[company.id] = {
            total_employees: data?.total_employees || 0,
            total_payroll: data?.total_payroll_amount || 0,
            avg_salary: data?.average_salary || 0,
          };
        } catch (err) {
          console.warn(`Error loading stats for company ${company.id}:`, err);
          stats[company.id] = {
            total_employees: 0,
            total_payroll: 0,
            avg_salary: 0,
          };
        }
      }

      setCompanyStats(stats);
    } catch (err) {
      console.error("Error loading all stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;

    try {
      await deleteCompany(companyId);
      toast.success("Company deleted successfully");
      onRefresh();
    } catch (err) {
      console.error("Error deleting company:", err);
      toast.error("Failed to delete company");
    }
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    onOpenEditModal();
  };

  const handleCompanyUpdated = () => {
    onCloseEditModal();
    setEditingCompany(null);
    onRefresh();
  };

  const getCompanyStats = (companyId: string): CompanyStatsRecord => {
    return (
      companyStats[companyId] || {
        total_employees: 0,
        total_payroll: 0,
        avg_salary: 0,
      }
    );
  };

  return (
    <>
      <Table size="sm" variant="simple">
        <Thead>
          <Tr borderBottomColor={borderColor}>
            <Th color={textColor} fontWeight="bold">
              Company Name
            </Th>
            <Th color={textColor} fontWeight="bold" isNumeric>
              Employees
            </Th>
            <Th color={textColor} fontWeight="bold" isNumeric>
              Avg Salary
            </Th>
            <Th color={textColor} fontWeight="bold" isNumeric>
              Total Payroll
            </Th>
            <Th color={textColor} fontWeight="bold">
              Created
            </Th>
            <Th color={textColor} fontWeight="bold">
              Actions
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {companies.map((company) => {
            const stats = getCompanyStats(company.id);
            const createdDate = company.created_at
              ? new Date(company.created_at).toLocaleDateString()
              : "-";

            return (
              <Tr
                key={company.id}
                _hover={{ bg: hoverBg }}
                borderBottomColor={borderColor}
              >
                <Td>
                  <Text fontWeight="medium" color={textColor}>
                    {company.name}
                  </Text>
                </Td>
                <Td isNumeric>
                  {loadingStats ? (
                    <Spinner size="sm" />
                  ) : (
                    <Flex align="center" justify="flex-end" gap={2}>
                      <Text>{stats.total_employees || 0}</Text>
                    </Flex>
                  )}
                </Td>
                <Td isNumeric>
                  <Text>
                    ₱
                    {(stats.avg_salary || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </Td>
                <Td isNumeric>
                  <Flex align="center" justify="flex-end" gap={2}>
                    <Icon as={DollarSign} boxSize={4} color="green.500" />
                    <Text>₱{(stats.total_payroll || 0).toLocaleString()}</Text>
                  </Flex>
                </Td>
                <Td>
                  <Text fontSize="sm" color="gray.500">
                    {createdDate}
                  </Text>
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Menu>
                      <MenuButton as={Button} size="sm" variant="ghost">
                        <MoreVertical size={16} />
                      </MenuButton>
                      <MenuList>
                        <MenuItem
                          icon={<Edit2 size={16} />}
                          onClick={() => handleEditCompany(company)}
                        >
                          Edit
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 size={16} />}
                          color="red.500"
                          onClick={() => handleDeleteCompany(company.id)}
                        >
                          Delete
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </HStack>
                </Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>

      <CompanyForm
        isOpen={isEditModalOpen}
        onClose={onCloseEditModal}
        onCompanyCreated={handleCompanyUpdated}
        initialData={editingCompany || undefined}
      />
    </>
  );
};
