import { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  useColorModeValue,
  Text,
  Badge,
  HStack,
} from "@chakra-ui/react";
import { Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Card } from "../components/ui/Card";
import { TablePagination } from "../components/ui/TablePagination";
import { useEmployeeStore } from "../store/employeeStore";
import { useDepartmentStore } from "../store/departmentStore";
import { useProjectStore } from "../store/projectStore";
import { Table } from "../components/ui/Table";
import { ModuleTabs } from "../components/layout/ModuleTabs";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useCompanyContext } from "../hooks/useCompanyContext";

export const Employees = () => {
  const navigate = useNavigate();
  const { activeCompanyId } = useCompanyContext();

  const [revealedBasePay, setRevealedBasePay] = useState<Set<any>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [paginationState, setPaginationState] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalRows: 0,
  });
  const searchRef = useRef<HTMLInputElement>(null);

  const toggleBasePay = (id: any) => {
    setRevealedBasePay((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const { employees, loading, fetchEmployees, deleteEmployee } =
    useEmployeeStore();
  const { fetchDepartments } = useDepartmentStore();
  const { projects, fetchProjects } = useProjectStore();

  const textColor = useColorModeValue("gray.900", "white");

  useEffect(() => {
    if (activeCompanyId) {
      fetchEmployees();
      fetchDepartments();
      fetchProjects();
    }
  }, [activeCompanyId, fetchEmployees, fetchDepartments, fetchProjects]);

  const handleRefresh = () => {
    fetchEmployees();
    fetchDepartments();
    fetchProjects();
    toast.success("Refreshed");
  };

  const handleDelete = (employee: any) => {
    const name = `${employee.first_name} ${employee.last_name}`;
    toast(
      (t) => (
        <Flex direction="column" gap={2}>
          <Text fontSize="sm">
            Delete <b>{name}</b>?
          </Text>
          <HStack>
            <Button
              size="xs"
              colorScheme="red"
              onClick={async () => {
                toast.dismiss(t.id);
                try {
                  await deleteEmployee(employee.id);
                  toast.success(`${name} deleted`);
                } catch (e: any) {
                  toast.error(e?.message || "Failed to delete");
                }
              }}
            >
              Delete
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => toast.dismiss(t.id)}
            >
              Cancel
            </Button>
          </HStack>
        </Flex>
      ),
      { duration: 6000 },
    );
  };

  // Keyboard shortcuts: `n` = new, `/` = focus search
  useKeyboardShortcuts([
    {
      key: "n",
      handler: () => navigate("/employees/new"),
      description: "New employee",
    },
    {
      key: "/",
      handler: () => searchRef.current?.focus(),
      description: "Focus search",
    },
  ]);

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null) return "₱0.00";
    return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const headers = [
    "Name",
    "Position",
    "Department",
    "Project",
    "Email",
    "Base Pay",
    "Type",
    "Actions",
  ];

  const renderRow = (employee: any) => [
    <Flex align="center">
      <Box>
        <Text fontWeight="medium">{`${employee.first_name} ${employee.last_name}`}</Text>
        <Text fontSize="sm" color="gray.500">
          ID:{" "}
          {typeof employee.id === "string"
            ? employee.id.slice(0, 8)
            : employee.id}
        </Text>
      </Box>
    </Flex>,
    employee.position,
    employee.departments?.name || "—",
    projects.find((p) => p.id === employee.project_id)?.name || "—",
    employee.email,
    <Flex align="center" gap={1}>
      <Text
        fontSize="sm"
        fontFamily="mono"
        color={revealedBasePay.has(employee.id) ? "gray.800" : "gray.400"}
        letterSpacing={revealedBasePay.has(employee.id) ? "normal" : "0.15em"}
      >
        {revealedBasePay.has(employee.id)
          ? formatCurrency(employee.base_pay)
          : "•••••••"}
      </Text>
      <Box
        as="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          toggleBasePay(employee.id);
        }}
        color={revealedBasePay.has(employee.id) ? "cyan.500" : "gray.300"}
        _hover={{ color: "cyan.500" }}
        lineHeight={1}
        ml={1}
      >
        {revealedBasePay.has(employee.id) ? (
          <EyeOff size={13} />
        ) : (
          <Eye size={13} />
        )}
      </Box>
    </Flex>,
    <Badge
      colorScheme={employee.employment_type === "full-time" ? "green" : "blue"}
      rounded="full"
      px={2}
    >
      {employee.employment_type || "N/A"}
    </Badge>,
    <Flex gap={2}>
      <Button
        size="sm"
        variant="ghost"
        colorScheme="blue"
        leftIcon={<Pencil size={16} />}
        onClick={() => navigate(`/employees/${employee.id}`)}
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        colorScheme="red"
        leftIcon={<Trash2 size={16} />}
        onClick={() => handleDelete(employee)}
      >
        Delete
      </Button>
    </Flex>,
  ];

  return (
    <Box>
      <Heading size="lg" color={textColor} mb={4}>
        Employees
      </Heading>

      {!activeCompanyId && (
        <Card p={6} mb={4}>
          <Text color="gray.500">
            Select a company from the sidebar to view employees.
          </Text>
        </Card>
      )}

      <ModuleTabs section="employees" activeTab="list" />

      <Card p={6}>
        <Table
          headers={headers}
          data={employees}
          renderRow={renderRow}
          isLoading={loading}
          searchable
          searchInputRef={searchRef}
          searchPlaceholder="Search employees..."
          searchPredicate={(employee: any, q: string) => {
            const projectName = projects.find(
              (p) => p.id === employee.project_id,
            )?.name;
            const hay = [
              employee.first_name,
              employee.last_name,
              employee.email,
              employee.position,
              employee.departments?.name,
              employee.employment_type,
              projectName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return hay.includes(q);
          }}
          filterable
          filterOptions={[
            {
              label: "Type",
              value: "employment_type",
              getValue: (employee: any) => employee.employment_type || "N/A",
            },
            {
              label: "Department",
              value: "department",
              getValue: (employee: any) =>
                employee.departments?.name || "Unassigned",
            },
            {
              label: "Project",
              value: "project",
              getValue: (employee: any) =>
                projects.find((p) => p.id === employee.project_id)?.name ||
                "Unassigned",
            },
          ]}
          sortable
          sortOptions={[
            {
              label: "Name",
              value: "name",
              getValue: (employee: any) =>
                `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
            },
            {
              label: "Department",
              value: "department",
              getValue: (employee: any) => employee.departments?.name || "",
            },
            {
              label: "Project",
              value: "project",
              getValue: (employee: any) =>
                projects.find((p) => p.id === employee.project_id)?.name || "",
            },
            {
              label: "Created At",
              value: "created_at",
              getValue: (employee: any) => employee.created_at || "",
            },
            {
              label: "Updated At",
              value: "updated_at",
              getValue: (employee: any) => employee.updated_at || "",
            },
          ]}
          defaultSortBy="name"
          defaultSortDirection="asc"
          onRefresh={handleRefresh}
          isRefreshing={loading}
          onAdd={() => navigate("/employees/new")}
          tableName="Employee"
          pagination
          defaultPageSize={10}
          emptyMessage="No employees yet."
          emptySearchMessage="No employees match your search."
          showInternalPagination={false}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onPaginationChange={setPaginationState}
        />
      </Card>

      <TablePagination
        currentPage={paginationState.currentPage}
        onPageChange={setCurrentPage}
        pageSize={paginationState.pageSize}
        onPageSizeChange={setPageSize}
        totalPages={paginationState.totalPages}
        totalRows={paginationState.totalRows}
        isLoading={loading}
      />
    </Box>
  );
};
