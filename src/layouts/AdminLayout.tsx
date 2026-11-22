import {
  Box,
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  HStack,
  IconButton,
  Text,
  useColorMode,
  useColorModeValue,
} from "@chakra-ui/react";
import { Sun, Moon, ChevronRight, Grid3x3 } from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import { HUB_URL } from "../lib/hubHandoff";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider, useSidebar } from "../contexts/SidebarContext";
import { KeyboardShortcutsHelp } from "../components/layout/KeyboardShortcutsHelp";

const AdminLayoutContent = () => {
  const { isCollapsed } = useSidebar();
  const { colorMode, toggleColorMode } = useColorMode();
  const navigate = useNavigate();
  const location = useLocation();
  const mainBg = useColorModeValue("gray.50", "gray.900");
  const toggleBg = useColorModeValue("gray.100", "gray.700");
  const toggleColor = useColorModeValue("gray.700", "gray.100");
  const toggleBorder = useColorModeValue("gray.300", "gray.600");
  const toggleHoverBg = useColorModeValue("gray.200", "gray.600");
  const breadcrumbMuted = useColorModeValue("gray.500", "gray.400");

  const pathSegments = location.pathname.split("/").filter(Boolean);

  const toLabel = (segment: string, index: number) => {
    const prev = pathSegments[index - 1];
    if (segment === "admin") return "Admin";
    if (segment === "dashboard") return "Dashboard";
    if (segment === "employees") return "Employees";
    if (segment === "new" && prev === "employees") return "New Employee";
    if (segment === "attendance") return "Attendance";
    if (segment === "attendance-tracker") return "Attendance Tracker";
    if (segment === "payroll") return "Payroll";
    if (segment === "runs" && prev === "payroll") return "Runs";
    if (segment === "analytics" && prev === "payroll") return "Analytics";
    if (segment === "approvals" && prev === "payroll") return "Approvals";
    if (segment === "batch-generate" && prev === "payroll") {
      return "Batch Generate";
    }
    if (segment === "config") return "Config";
    if (segment === "pay-templates") return "Pay Templates";
    if (segment === "departments") return "Departments";
    if (segment === "projects") return "Projects";
    if (segment === "settings") return "Settings";
    if (segment === "my-payslips") return "My Payslips";
    if (segment === "test") return "Test";

    const isIdLike =
      /^\d+$/.test(segment) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        segment,
      );
    if (isIdLike && prev === "employees") return "Edit Employee";
    if (isIdLike && prev === "runs") return "Run Detail";

    return segment
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const breadcrumbItems = pathSegments.map((segment, index) => ({
    label: toLabel(segment, index),
    to: `/${pathSegments.slice(0, index + 1).join("/")}`,
  }));

  return (
    <Box display="flex" bg={mainBg} minH="100vh">
      <Sidebar />
      <Box
        ml={{ base: "80px", md: isCollapsed ? "80px" : "260px" }}
        w={{ base: "calc(100vw - 80px)", md: "full" }}
        overflowX="hidden"
        transition="margin-left 0.3s ease"
      >
        <Box
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          gap={3}
          px={{ base: 4, md: 8 }}
          pt={{ base: 4, md: 6 }}
          pb={{ base: 3, md: 4 }}
        >
          {/* Always present, not only when the user arrived from the hub:
              someone who opens this app directly, or reloads after the
              handoff fragment has been stripped, still needs a way across. */}
          <Button
            as="a"
            href={HUB_URL}
            size="sm"
            variant="ghost"
            leftIcon={<Grid3x3 size={16} />}
            aria-label="Back to all apps"
          >
            Apps
          </Button>
          <IconButton
            aria-label="Toggle color mode"
            icon={
              colorMode === "light" ? <Moon size={18} /> : <Sun size={18} />
            }
            size="md"
            borderRadius="full"
            bg={toggleBg}
            color={toggleColor}
            boxShadow="sm"
            border="1px solid"
            borderColor={toggleBorder}
            onClick={toggleColorMode}
            _hover={{ boxShadow: "md", bg: toggleHoverBg }}
          />
        </Box>
        <Box px={{ base: 4, md: 8 }} pb={{ base: 4, md: 8 }}>
          <Breadcrumb spacing="8px" separator={<Box as="span" />} mb={4}>
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;

              return (
                <BreadcrumbItem
                  key={`${item.to}-${index}`}
                  isCurrentPage={isLast}
                >
                  <HStack spacing={2}>
                    {isLast ? (
                      <Text
                        fontSize="sm"
                        color={breadcrumbMuted}
                        fontWeight="medium"
                      >
                        {item.label}
                      </Text>
                    ) : (
                      <BreadcrumbLink
                        fontSize="sm"
                        color="blue.500"
                        fontWeight="medium"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(item.to);
                        }}
                        _hover={{ textDecoration: "underline" }}
                      >
                        {item.label}
                      </BreadcrumbLink>
                    )}
                    {!isLast && (
                      <ChevronRight
                        size={14}
                        color={breadcrumbMuted as string}
                      />
                    )}
                  </HStack>
                </BreadcrumbItem>
              );
            })}
          </Breadcrumb>
          <Outlet />
        </Box>
      </Box>
      <KeyboardShortcutsHelp />
    </Box>
  );
};

export const AdminLayout = () => {
  return (
    <SidebarProvider>
      <AdminLayoutContent />
    </SidebarProvider>
  );
};
