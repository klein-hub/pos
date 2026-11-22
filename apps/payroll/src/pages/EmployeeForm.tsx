import { useState, useEffect, useCallback } from "react";
import { useEditableRecord } from "../hooks/useEditableRecord";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Box,
  Flex,
  Text,
  Button,
  FormControl,
  Select,
  VStack,
  HStack,
  Divider,
  useColorModeValue,
  Spinner,
  Center,
  Grid,
  GridItem,
  IconButton,
  Checkbox,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import {
  Save,
  X,
  Mail,
  Briefcase,
  Building2,
  FolderKanban,
  DollarSign,
  UserCheck,
  PlusCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Input } from "../components/ui/Input";
import { useEmployeeStore } from "../store/employeeStore";
import { useDepartmentStore } from "../store/departmentStore";
import { useProjectStore } from "../store/projectStore";
import { BankAccountModal } from "../components/employee/BankAccountModal";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

interface EmployeeFormData {
  auth_user_id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string;
  account_email: string;
  account_password: string;
  account_role_id: string;
  position: string;
  department_id: string;
  project_id: string;
  pay_group_id: string;
  base_pay: string;
  employment_type: string;
  // Personal
  private_email: string;
  private_phone: string;
  birthday: string;
  place_of_birth: string;
  country_of_birth: string;
  gender: string;
  nationality: string;
  identification_no: string;
  passport_no: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  private_street: string;
  private_street2: string;
  private_city: string;
  private_state: string;
  private_zip: string;
  private_country: string;
  visa_no: string;
  work_permit_no: string;
}

const emptyForm: EmployeeFormData = {
  auth_user_id: "",
  company_id: "",
  first_name: "",
  last_name: "",
  email: "",
  account_email: "",
  account_password: "",
  account_role_id: "",
  position: "",
  department_id: "",
  project_id: "",
  pay_group_id: "",
  base_pay: "",
  employment_type: "full-time",
  private_email: "",
  private_phone: "",
  birthday: "",
  place_of_birth: "",
  country_of_birth: "",
  gender: "",
  nationality: "",
  identification_no: "",
  passport_no: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  private_street: "",
  private_street2: "",
  private_city: "",
  private_state: "",
  private_zip: "",
  private_country: "",
  visa_no: "",
  work_permit_no: "",
};

type TabKey = "work" | "personal" | "employment" | "payroll" | "credentials";

const tabs: { key: TabKey; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "employment", label: "Employment" },
  { key: "payroll", label: "Payroll" },
  { key: "credentials", label: "Credentials" },
];

const getInitials = (first: string, last: string) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const getScheduleLabel = (schedule?: string | null) => {
  switch ((schedule || "monthly").trim().toLowerCase()) {
    case "weekly":
      return "Weekly";
    case "bi_weekly":
    case "bi-weekly":
      return "Bi-weekly";
    case "semi_monthly":
    case "semi-monthly":
      return "Semi-monthly";
    case "monthly":
    default:
      return "Monthly";
  }
};

interface PayGroupOption {
  id: number;
  name: string;
  pay_schedule: string | null;
  description: string | null;
}

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

const avatarColors = [
  "#e67e22",
  "#e74c3c",
  "#2ecc71",
  "#3498db",
  "#1abc9c",
  "#f39c12",
  "#d35400",
  "#27ae60",
  "#2980b9",
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

export const EmployeeForm = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const [form, setForm] = useState<EmployeeFormData>(emptyForm);
  const [activeTab, setActiveTab] = useState<TabKey>("work");
  const [saving, setSaving] = useState(false);
  // Snapshot of the employees-table record used for diff-only updates.
  // Updated once after the employee loads; stays null for new records.
  const [employeeSnapshot, setEmployeeSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
  const editableRecord = useEditableRecord(
    "employees",
    (employeeSnapshot ?? { id: id ?? "" }) as Record<string, unknown>,
  );
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<any | null>(null);
  const [payGroups, setPayGroups] = useState<PayGroupOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [createUserAccount, setCreateUserAccount] = useState(false);
  const [isTemporaryPassword, setIsTemporaryPassword] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null,
  );
  const [userCreationError, setUserCreationError] = useState<string | null>(
    null,
  );
  const {
    isOpen: isPasswordModalOpen,
    onOpen: onOpenPasswordModal,
    onClose: onClosePasswordModal,
  } = useDisclosure();

  const { employees, loading, fetchEmployees } = useEmployeeStore();
  const { departments, fetchDepartments } = useDepartmentStore();
  const { projects, fetchProjects } = useProjectStore();
  const {
    userRole,
    userCompanies,
    activeCompanyId,
    register,
    updateUserAccount,
  } = useAuthStore();
  const isSuperAdmin = userRole === "super_admin";
  const searchParams = new URLSearchParams(location.search);
  const presetCompanyId = searchParams.get("companyId");
  const returnToParam = searchParams.get("returnTo");
  const breadcrumbReturnPath =
    returnToParam && returnToParam.startsWith("/")
      ? returnToParam
      : "/employees";

  const bgCard = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.900", "white");
  const subTextColor = useColorModeValue("gray.500", "gray.400");
  const labelColor = useColorModeValue("gray.600", "gray.300");
  const sectionHeadingColor = useColorModeValue("gray.500", "gray.400");
  const selectBg = useColorModeValue("white", "gray.700");
  const selectBorder = useColorModeValue("gray.200", "gray.600");
  const tabActiveBorder = useColorModeValue("blue.500", "blue.400");
  const tabActiveColor = useColorModeValue("blue.600", "blue.300");
  const tabInactiveColor = useColorModeValue("gray.500", "gray.400");
  const tabHoverBg = useColorModeValue("gray.50", "gray.700");
  const passwordPreviewBg = useColorModeValue("gray.100", "gray.700");

  useEffect(() => {
    if (!departments.length) fetchDepartments();
    if (!projects.length) fetchProjects();
    if (!isNew && !employees.length) fetchEmployees();
  }, []);

  useEffect(() => {
    if (!isNew) return;
    if (form.company_id) return;

    if (
      isSuperAdmin &&
      presetCompanyId &&
      userCompanies.some((c) => c.id === presetCompanyId)
    ) {
      setForm((prev) => ({ ...prev, company_id: presetCompanyId }));
      return;
    }

    if (isSuperAdmin && userCompanies.length === 1) {
      setForm((prev) => ({ ...prev, company_id: userCompanies[0].id }));
      return;
    }

    if (activeCompanyId) {
      setForm((prev) => ({ ...prev, company_id: activeCompanyId }));
    }
  }, [
    activeCompanyId,
    form.company_id,
    isNew,
    isSuperAdmin,
    presetCompanyId,
    userCompanies,
  ]);

  useEffect(() => {
    const loadPayGroups = async () => {
      const { data } = await supabase
        .from("pay_groups")
        .select("id,name,pay_schedule,description")
        .eq("active", true)
        .order("name");

      setPayGroups((data as PayGroupOption[]) || []);
    };

    loadPayGroups();
  }, []);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setRoles([]);
      setRolesLoading(false);
      setUserCreationError(
        "You must be signed in before loading roles. Please refresh and sign in again.",
      );
      return;
    }

    const { data, error } = await supabase
      .from("roles")
      .select("id,name,description")
      .order("name", { ascending: true });

    if (error) {
      setRoles([]);
      setUserCreationError(
        `Unable to load roles from Supabase: ${error.message}`,
      );
      setRolesLoading(false);
      return;
    }

    setRoles((data as RoleOption[]) || []);
    if ((data?.length || 0) === 0) {
      setUserCreationError(
        "No roles found in Supabase roles table. Run role seed/migration and retry.",
      );
    } else {
      setUserCreationError(null);
    }
    setRolesLoading(false);
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    if (!createUserAccount) return;
    if (roles.length > 0) return;
    loadRoles();
  }, [createUserAccount, roles.length, loadRoles]);

  useEffect(() => {
    if (!roles.length || form.account_role_id) return;

    const defaultRole = roles.find((role) => role.name === "user");

    if (defaultRole?.id) {
      setForm((prev) => ({ ...prev, account_role_id: defaultRole.id }));
    }
  }, [roles, form.account_role_id]);

  useEffect(() => {
    if (!isNew && employees.length) {
      const emp = employees.find((e) => String(e.id) === id) as any;
      if (emp) {
        const mapped = {
          auth_user_id: emp.auth_user_id || "",
          company_id: emp.company_id || "",
          first_name: emp.first_name || "",
          last_name: emp.last_name || "",
          email: emp.email || "",
          account_email: emp.email || "",
          account_password: "",
          account_role_id: "",
          position: emp.position || "",
          department_id: emp.department_id ? String(emp.department_id) : "",
          project_id: emp.project_id ? String(emp.project_id) : "",
          pay_group_id: emp.pay_group_id ? String(emp.pay_group_id) : "",
          base_pay: emp.base_pay != null ? String(emp.base_pay) : "",
          employment_type: emp.employment_type || "full-time",
          private_email: emp.private_email || "",
          private_phone: emp.private_phone || "",
          birthday: emp.birthday || "",
          place_of_birth: emp.place_of_birth || "",
          country_of_birth: emp.country_of_birth || "",
          gender: emp.gender || "",
          nationality: emp.nationality || "",
          identification_no: emp.identification_no || "",
          passport_no: emp.passport_no || "",
          emergency_contact_name: emp.emergency_contact_name || "",
          emergency_contact_phone: emp.emergency_contact_phone || "",
          private_street: emp.private_street || "",
          private_street2: emp.private_street2 || "",
          private_city: emp.private_city || "",
          private_state: emp.private_state || "",
          private_zip: emp.private_zip || "",
          private_country: emp.private_country || "",
          visa_no: emp.visa_no || "",
          work_permit_no: emp.work_permit_no || "",
        };
        setForm(mapped);
        // Snapshot the employees-table–relevant fields for diff tracking.
        // We exclude credentials fields that aren't in the employees table.
        const {
          account_email: _ae,
          account_password: _ap,
          account_role_id: _ar,
          auth_user_id: _au,
          ...dbFields
        } = mapped;
        setEmployeeSnapshot({ id, ...dbFields } as Record<string, unknown>);
      }
    }
  }, [employees, id, isNew]);

  useEffect(() => {
    const loadLinkedProfile = async () => {
      if (isNew || !form.auth_user_id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, role_id")
        .eq("id", form.auth_user_id)
        .maybeSingle();

      if (error || !data) return;

      setForm((prev) => ({
        ...prev,
        account_role_id: data.role_id || prev.account_role_id,
      }));
    };

    loadLinkedProfile();
  }, [isNew, form.auth_user_id]);

  const fetchBankAccounts = useCallback(async () => {
    if (isNew || !id) return;
    const { data } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("employee_id", id)
      .order("created_at");
    setBankAccounts(data || []);
  }, [id, isNew]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  const handleChange = (field: keyof EmployeeFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setUserCreationError(null);
    try {
      const selectedCompanyId = form.company_id || activeCompanyId || "";
      const accountEmail = (form.account_email || form.email).trim();
      const accountPassword = form.account_password;
      const selectedRole =
        roles.find((role) => role.id === form.account_role_id) || null;

      if (!selectedCompanyId) {
        setUserCreationError("Please select a company before saving.");
        setSaving(false);
        return;
      }

      if (createUserAccount) {
        if (!accountEmail) {
          setUserCreationError(
            "Please provide an account email before creating credentials.",
          );
          setSaving(false);
          return;
        }

        if (!form.account_role_id) {
          setUserCreationError("Please select a role for this account.");
          setSaving(false);
          return;
        }

        if (accountPassword) {
          if (accountPassword.length < 6) {
            setUserCreationError(
              "Account password must be at least 6 characters.",
            );
            setSaving(false);
            return;
          }
        }
      }

      const payload: any = {
        company_id: selectedCompanyId,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        position: form.position,
        department_id: form.department_id ? Number(form.department_id) : null,
        project_id: form.project_id ? Number(form.project_id) : null,
        pay_group_id: form.pay_group_id ? Number(form.pay_group_id) : null,
        base_pay: form.base_pay ? Number(form.base_pay) : null,
        employment_type: form.employment_type,
        private_email: form.private_email,
        private_phone: form.private_phone,
        birthday: form.birthday || null,
        place_of_birth: form.place_of_birth,
        country_of_birth: form.country_of_birth,
        gender: form.gender,
        nationality: form.nationality,
        identification_no: form.identification_no,
        passport_no: form.passport_no,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        private_street: form.private_street,
        private_street2: form.private_street2,
        private_city: form.private_city,
        private_state: form.private_state,
        private_zip: form.private_zip,
        private_country: form.private_country,
        visa_no: form.visa_no,
        work_permit_no: form.work_permit_no,
      };

      let employeeId: string | null = null;
      let linkedAuthUserId = form.auth_user_id || null;

      if (isNew) {
        // Create new employee and get ID
        const { data: insertData, error: insertError } = await supabase
          .from("employees")
          .insert([payload])
          .select()
          .single();

        if (insertError) throw insertError;
        employeeId = insertData?.id;
      } else {
        // Update existing employee — only send changed fields via useEditableRecord.
        // Sync the current form values into the hook before saving.
        const dbPayloadKeys = Object.keys(payload) as string[];
        for (const key of dbPayloadKeys) {
          editableRecord.updateField(key, (payload as any)[key]);
        }
        const result = await editableRecord.save();
        if ("skipped" in result) {
          // Nothing changed in the employees table — may still need to update credentials.
        } else if ("data" in result && (result as any).error) {
          throw (result as any).error;
        }
        employeeId = id;
      }

      // If account management is requested and we have an employee ID
      if (createUserAccount && employeeId) {
        try {
          const isCreateFlow = isNew || !linkedAuthUserId;
          let passwordToReveal: string | null = null;

          if (isCreateFlow) {
            const result = await register({
              email: accountEmail,
              password: accountPassword || undefined,
              firstName: form.first_name,
              lastName: form.last_name,
              companyId: selectedCompanyId,
              employeeId,
              roleId: form.account_role_id || null,
              roleName: selectedRole?.name || undefined,
              isTemporaryPassword: isTemporaryPassword || !accountPassword,
            });

            linkedAuthUserId = result.userId;
            passwordToReveal = result.generatedPassword;
            setTemporaryPassword(result.generatedPassword);
          } else {
            await updateUserAccount({
              authUserId: linkedAuthUserId,
              employeeId,
              firstName: form.first_name,
              lastName: form.last_name,
              companyId: selectedCompanyId,
              roleId: form.account_role_id || null,
              roleName: selectedRole?.name || undefined,
              password: accountPassword || undefined,
              isTemporaryPassword,
            });
            passwordToReveal = isTemporaryPassword ? accountPassword : null;
            setTemporaryPassword(passwordToReveal);
          }

          if (linkedAuthUserId) {
            await supabase
              .from("employees")
              .update({ auth_user_id: linkedAuthUserId })
              .eq("id", employeeId);
          }

          await fetchEmployees();
          setSaving(false);
          if (passwordToReveal) {
            onOpenPasswordModal();
          } else {
            navigate(breadcrumbReturnPath);
          }
          return;
        } catch (error: any) {
          setUserCreationError(
            error.message || "Failed to create user account",
          );
          setSaving(false);
          return;
        }
      }

      await fetchEmployees();
      setSaving(false);
      navigate(breadcrumbReturnPath);
    } catch (error: any) {
      setUserCreationError(error.message || "Failed to save employee");
      setSaving(false);
    }
  };

  const handleDeleteBank = async (bankId: string) => {
    await supabase.from("bank_accounts").delete().eq("id", bankId);
    fetchBankAccounts();
  };

  const fullName =
    `${form.first_name} ${form.last_name}`.trim() ||
    (isNew ? "New Employee" : "Employee");
  const avatarColor = getAvatarColor(fullName);
  const initials = getInitials(form.first_name, form.last_name);
  const dept = departments.find((d) => String(d.id) === form.department_id);
  const proj = projects.find((p) => String(p.id) === form.project_id);

  if (!isNew && loading && !employees.length) {
    return (
      <Center h="60vh">
        <Spinner size="lg" color="blue.500" />
      </Center>
    );
  }

  return (
    <Box pb={12}>
      {/* Error Alert */}
      {userCreationError && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{userCreationError}</AlertDescription>
          </Box>
        </Alert>
      )}

      {/* Header card */}
      <Box
        bg={bgCard}
        border="1px solid"
        borderColor={borderColor}
        borderRadius="xl"
        overflow="hidden"
      >
        <Flex align="center" px={8} py={6} gap={6}>
          <Box
            w="80px"
            h="80px"
            borderRadius="12px"
            bg={avatarColor}
            display="flex"
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
            boxShadow="md"
          >
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="white"
              letterSpacing="tight"
            >
              {initials}
            </Text>
          </Box>
          <Box flex={1}>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color={textColor}
              lineHeight="short"
              mb={1}
            >
              {fullName}
            </Text>
            <Flex align="center" gap={4} flexWrap="wrap">
              {form.email && (
                <Flex align="center" gap={1.5} color={subTextColor}>
                  <Mail size={13} />
                  <Text fontSize="sm">{form.email}</Text>
                </Flex>
              )}
              {form.position && (
                <Flex align="center" gap={1.5} color={subTextColor}>
                  <Briefcase size={13} />
                  <Text fontSize="sm">{form.position}</Text>
                </Flex>
              )}
              {dept && (
                <Flex align="center" gap={1.5} color={subTextColor}>
                  <Building2 size={13} />
                  <Text fontSize="sm">{dept.name}</Text>
                </Flex>
              )}
              {proj && (
                <Flex align="center" gap={1.5} color={subTextColor}>
                  <FolderKanban size={13} />
                  <Text fontSize="sm">{proj.name}</Text>
                </Flex>
              )}
            </Flex>
          </Box>
          <HStack spacing={2}>
            <Button
              variant="outline"
              colorScheme="gray"
              size="sm"
              leftIcon={<X size={14} />}
              onClick={() => navigate("/employees")}
            >
              Discard
            </Button>
            <Button
              colorScheme="blue"
              size="sm"
              leftIcon={<Save size={14} />}
              onClick={handleSave}
              isLoading={saving}
              loadingText="Saving"
            >
              Save
            </Button>
          </HStack>
        </Flex>

        {/* Tabs */}
        <Flex borderTop="1px solid" borderColor={borderColor} px={8}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Box
                key={tab.key}
                as="button"
                px={5}
                py={3}
                fontSize="sm"
                fontWeight={isActive ? "semibold" : "medium"}
                color={isActive ? tabActiveColor : tabInactiveColor}
                borderBottom="2px solid"
                borderColor={isActive ? tabActiveBorder : "transparent"}
                mb="-1px"
                transition="all 0.15s"
                _hover={{ bg: tabHoverBg, color: tabActiveColor }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </Box>
            );
          })}
        </Flex>
      </Box>

      {/* Tab content */}
      <Box
        bg={bgCard}
        border="1px solid"
        borderColor={borderColor}
        borderTop="none"
        borderRadius="0 0 xl xl"
        px={8}
        py={8}
      >
        {activeTab === "work" && (
          <WorkTab
            form={form}
            handleChange={handleChange}
            departments={departments}
            projects={projects}
            companies={userCompanies}
            selectBg={selectBg}
            selectBorder={selectBorder}
            labelColor={labelColor}
            sectionHeadingColor={sectionHeadingColor}
            borderColor={borderColor}
            showCompanySelector={isSuperAdmin}
          />
        )}
        {activeTab === "personal" && (
          <PersonalTab
            form={form}
            handleChange={handleChange}
            labelColor={labelColor}
            sectionHeadingColor={sectionHeadingColor}
            borderColor={borderColor}
            selectBg={selectBg}
            selectBorder={selectBorder}
            bankAccounts={bankAccounts}
            onAddBank={() => {
              setEditingBank(null);
              setBankModalOpen(true);
            }}
            onEditBank={(b) => {
              setEditingBank(b);
              setBankModalOpen(true);
            }}
            onDeleteBank={handleDeleteBank}
            isNew={isNew}
          />
        )}
        {activeTab === "employment" && (
          <EmploymentTab
            form={form}
            handleChange={handleChange}
            selectBg={selectBg}
            selectBorder={selectBorder}
            labelColor={labelColor}
            sectionHeadingColor={sectionHeadingColor}
            borderColor={borderColor}
          />
        )}
        {activeTab === "payroll" && (
          <PayrollTab
            form={form}
            handleChange={handleChange}
            labelColor={labelColor}
            sectionHeadingColor={sectionHeadingColor}
            borderColor={borderColor}
            selectBg={selectBg}
            selectBorder={selectBorder}
            payGroups={payGroups}
          />
        )}
        {activeTab === "credentials" && (
          <CredentialsTab
            form={form}
            handleChange={handleChange}
            labelColor={labelColor}
            sectionHeadingColor={sectionHeadingColor}
            borderColor={borderColor}
            selectBg={selectBg}
            selectBorder={selectBorder}
            isNew={isNew}
            roles={roles}
            rolesLoading={rolesLoading}
            createUserAccount={createUserAccount}
            onCreateUserAccountChange={setCreateUserAccount}
            isTemporaryPassword={isTemporaryPassword}
            onTemporaryPasswordChange={setIsTemporaryPassword}
          />
        )}
      </Box>

      <BankAccountModal
        isOpen={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        employeeId={id || 0}
        holderName={fullName}
        existing={editingBank}
        onSaved={fetchBankAccounts}
      />

      {/* Temporary Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={onClosePasswordModal}
        isCentered
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>User Account Created</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Alert
              status="success"
              variant="subtle"
              flexDirection="column"
              alignItems="flex-start"
              borderRadius="md"
              mb={4}
            >
              <Flex align="center" mb={2}>
                <AlertIcon />
                <AlertTitle>Success!</AlertTitle>
              </Flex>
              <AlertDescription>
                User account has been created for {fullName}
              </AlertDescription>
            </Alert>

            <Box mb={6}>
              <Text fontSize="sm" fontWeight="medium" mb={2}>
                Temporary Password:
              </Text>
              <Box bg={passwordPreviewBg} p={3} borderRadius="md" mb={4}>
                <HStack justify="space-between" align="center">
                  <Text
                    fontFamily="monospace"
                    fontSize="sm"
                    fontWeight="bold"
                    letterSpacing="wider"
                  >
                    {temporaryPassword}
                  </Text>
                  <Button
                    size="xs"
                    onClick={() => {
                      navigator.clipboard.writeText(temporaryPassword || "");
                    }}
                  >
                    Copy
                  </Button>
                </HStack>
              </Box>

              <Text fontSize="xs" color="orange.600" mb={4}>
                Share this password with the employee. They should change it on
                first login.
              </Text>
            </Box>

            <Button
              colorScheme="blue"
              w="full"
              onClick={() => {
                onClosePasswordModal();
                navigate(breadcrumbReturnPath);
              }}
            >
              Done
            </Button>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

/* ─── Shared helpers ─────────────────────────────────────── */

interface TabProps {
  form: EmployeeFormData;
  handleChange: (field: keyof EmployeeFormData, value: string) => void;
  labelColor: string;
  sectionHeadingColor: string;
  borderColor: string;
  selectBg?: string;
  selectBorder?: string;
  departments?: any[];
  projects?: any[];
  companies?: { id: string; name: string }[];
  roles?: RoleOption[];
  payGroups?: PayGroupOption[];
}

const SectionHeading = ({ label, color }: { label: string; color: string }) => (
  <Box mb={4}>
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color={color}
      textTransform="uppercase"
      letterSpacing="widest"
    >
      {label}
    </Text>
    <Divider mt={2} />
  </Box>
);

const FieldRow = ({
  label,
  children,
  labelColor,
}: {
  label: string;
  children: React.ReactNode;
  labelColor: string;
}) => (
  <Flex align="flex-start" mb={4} gap={6}>
    <Box w="180px" flexShrink={0} pt="8px">
      <Text fontSize="sm" fontWeight="medium" color={labelColor}>
        {label}
      </Text>
    </Box>
    <Box flex={1}>{children}</Box>
  </Flex>
);

/* ─── Work Tab ───────────────────────────────────────────── */

const WorkTab = ({
  form,
  handleChange,
  departments,
  projects,
  companies,
  selectBg,
  selectBorder,
  labelColor,
  sectionHeadingColor,
  showCompanySelector = false,
}: TabProps & {
  showCompanySelector?: boolean;
}) => (
  <Box maxW="800px">
    <SectionHeading label="Job Information" color={sectionHeadingColor} />
    {showCompanySelector && (
      <FieldRow label="Company" labelColor={labelColor}>
        <FormControl isRequired>
          <Select
            value={form.company_id}
            onChange={(e) => handleChange("company_id", e.target.value)}
            placeholder="Select company"
            bg={selectBg}
            borderColor={selectBorder}
            size="md"
          >
            {(companies ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormControl>
      </FieldRow>
    )}
    <FieldRow label="First Name" labelColor={labelColor}>
      <Input
        placeholder="Enter first name"
        value={form.first_name}
        onChange={(e) => handleChange("first_name", e.target.value)}
      />
    </FieldRow>
    <FieldRow label="Last Name" labelColor={labelColor}>
      <Input
        placeholder="Enter last name"
        value={form.last_name}
        onChange={(e) => handleChange("last_name", e.target.value)}
      />
    </FieldRow>
    <FieldRow label="Work Email" labelColor={labelColor}>
      <Input
        type="email"
        placeholder="Enter work email"
        value={form.email}
        onChange={(e) => {
          const nextEmail = e.target.value;
          handleChange("email", nextEmail);
          if (!form.account_email) {
            handleChange("account_email", nextEmail);
          }
        }}
      />
    </FieldRow>
    <FieldRow label="Job Position" labelColor={labelColor}>
      <Input
        placeholder="e.g. Software Engineer"
        value={form.position}
        onChange={(e) => handleChange("position", e.target.value)}
      />
    </FieldRow>
    <FieldRow label="Department" labelColor={labelColor}>
      <FormControl>
        <Select
          value={form.department_id}
          onChange={(e) => handleChange("department_id", e.target.value)}
          placeholder="Select department"
          bg={selectBg}
          borderColor={selectBorder}
          size="md"
        >
          {(departments ?? []).map((d) => (
            <option key={d.id} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </Select>
      </FormControl>
    </FieldRow>
    <FieldRow label="Project" labelColor={labelColor}>
      <FormControl>
        <Select
          value={form.project_id}
          onChange={(e) => handleChange("project_id", e.target.value)}
          placeholder="Select project"
          bg={selectBg}
          borderColor={selectBorder}
          size="md"
        >
          {(projects ?? []).map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormControl>
    </FieldRow>
  </Box>
);

/* ─── Credentials Tab ───────────────────────────────────── */

const CredentialsTab = ({
  form,
  handleChange,
  labelColor,
  sectionHeadingColor,
  selectBorder,
  roles,
  rolesLoading,
  isNew,
  createUserAccount,
  onCreateUserAccountChange,
  isTemporaryPassword,
  onTemporaryPasswordChange,
}: TabProps & {
  rolesLoading?: boolean;
  isNew: boolean;
  createUserAccount: boolean;
  onCreateUserAccountChange: (value: boolean) => void;
  isTemporaryPassword: boolean;
  onTemporaryPasswordChange: (value: boolean) => void;
}) => (
  <Box maxW="800px">
    <SectionHeading label="Account Access" color={sectionHeadingColor} />

    <Box mb={6}>
      <Checkbox
        isChecked={createUserAccount}
        onChange={(e) => onCreateUserAccountChange(e.target.checked)}
        colorScheme="blue"
      >
        <Text fontSize="sm" fontWeight="medium">
          {isNew ? "Create Supabase account" : "Manage linked account"}
        </Text>
      </Checkbox>
      <Text fontSize="xs" color={labelColor} mt={1} pl={6}>
        Creates or updates account details in auth.users and public.profiles
        when you save.
      </Text>
    </Box>

    {!isNew && !form.auth_user_id && (
      <Box
        mb={6}
        p={4}
        borderRadius="md"
        border="1px solid"
        borderColor={selectBorder}
      >
        <Text fontSize="sm" color={labelColor}>
          No linked auth account yet. Enable account management and save to
          create one.
        </Text>
      </Box>
    )}

    <FieldRow label="Role" labelColor={labelColor}>
      <FormControl>
        <Select
          value={form.account_role_id}
          onChange={(e) => handleChange("account_role_id", e.target.value)}
          placeholder={rolesLoading ? "Loading roles..." : "Select role"}
          bg="white"
          borderColor={selectBorder}
          isDisabled={!createUserAccount || rolesLoading}
        >
          {(roles ?? []).map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
      </FormControl>
    </FieldRow>

    <FieldRow label="Account Email" labelColor={labelColor}>
      <Input
        type="email"
        placeholder="employee.login@example.com"
        value={form.account_email || form.email}
        onChange={(e) => handleChange("account_email", e.target.value)}
        isDisabled={!createUserAccount}
      />
    </FieldRow>

    <FieldRow label="Password" labelColor={labelColor}>
      <VStack align="stretch" spacing={3}>
        <Input
          type="password"
          placeholder="********"
          value={form.account_password}
          onChange={(e) => {
            handleChange("account_password", e.target.value);
            onTemporaryPasswordChange(false);
          }}
          isDisabled={!createUserAccount}
        />
        <HStack>
          <Button
            size="sm"
            colorScheme="blue"
            variant="outline"
            onClick={() => {
              const chars =
                "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
              let generated = "";
              for (let i = 0; i < 12; i++) {
                generated += chars.charAt(
                  Math.floor(Math.random() * chars.length),
                );
              }

              handleChange("account_password", generated);
              onTemporaryPasswordChange(true);
            }}
            isDisabled={!createUserAccount}
          >
            Generate Temporary Password
          </Button>
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(form.account_password || "");
            }}
            isDisabled={!form.account_password || !createUserAccount}
          >
            Copy Password
          </Button>
        </HStack>
        {isTemporaryPassword && form.account_password && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle fontSize="sm">Store this password safely</AlertTitle>
              <AlertDescription fontSize="sm">
                Copy and paste this temporary password into your secure local
                vault/notes now. The employee will be required to change it on
                first login.
              </AlertDescription>
            </Box>
          </Alert>
        )}
      </VStack>
    </FieldRow>
  </Box>
);

/* ─── Personal Tab ───────────────────────────────────────── */

interface PersonalTabProps extends TabProps {
  bankAccounts: any[];
  onAddBank: () => void;
  onEditBank: (b: any) => void;
  onDeleteBank: (id: string) => void;
  isNew: boolean;
}

const PersonalTab = ({
  form,
  handleChange,
  labelColor,
  sectionHeadingColor,
  selectBg,
  selectBorder,
  bankAccounts,
  onAddBank,
  onEditBank,
  onDeleteBank,
  isNew,
}: PersonalTabProps) => {
  const subTextColor = useColorModeValue("gray.500", "gray.400");
  const bankRowBg = useColorModeValue("gray.50", "gray.700");

  return (
    <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr" }} gap={10}>
      {/* LEFT COLUMN */}
      <GridItem>
        {/* Private Contact */}
        <SectionHeading label="Private Contact" color={sectionHeadingColor} />
        <FieldRow label="Email" labelColor={labelColor}>
          <Input
            type="email"
            placeholder="e.g. myprivateemail@example.com"
            value={form.private_email}
            onChange={(e) => handleChange("private_email", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Phone" labelColor={labelColor}>
          <Input
            placeholder=""
            value={form.private_phone}
            onChange={(e) => handleChange("private_phone", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Bank Accounts" labelColor={labelColor}>
          <Box>
            {bankAccounts.length === 0 && (
              <Text fontSize="sm" color={subTextColor} mb={2}>
                No bank accounts
              </Text>
            )}
            {bankAccounts.map((b) => (
              <Flex
                key={b.id}
                align="center"
                justify="space-between"
                bg={bankRowBg}
                borderRadius="md"
                px={3}
                py={2}
                mb={2}
              >
                <Box>
                  <Text fontSize="sm" fontWeight="medium">
                    {b.account_number || "(no account #)"}
                  </Text>
                  {b.bank_name && (
                    <Text fontSize="xs" color={subTextColor}>
                      {b.bank_name}
                    </Text>
                  )}
                  {b.holder_name && (
                    <Text fontSize="xs" color={subTextColor}>
                      {b.holder_name}
                    </Text>
                  )}
                </Box>
                <HStack spacing={1}>
                  <IconButton
                    aria-label="Edit"
                    icon={<Pencil size={13} />}
                    size="xs"
                    variant="ghost"
                    onClick={() => onEditBank(b)}
                  />
                  <IconButton
                    aria-label="Delete"
                    icon={<Trash2 size={13} />}
                    size="xs"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => onDeleteBank(b.id)}
                  />
                </HStack>
              </Flex>
            ))}
            {!isNew && (
              <Button
                size="xs"
                variant="ghost"
                colorScheme="blue"
                leftIcon={<PlusCircle size={13} />}
                onClick={onAddBank}
                mt={1}
              >
                Add Bank Account
              </Button>
            )}
            {isNew && (
              <Text fontSize="xs" color={subTextColor}>
                Save the employee first to add bank accounts.
              </Text>
            )}
          </Box>
        </FieldRow>

        {/* Citizenship */}
        <Box mt={6}>
          <SectionHeading label="Citizenship" color={sectionHeadingColor} />
          <FieldRow label="Nationality" labelColor={labelColor}>
            <Input
              placeholder="e.g. Filipino"
              value={form.nationality}
              onChange={(e) => handleChange("nationality", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Identification No" labelColor={labelColor}>
            <Input
              placeholder="Issued by Government"
              value={form.identification_no}
              onChange={(e) =>
                handleChange("identification_no", e.target.value)
              }
            />
          </FieldRow>
          <FieldRow label="Passport No" labelColor={labelColor}>
            <Input
              placeholder=""
              value={form.passport_no}
              onChange={(e) => handleChange("passport_no", e.target.value)}
            />
          </FieldRow>
        </Box>

        {/* Emergency Contact */}
        <Box mt={6}>
          <SectionHeading
            label="Emergency Contact"
            color={sectionHeadingColor}
          />
          <FieldRow label="Contact Name" labelColor={labelColor}>
            <Input
              placeholder=""
              value={form.emergency_contact_name}
              onChange={(e) =>
                handleChange("emergency_contact_name", e.target.value)
              }
            />
          </FieldRow>
          <FieldRow label="Phone" labelColor={labelColor}>
            <Input
              placeholder=""
              value={form.emergency_contact_phone}
              onChange={(e) =>
                handleChange("emergency_contact_phone", e.target.value)
              }
            />
          </FieldRow>
        </Box>
      </GridItem>

      {/* RIGHT COLUMN */}
      <GridItem>
        {/* Personal Information */}
        <SectionHeading
          label="Personal Information"
          color={sectionHeadingColor}
        />
        <FieldRow label="Legal Name" labelColor={labelColor}>
          <Input
            placeholder=""
            value={`${form.first_name} ${form.last_name}`.trim()}
            isReadOnly
          />
        </FieldRow>
        <FieldRow label="Birthday" labelColor={labelColor}>
          <Input
            type="date"
            value={form.birthday}
            onChange={(e) => handleChange("birthday", e.target.value)}
          />
        </FieldRow>
        <FieldRow label="Place of Birth" labelColor={labelColor}>
          <HStack spacing={2}>
            <Input
              placeholder="City"
              value={form.place_of_birth}
              onChange={(e) => handleChange("place_of_birth", e.target.value)}
            />
            <Input
              placeholder="Country"
              value={form.country_of_birth}
              onChange={(e) => handleChange("country_of_birth", e.target.value)}
            />
          </HStack>
        </FieldRow>
        <FieldRow label="Gender" labelColor={labelColor}>
          <FormControl>
            <Select
              value={form.gender}
              onChange={(e) => handleChange("gender", e.target.value)}
              placeholder="Select gender"
              bg={selectBg}
              borderColor={selectBorder}
              size="md"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </FormControl>
        </FieldRow>

        {/* Visa & Work Permit */}
        <Box mt={6}>
          <SectionHeading
            label="Visa & Work Permit"
            color={sectionHeadingColor}
          />
          <FieldRow label="Visa No" labelColor={labelColor}>
            <Input
              placeholder=""
              value={form.visa_no}
              onChange={(e) => handleChange("visa_no", e.target.value)}
            />
          </FieldRow>
          <FieldRow label="Work Permit No" labelColor={labelColor}>
            <Input
              placeholder=""
              value={form.work_permit_no}
              onChange={(e) => handleChange("work_permit_no", e.target.value)}
            />
          </FieldRow>
        </Box>

        {/* Location */}
        <Box mt={6}>
          <SectionHeading label="Location" color={sectionHeadingColor} />
          <FieldRow label="Private Address" labelColor={labelColor}>
            <VStack spacing={2} align="stretch">
              <Input
                placeholder="Street..."
                value={form.private_street}
                onChange={(e) => handleChange("private_street", e.target.value)}
              />
              <Input
                placeholder="Street 2..."
                value={form.private_street2}
                onChange={(e) =>
                  handleChange("private_street2", e.target.value)
                }
              />
              <HStack spacing={2}>
                <Input
                  placeholder="City"
                  value={form.private_city}
                  onChange={(e) => handleChange("private_city", e.target.value)}
                />
                <Input
                  placeholder="State"
                  value={form.private_state}
                  onChange={(e) =>
                    handleChange("private_state", e.target.value)
                  }
                />
                <Input
                  placeholder="ZIP"
                  value={form.private_zip}
                  onChange={(e) => handleChange("private_zip", e.target.value)}
                />
              </HStack>
              <Input
                placeholder="Country"
                value={form.private_country}
                onChange={(e) =>
                  handleChange("private_country", e.target.value)
                }
              />
            </VStack>
          </FieldRow>
        </Box>
      </GridItem>
    </Grid>
  );
};

/* ─── Employment Tab ─────────────────────────────────────── */

const EmploymentTab = ({
  form,
  handleChange,
  selectBg,
  selectBorder,
  labelColor,
  sectionHeadingColor,
}: TabProps) => (
  <Box maxW="800px">
    <SectionHeading label="Employment Details" color={sectionHeadingColor} />
    <FieldRow label="Employment Type" labelColor={labelColor}>
      <FormControl>
        <Select
          value={form.employment_type}
          onChange={(e) => handleChange("employment_type", e.target.value)}
          bg={selectBg}
          borderColor={selectBorder}
          size="md"
        >
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contractual">Contractual</option>
          <option value="probationary">Probationary</option>
        </Select>
      </FormControl>
    </FieldRow>
    <FieldRow label="Job Position" labelColor={labelColor}>
      <Input
        placeholder="e.g. Software Engineer"
        value={form.position}
        onChange={(e) => handleChange("position", e.target.value)}
      />
    </FieldRow>
  </Box>
);

/* ─── Payroll Tab ────────────────────────────────────────── */

const PayrollTab = ({
  form,
  handleChange,
  labelColor,
  sectionHeadingColor,
  selectBg,
  selectBorder,
  payGroups,
}: TabProps) => {
  const selectedPayGroup = (payGroups ?? []).find(
    (group) => String(group.id) === form.pay_group_id,
  );

  return (
    <Box maxW="800px">
      <SectionHeading label="Contract Overview" color={sectionHeadingColor} />
      <FieldRow label="Wage (Base Pay)" labelColor={labelColor}>
        <Input
          type="number"
          placeholder="0.00"
          value={form.base_pay}
          onChange={(e) => handleChange("base_pay", e.target.value)}
        />
      </FieldRow>
      <FieldRow label="Employment Type" labelColor={labelColor}>
        <Flex align="center" gap={2} pt={2}>
          <UserCheck size={15} />
          <Text fontSize="sm" color={labelColor} textTransform="capitalize">
            {form.employment_type || "—"}
          </Text>
        </Flex>
      </FieldRow>
      <FieldRow label="Pay Category" labelColor={labelColor}>
        <VStack align="stretch" spacing={2}>
          <FormControl>
            <Select
              value={form.pay_group_id}
              onChange={(e) => handleChange("pay_group_id", e.target.value)}
              placeholder="Select pay category"
              bg={selectBg}
              borderColor={selectBorder}
              size="md"
            >
              {(payGroups ?? []).map((group) => (
                <option key={group.id} value={String(group.id)}>
                  {getScheduleLabel(group.pay_schedule)} · {group.name}
                </option>
              ))}
            </Select>
          </FormControl>
          <Flex align="center" gap={2}>
            <DollarSign size={15} />
            <Text fontSize="sm" color={labelColor}>
              {selectedPayGroup
                ? `${getScheduleLabel(selectedPayGroup.pay_schedule)} payroll schedule`
                : "No pay category assigned yet"}
            </Text>
          </Flex>
          {selectedPayGroup?.description ? (
            <Text fontSize="xs" color={labelColor}>
              {selectedPayGroup.description}
            </Text>
          ) : null}
        </VStack>
      </FieldRow>
    </Box>
  );
};
