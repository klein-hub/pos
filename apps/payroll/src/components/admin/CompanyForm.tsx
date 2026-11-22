import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  SimpleGrid,
  useColorModeValue,
  Spinner,
  Flex,
  Text,
  HStack,
  Checkbox,
  Divider,
  Box,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import {
  createCompany,
  updateCompany,
  type Company,
} from "../../lib/adminService";
import { supabase } from "../../lib/supabase";
import toast from "react-hot-toast";

type CompanyFormValues = {
  name: string;
  brand: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  logo_url: string;
  address: string;
  city: string;
  country: string;
  subscription_plan: string;
  subscription_status: string;
  timezone: string;
  currency: string;
};

const emptyFormValues: CompanyFormValues = {
  name: "",
  brand: "",
  slug: "",
  email: "",
  phone: "",
  website: "",
  logo_url: "",
  address: "",
  city: "",
  country: "",
  subscription_plan: "",
  subscription_status: "",
  timezone: "",
  currency: "",
};

const toFormValues = (initialData?: Partial<Company>): CompanyFormValues => ({
  name: initialData?.name || "",
  brand: initialData?.brand || "",
  slug: initialData?.slug || "",
  email: initialData?.email || "",
  phone: initialData?.phone || "",
  website: initialData?.website || "",
  logo_url: initialData?.logo_url || "",
  address: initialData?.address || "",
  city: initialData?.city || "",
  country: initialData?.country || "",
  subscription_plan: initialData?.subscription_plan || "",
  subscription_status: initialData?.subscription_status || "",
  timezone: initialData?.timezone || "",
  currency: initialData?.currency || "",
});

type EmployeeOption = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_id: string | null;
};

interface CompanyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated: () => void;
  initialData?: Partial<Company> & { id: string };
}

export const CompanyForm = ({
  isOpen,
  onClose,
  onCompanyCreated,
  initialData,
}: CompanyFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<CompanyFormValues>(
    toFormValues(initialData),
  );
  const [loading, setLoading] = useState(false);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const bgColor = useColorModeValue("white", "gray.800");
  const employeeListBorderColor = useColorModeValue("gray.200", "gray.700");

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((employee) =>
      [employee.first_name, employee.last_name, employee.email]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [employeeSearch, employees]);

  useEffect(() => {
    if (isOpen) {
      setFormData(toFormValues(initialData));
      setError("");
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!isOpen) return;

      setEmployeesLoading(true);
      const { data, error: employeesError } = await supabase
        .from("employees")
        .select("id, first_name, last_name, email, company_id")
        .order("first_name", { ascending: true });

      if (employeesError) {
        setEmployeesLoading(false);
        setError(employeesError.message || "Failed to load employees");
        return;
      }

      const list = ((data || []) as EmployeeOption[]).map((employee) => ({
        ...employee,
        first_name: employee.first_name || "",
        last_name: employee.last_name || "",
        email: employee.email || "",
      }));

      setEmployees(list);

      if (initialData?.id) {
        setSelectedEmployeeIds(
          list
            .filter((employee) => employee.company_id === initialData.id)
            .map((employee) => employee.id),
        );
      } else {
        setSelectedEmployeeIds([]);
      }

      setEmployeesLoading(false);
    };

    loadEmployees();
  }, [initialData?.id, isOpen]);

  const toggleEmployeeSelection = (employeeId: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  };

  const handleCreateEmployee = () => {
    const query = new URLSearchParams({
      returnTo: "/admin",
      returnLabel: "Company List",
    });

    if (initialData?.id) {
      query.set("companyId", initialData.id);
    }

    onClose();
    navigate(`/employees/new?${query.toString()}`);
  };

  const handleFieldChange = (field: keyof CompanyFormValues, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Company name is required");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: formData.name,
        brand: formData.brand || formData.name,
        slug: formData.slug,
        email: formData.email,
        phone: formData.phone,
        website: formData.website,
        logo_url: formData.logo_url,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        subscription_plan: formData.subscription_plan,
        subscription_status: formData.subscription_status,
        timezone: formData.timezone,
        currency: formData.currency,
      };

      const savedCompany = initialData?.id
        ? await updateCompany(initialData.id, payload)
        : await createCompany(payload);

      const companyId = savedCompany.id;
      const currentAssignedIds = employees
        .filter((employee) => employee.company_id === companyId)
        .map((employee) => employee.id);

      const idsToAssign = selectedEmployeeIds.filter(
        (id) => !currentAssignedIds.includes(id),
      );
      const idsToUnassign = currentAssignedIds.filter(
        (id) => !selectedEmployeeIds.includes(id),
      );

      if (idsToAssign.length > 0) {
        const { error: assignError } = await supabase
          .from("employees")
          .update({ company_id: companyId })
          .in("id", idsToAssign);

        if (assignError) throw assignError;
      }

      if (idsToUnassign.length > 0) {
        const { error: unassignError } = await supabase
          .from("employees")
          .update({ company_id: null })
          .in("id", idsToUnassign);

        if (unassignError) throw unassignError;
      }

      toast.success(
        initialData?.id
          ? "Company updated successfully"
          : "Company created successfully",
      );

      setFormData(emptyFormValues);
      onCompanyCreated();
    } catch (err) {
      console.error("Error saving company:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save company";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData(toFormValues(initialData));
    setEmployeeSearch("");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="3xl">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent bg={bgColor}>
        <ModalHeader>
          {initialData ? "Edit Company" : "Create New Company"}
        </ModalHeader>
        <ModalCloseButton isDisabled={loading} />

        <form onSubmit={handleSubmit}>
          <ModalBody>
            <VStack spacing={5} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Company Name</FormLabel>
                  <Input
                    type="text"
                    placeholder="e.g., Pristine Energy"
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    isDisabled={loading}
                    autoFocus
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Brand</FormLabel>
                  <Input
                    type="text"
                    placeholder="Brand name"
                    value={formData.brand}
                    onChange={(e) => handleFieldChange("brand", e.target.value)}
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Slug</FormLabel>
                  <Input
                    type="text"
                    placeholder="pristine-energy"
                    value={formData.slug}
                    onChange={(e) => handleFieldChange("slug", e.target.value)}
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    placeholder="company@example.com"
                    value={formData.email}
                    onChange={(e) => handleFieldChange("email", e.target.value)}
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Phone</FormLabel>
                  <Input
                    type="text"
                    placeholder="+63..."
                    value={formData.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Website</FormLabel>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={formData.website}
                    onChange={(e) =>
                      handleFieldChange("website", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Logo URL</FormLabel>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={formData.logo_url}
                    onChange={(e) =>
                      handleFieldChange("logo_url", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Address</FormLabel>
                  <Input
                    type="text"
                    placeholder="Street address"
                    value={formData.address}
                    onChange={(e) =>
                      handleFieldChange("address", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>City</FormLabel>
                  <Input
                    type="text"
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Country</FormLabel>
                  <Input
                    type="text"
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) =>
                      handleFieldChange("country", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Subscription Plan</FormLabel>
                  <Input
                    type="text"
                    placeholder="starter, pro, enterprise"
                    value={formData.subscription_plan}
                    onChange={(e) =>
                      handleFieldChange("subscription_plan", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Subscription Status</FormLabel>
                  <Input
                    type="text"
                    placeholder="active, canceled, trial"
                    value={formData.subscription_status}
                    onChange={(e) =>
                      handleFieldChange("subscription_status", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Timezone</FormLabel>
                  <Input
                    type="text"
                    placeholder="Asia/Manila"
                    value={formData.timezone}
                    onChange={(e) =>
                      handleFieldChange("timezone", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Currency</FormLabel>
                  <Input
                    type="text"
                    placeholder="PHP"
                    value={formData.currency}
                    onChange={(e) =>
                      handleFieldChange("currency", e.target.value)
                    }
                    isDisabled={loading}
                  />
                </FormControl>
              </SimpleGrid>

              <Divider />

              <Box>
                <Flex justify="space-between" align="center" mb={3} gap={3}>
                  <Text fontSize="sm" fontWeight="semibold">
                    Add Employees
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    colorScheme="cyan"
                    onClick={handleCreateEmployee}
                    isDisabled={loading}
                  >
                    Create New Employee
                  </Button>
                </Flex>

                <HStack spacing={3} mb={3}>
                  <Input
                    placeholder="Search employees by name or email"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    isDisabled={loading || employeesLoading}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEmployeeSearch("")}
                    isDisabled={loading || employeesLoading || !employeeSearch}
                  >
                    Clear
                  </Button>
                </HStack>

                <Box
                  maxH="220px"
                  overflowY="auto"
                  border="1px solid"
                  borderColor={employeeListBorderColor}
                  borderRadius="md"
                  p={3}
                >
                  {employeesLoading ? (
                    <Flex justify="center" py={6}>
                      <Spinner size="sm" />
                    </Flex>
                  ) : filteredEmployees.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      No employees found.
                    </Text>
                  ) : (
                    <VStack align="stretch" spacing={2}>
                      {filteredEmployees.map((employee) => {
                        const isSelected = selectedEmployeeIds.includes(
                          employee.id,
                        );
                        const fullName =
                          `${employee.first_name} ${employee.last_name}`.trim() ||
                          employee.email;

                        return (
                          <Checkbox
                            key={employee.id}
                            isChecked={isSelected}
                            onChange={() =>
                              toggleEmployeeSelection(employee.id)
                            }
                            isDisabled={loading}
                          >
                            <Text fontSize="sm">{fullName}</Text>
                            <Text fontSize="xs" color="gray.500">
                              {employee.email}
                            </Text>
                          </Checkbox>
                        );
                      })}
                    </VStack>
                  )}
                </Box>

                <Text fontSize="xs" color="gray.500" mt={2}>
                  Selected: {selectedEmployeeIds.length}
                </Text>
              </Box>

              {!!error && (
                <Text fontSize="sm" color="red.500">
                  {error}
                </Text>
              )}
            </VStack>
          </ModalBody>

          <ModalFooter>
            <Flex gap={3}>
              <Button
                variant="ghost"
                onClick={handleClose}
                isDisabled={loading}
              >
                Cancel
              </Button>
              <Button
                colorScheme="cyan"
                type="submit"
                isDisabled={loading || !formData.name.trim()}
                display="flex"
                alignItems="center"
                gap={2}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Saving...
                  </>
                ) : initialData ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </Flex>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
