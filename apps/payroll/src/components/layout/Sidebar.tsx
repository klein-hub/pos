import { useEffect, useRef } from "react";
import {
  Box,
  VStack,
  Icon,
  Text,
  Flex,
  IconButton,
  Avatar,
  Tooltip,
  Menu as ChakraMenu,
  MenuButton,
  MenuList,
  MenuItem,
  Spinner,
  Button,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  LayoutDashboard,
  Users,
  Clock,
  DollarSign,
  Building2,
  FolderKanban,
  Settings,
  LogOut,
  Menu,
  Shield,
  Building,
  ChevronDown,
  Receipt,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSidebar } from "../../contexts/SidebarContext";
import { useAuthStore } from "../../store/authStore";
import { useCompanyContext } from "../../hooks/useCompanyContext";

const menuItems = [
  { icon: Shield, label: "Admin", path: "/admin" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Receipt, label: "My Payslips", path: "/my-payslips" },
  { icon: Users, label: "Employees", path: "/employees" },
  { icon: Clock, label: "Attendance", path: "/attendance" },
  { icon: DollarSign, label: "Payroll", path: "/payroll" },
  { icon: Building2, label: "Departments", path: "/departments" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: Settings, label: "Tests", path: "/test", isTest: true },
];

export const Sidebar = () => {
  const { isCollapsed, toggleSidebar, collapseSidebar } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userRole, signOut } = useAuthStore();
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  // Color mode values
  const sidebarBg = useColorModeValue("white", "gray.900");
  const textColor = useColorModeValue("gray.800", "white");
  const subTextColor = useColorModeValue("gray.600", "rgba(255,255,255,0.8)");
  const dividerColor = useColorModeValue(
    "rgba(0,0,0,0.1)",
    "rgba(255,255,255,0.1)",
  );
  const hoverBg = useColorModeValue("gray.100", "whiteAlpha.200");
  const activeBg = useColorModeValue("cyan.50", "whiteAlpha.200");
  const activeColor = useColorModeValue("cyan.700", "white");
  const btnColor = useColorModeValue("gray.700", "white");
  const btnHoverBg = useColorModeValue("gray.100", "whiteAlpha.200");
  const dropdownBg = useColorModeValue("white", "gray.800");
  const dropdownBorderColor = useColorModeValue("gray.200", "gray.700");
  const dropdownItemHoverBg = useColorModeValue("gray.100", "whiteAlpha.300");
  const dropdownItemColor = useColorModeValue("gray.800", "white");
  const logoutHoverBg = useColorModeValue("red.50", "whiteAlpha.200");
  const logoutHoverColor = useColorModeValue("red.600", "red.300");

  // Try to use company context, but handle errors gracefully
  let companyContext: any = null;
  try {
    companyContext = useCompanyContext();
  } catch (e) {
    // User may not have selected a company yet
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const handleCompanyChange = (companyId: string) => {
    if (companyContext) {
      companyContext.setActiveCompany(companyId);
      // Reload page to fetch company data
      window.location.reload();
    }
  };

  useEffect(() => {
    if (isCollapsed) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        sidebarRef.current &&
        target &&
        !sidebarRef.current.contains(target)
      ) {
        collapseSidebar();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCollapsed, collapseSidebar]);

  const visibleMenuItems = menuItems.filter((item) => {
    if (userRole === "employee") {
      return item.path === "/my-payslips" || item.path === "/settings";
    }

    if (item.path === "/admin") return false;

    if (item.path === "/my-payslips") {
      return false;
    }

    return true;
  });

  const showCompanySelector = userRole === "super_admin";
  const showSuperAdminTab = userRole === "super_admin";
  const isAdminTabActive = location.pathname === "/admin";

  return (
    <Box
      ref={sidebarRef}
      w={isCollapsed ? "80px" : "260px"}
      h="100vh"
      bg={sidebarBg}
      pos="fixed"
      left={0}
      top={0}
      transition="all 0.3s ease"
      zIndex={100}
      borderRight="2px solid rgba(0, 188, 212, 0.6)"
      boxShadow="0 10px 30px -12px rgba(0, 0, 0, 0.42), 0 4px 25px 0px rgba(0, 0, 0, 0.12), 0 8px 10px -5px rgba(0, 0, 0, 0.2)"
    >
      <Flex
        align="center"
        p={4}
        justify="space-between"
        borderBottom={`1px solid ${dividerColor}`}
      >
        {!isCollapsed && (
          <Flex align="center">
            <Box
              w="32px"
              h="32px"
              borderRadius="6px"
              bg="linear-gradient(60deg, #26c6da, #00acc1)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mr={2}
            >
              <Icon as={LayoutDashboard} color="white" boxSize={5} />
            </Box>
            <Text fontSize="lg" fontWeight="bold" color={textColor}>
              Digita
            </Text>
          </Flex>
        )}
        <Tooltip
          label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          placement="right"
          hasArrow
          openDelay={200}
        >
          <IconButton
            aria-label="Toggle sidebar"
            icon={<Menu size={20} />}
            size="sm"
            variant="ghost"
            color={btnColor}
            onClick={toggleSidebar}
            _hover={{ bg: btnHoverBg }}
          />
        </Tooltip>
      </Flex>

      {showSuperAdminTab && (
        <Box px={3} pt={3} borderBottom={`1px solid ${dividerColor}`}>
          <Flex align="center" p={4}>
            <Avatar size="sm" name={user.email} bg="cyan.400" mr={3} />
            <Box flex={1} overflow="hidden">
              <Text
                color={textColor}
                fontSize="sm"
                fontWeight="medium"
                noOfLines={1}
              >
                {user.email}
              </Text>
            </Box>
          </Flex>

          <Link to="/admin">
            {isCollapsed ? (
              <Tooltip
                label="Admin Dashboard"
                placement="right"
                hasArrow
                openDelay={150}
              >
                <Flex
                  align="center"
                  px={3}
                  py={3}
                  cursor="pointer"
                  borderRadius="6px"
                  bg={isAdminTabActive ? activeBg : "transparent"}
                  color={isAdminTabActive ? activeColor : subTextColor}
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                  justify="center"
                  position="relative"
                  _before={
                    isAdminTabActive
                      ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "3px",
                          height: "70%",
                          bg: "cyan.400",
                          borderRadius: "0 4px 4px 0",
                        }
                      : undefined
                  }
                >
                  <Icon as={Shield} boxSize={5} />
                </Flex>
              </Tooltip>
            ) : (
              <>
                <Flex
                  align="center"
                  px={3}
                  py={3}
                  cursor="pointer"
                  borderRadius="6px"
                  bg={isAdminTabActive ? activeBg : "transparent"}
                  color={isAdminTabActive ? activeColor : subTextColor}
                  _hover={{ bg: hoverBg }}
                  transition="all 0.2s"
                  justify="flex-start"
                  position="relative"
                  _before={
                    isAdminTabActive
                      ? {
                          content: '""',
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: "3px",
                          height: "70%",
                          bg: "cyan.400",
                          borderRadius: "0 4px 4px 0",
                        }
                      : undefined
                  }
                >
                  <Icon as={Shield} boxSize={5} />
                  <Text ml={4} fontSize="sm" fontWeight="medium">
                    Admin
                  </Text>
                </Flex>
              </>
            )}
          </Link>
        </Box>
      )}

      {!isCollapsed && user && (
        <Box borderBottom={`1px solid ${dividerColor}`}>
          {/* Company Selector */}
          {companyContext && showCompanySelector && (
            <Flex align="center" px={4} pb={4}>
              <ChakraMenu>
                <MenuButton
                  as={Button}
                  rightIcon={<ChevronDown size={14} />}
                  size="sm"
                  width="100%"
                  textAlign="left"
                  variant="ghost"
                  color={subTextColor}
                  _hover={{ bg: hoverBg }}
                  fontSize="sm"
                  isDisabled={
                    companyContext.companiesLoading ||
                    !companyContext.userCompanies.length
                  }
                >
                  {companyContext.companiesLoading ? (
                    <Spinner size="xs" mr={2} />
                  ) : (
                    <Icon as={Building} boxSize={4} mr={2} />
                  )}
                  {companyContext.currentCompany?.name?.length > 12
                    ? companyContext.currentCompany?.name.slice(0, 20) + "..."
                    : companyContext.currentCompany?.name}
                </MenuButton>
                <MenuList bg={dropdownBg} borderColor={dropdownBorderColor}>
                  {companyContext.userCompanies.map((company: any) => (
                    <MenuItem
                      key={company.id}
                      onClick={() => handleCompanyChange(company.id)}
                      bg={
                        companyContext.currentCompany?.id === company.id
                          ? activeBg
                          : "transparent"
                      }
                      _hover={{ bg: dropdownItemHoverBg }}
                      color={dropdownItemColor}
                      fontSize="sm"
                    >
                      {company.name}
                    </MenuItem>
                  ))}
                </MenuList>
              </ChakraMenu>
            </Flex>
          )}
        </Box>
      )}

      <VStack spacing={0.5} align="stretch" mt={4} px={3}>
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const row = (
            <Flex
              align="center"
              px={3}
              py={3}
              cursor="pointer"
              borderRadius="6px"
              bg={isActive ? activeBg : "transparent"}
              color={isActive ? activeColor : subTextColor}
              _hover={{ bg: hoverBg }}
              transition="all 0.2s"
              justify={isCollapsed ? "center" : "flex-start"}
              position="relative"
              _before={
                isActive
                  ? {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "3px",
                      height: "70%",
                      bg: "cyan.400",
                      borderRadius: "0 4px 4px 0",
                    }
                  : undefined
              }
            >
              <Icon as={item.icon} boxSize={5} />
              {!isCollapsed && (
                <Text ml={4} fontSize="sm" fontWeight="medium">
                  {item.label}
                </Text>
              )}
            </Flex>
          );

          return (
            <Link key={item.path} to={item.path}>
              {isCollapsed ? (
                <Tooltip
                  label={item.label}
                  placement="right"
                  hasArrow
                  openDelay={150}
                >
                  {row}
                </Tooltip>
              ) : (
                row
              )}
            </Link>
          );
        })}

        <Box pt={4} mt={4} borderTop={`1px solid ${dividerColor}`}>
          {(() => {
            const logoutRow = (
              <Flex
                align="center"
                px={3}
                py={3}
                cursor="pointer"
                borderRadius="6px"
                color={subTextColor}
                _hover={{ bg: logoutHoverBg, color: logoutHoverColor }}
                transition="all 0.2s"
                onClick={handleLogout}
                justify={isCollapsed ? "center" : "flex-start"}
              >
                <Icon as={LogOut} boxSize={5} />
                {!isCollapsed && (
                  <Text ml={4} fontSize="sm" fontWeight="medium">
                    Logout
                  </Text>
                )}
              </Flex>
            );
            return isCollapsed ? (
              <Tooltip
                label="Logout"
                placement="right"
                hasArrow
                openDelay={150}
              >
                {logoutRow}
              </Tooltip>
            ) : (
              logoutRow
            );
          })()}
        </Box>
      </VStack>
    </Box>
  );
};
