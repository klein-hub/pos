import {
  Box,
  Heading,
  useColorModeValue,
  Grid,
  Text,
  Flex,
  Button,
  useDisclosure,
  VStack,
} from "@chakra-ui/react";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Table } from "../components/ui/Table";
import { Users, Pencil, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useCompanyContext } from "../hooks/useCompanyContext";
import { useDepartmentStore } from "../store/departmentStore";

export const Departments = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { activeCompanyId } = useCompanyContext();
  const { departments, fetchDepartments } = useDepartmentStore();
  const textColor = useColorModeValue("gray.900", "white");

  useEffect(() => {
    if (activeCompanyId) {
      void fetchDepartments();
    }
  }, [activeCompanyId, fetchDepartments]);

  const headers = ["Department", "Created At", "Updated At", "Actions"];

  const renderRow = (department: any) => [
    department.name,
    department.created_at
      ? new Date(department.created_at).toLocaleDateString()
      : "—",
    department.updated_at
      ? new Date(department.updated_at).toLocaleDateString()
      : "—",
    <Flex gap={2}>
      <Button
        size="sm"
        variant="ghost"
        colorScheme="blue"
        leftIcon={<Pencil size={16} />}
        onClick={onOpen}
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        colorScheme="red"
        leftIcon={<Trash2 size={16} />}
      >
        Delete
      </Button>
    </Flex>,
  ];

  return (
    <Box>
      {!activeCompanyId && (
        <Card p={6} mb={4}>
          <Text color="gray.500">
            Select a company from the sidebar to view departments.
          </Text>
        </Card>
      )}

      <Flex justify="space-between" align="center" mb={8}>
        <Heading size="lg" color={textColor}>
          Departments
        </Heading>
      </Flex>

      <Grid templateColumns="repeat(2, 1fr)" gap={6} mb={8}>
        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="blue.100" rounded="full" mr={4}>
              <Users size={24} color="blue" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Total Departments
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {departments.length}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="green.100" rounded="full" mr={4}>
              <Users size={24} color="green" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Scope
              </Text>
              <Text fontSize="lg" fontWeight="bold" noOfLines={1}>
                {activeCompanyId ? "Selected company" : "No company selected"}
              </Text>
            </Box>
          </Flex>
        </Card>
      </Grid>

      <Card p={6}>
        <Table
          headers={headers}
          data={departments}
          renderRow={renderRow}
          searchable
          searchPlaceholder="Search departments..."
          searchPredicate={(department: any, q: string) => {
            const hay = [department.name, department.created_at, department.updated_at]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          }}
          filterable
          filterOptions={[
            {
              label: "Name",
              value: "name",
              getValue: (department: any) => department.name || "Unknown",
            },
          ]}
          sortable
          sortOptions={[
            {
              label: "Name",
              value: "name",
              getValue: (department: any) => department.name || "",
            },
            {
              label: "Created At",
              value: "created_at",
              getValue: (department: any) => department.created_at || "",
            },
            {
              label: "Updated At",
              value: "updated_at",
              getValue: (department: any) => department.updated_at || "",
            },
          ]}
          defaultSortBy="name"
          defaultSortDirection="asc"
          onAdd={onOpen}
          tableName="Department"
          pagination
          defaultPageSize={10}
          emptySearchMessage="No departments match your search."
        />
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Add Department"
        onSubmit={onClose}
      >
        <VStack spacing={4}>
          <Input label="Department Name" placeholder="Enter department name" />
          <Input label="Department Head" placeholder="Select department head" />
          <Input
            label="Budget"
            type="number"
            placeholder="Enter department budget"
          />
          <Input
            label="Description"
            placeholder="Enter department description"
          />
        </VStack>
      </Modal>
    </Box>
  );
};
