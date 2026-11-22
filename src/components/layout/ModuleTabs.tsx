import {
  Box,
  Flex,
  HStack,
  Text,
  useColorModeValue,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { List, Settings, ChevronDown, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import {
  ConfigDefinition,
  getGroupedConfigs,
} from "../../config/configRegistry";

interface Props {
  section: ConfigDefinition["section"];
  activeTab: "list" | "config" | "analytics";
}

const sectionPath: Record<ConfigDefinition["section"], string> = {
  employees: "/employees",
  payroll: "/payroll",
  attendance: "/attendance",
};

const analyticsPath: Partial<Record<ConfigDefinition["section"], string>> = {
  payroll: "/payroll/analytics",
};

export const ModuleTabs = ({ section, activeTab }: Props) => {
  const navigate = useNavigate();
  const groups = getGroupedConfigs(section);
  const groupKeys = Object.keys(groups);

  const borderColor = useColorModeValue("gray.200", "gray.700");
  const activeColor = useColorModeValue("blue.600", "blue.300");
  const inactiveColor = useColorModeValue("gray.600", "gray.400");
  const activeBorder = useColorModeValue("blue.500", "blue.300");
  const hoverBg = useColorModeValue("gray.50", "gray.700");
  const popoverBg = useColorModeValue("white", "gray.800");
  const groupLabel = useColorModeValue("gray.400", "gray.500");

  const { isOpen, onOpen, onClose } = useDisclosure();
  const closeTimer = useRef<number | null>(null);

  const handleEnter = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    onOpen();
  };

  const handleLeave = () => {
    closeTimer.current = window.setTimeout(onClose, 120);
  };

  const handleConfigClick = () => {
    const firstGroup = groupKeys[0];
    if (firstGroup) {
      const first = groups[firstGroup][0];
      if (first) navigate(`${sectionPath[section]}/config/${first.slug}`);
    }
  };

  const isListActive = activeTab === "list";
  const isConfigActive = activeTab === "config";

  return (
    <Box borderBottom="1px solid" borderColor={borderColor} mb={6}>
      <HStack spacing={0} align="stretch">
        {/* Analytics Tab (Payroll only) */}
        {section === "payroll" && analyticsPath[section] && (
          <Flex
            data-payroll-tutorial={
              section === "payroll" ? "analytics-tab" : undefined
            }
            align="center"
            gap={2}
            px={4}
            py={3}
            cursor="pointer"
            borderBottom="2px solid"
            borderColor={
              activeTab === "analytics" ? activeBorder : "transparent"
            }
            color={activeTab === "analytics" ? activeColor : inactiveColor}
            fontWeight={activeTab === "analytics" ? "semibold" : "medium"}
            fontSize="sm"
            mb="-1px"
            _hover={{ color: activeColor, bg: hoverBg }}
            onClick={() => navigate(analyticsPath[section]!)}
            transition="all 0.15s ease"
          >
            <BarChart3 size={15} />
            <Text>Analytics</Text>
          </Flex>
        )}

        {/* List Tab */}
        <Flex
          data-payroll-tutorial={section === "payroll" ? "list-tab" : undefined}
          align="center"
          gap={2}
          px={4}
          py={3}
          cursor="pointer"
          borderBottom="2px solid"
          borderColor={isListActive ? activeBorder : "transparent"}
          color={isListActive ? activeColor : inactiveColor}
          fontWeight={isListActive ? "semibold" : "medium"}
          fontSize="sm"
          mb="-1px"
          _hover={{ color: activeColor, bg: hoverBg }}
          onClick={() => navigate(sectionPath[section])}
          transition="all 0.15s ease"
        >
          <List size={15} />
          <Text>List</Text>
        </Flex>

        {/* Configuration Tab with hover popover */}
        <Box onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <Popover
            isOpen={isOpen}
            onClose={onClose}
            placement="bottom-start"
            gutter={0}
            closeOnBlur
            returnFocusOnClose={false}
            isLazy
          >
            <PopoverTrigger>
              <Flex
                data-payroll-tutorial={
                  section === "payroll" ? "config-tab" : undefined
                }
                align="center"
                gap={2}
                px={4}
                py={3}
                cursor="pointer"
                borderBottom="2px solid"
                borderColor={isConfigActive ? activeBorder : "transparent"}
                color={isConfigActive ? activeColor : inactiveColor}
                fontWeight={isConfigActive ? "semibold" : "medium"}
                fontSize="sm"
                mb="-1px"
                _hover={{ color: activeColor, bg: hoverBg }}
                onClick={handleConfigClick}
                transition="all 0.15s ease"
              >
                <Settings size={15} />
                <Text>Configuration</Text>
                <ChevronDown size={14} />
              </Flex>
            </PopoverTrigger>
            <PopoverContent
              bg={popoverBg}
              borderColor={borderColor}
              boxShadow="lg"
              w="260px"
              _focus={{ outline: "none", boxShadow: "lg" }}
              onMouseEnter={handleEnter}
              onMouseLeave={handleLeave}
            >
              <PopoverBody p={2}>
                <VStack align="stretch" spacing={1}>
                  {groupKeys.map((groupName) => (
                    <Box key={groupName}>
                      <Text
                        fontSize="xs"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        color={groupLabel}
                        fontWeight="bold"
                        px={3}
                        pt={2}
                        pb={1}
                      >
                        {groupName}
                      </Text>
                      {groups[groupName].map((c) => (
                        <Flex
                          key={c.slug}
                          px={3}
                          py={2}
                          rounded="md"
                          cursor="pointer"
                          fontSize="sm"
                          color={inactiveColor}
                          _hover={{ bg: hoverBg, color: activeColor }}
                          onClick={() => {
                            onClose();
                            navigate(
                              `${sectionPath[section]}/config/${c.slug}`,
                            );
                          }}
                        >
                          {c.title}
                        </Flex>
                      ))}
                    </Box>
                  ))}
                </VStack>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </Box>
      </HStack>
    </Box>
  );
};
