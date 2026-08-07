import {
  Avatar,
  Box,
  Divider,
  Flex,
  Icon,
  IconButton,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  Boxes,
  ChefHat,
  ClipboardList,
  Coffee,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Tags,
  Trash2,
  Truck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuthStore } from '../../store/authStore';

const menuGroups = [
  {
    label: 'Monitor',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Tags, label: 'Menu & Margins', path: '/menu' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { icon: Boxes, label: 'Items', path: '/inventory' },
      { icon: Truck, label: 'Purchasing', path: '/purchasing' },
      { icon: ChefHat, label: 'Recipes', path: '/recipes' },
      { icon: ClipboardList, label: 'Stock Counts', path: '/counts' },
      { icon: Trash2, label: 'Waste', path: '/waste' },
    ],
  },
  {
    label: 'Admin',
    items: [{ icon: Settings, label: 'Settings', path: '/settings' }],
  },
];

export function Sidebar() {
  const { isCollapsed, toggleSidebar } = useSidebar();
  const location = useLocation();
  const { profile, user, signOut } = useAuthStore();

  const bg = useColorModeValue('white', 'gray.900');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.500', 'whiteAlpha.700');
  const hoverBg = useColorModeValue('gray.100', 'whiteAlpha.200');
  const activeBg = useColorModeValue('primary.50', 'whiteAlpha.200');
  const activeColor = useColorModeValue('primary.700', 'white');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const width = isCollapsed ? '76px' : '248px';
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || user?.email;

  return (
    <Box
      as="nav"
      position="fixed"
      insetY={0}
      left={0}
      w={width}
      bg={bg}
      borderRight="1px solid"
      borderColor={border}
      transition="width 180ms ease"
      display="flex"
      flexDirection="column"
      zIndex={20}
    >
      <Flex align="center" gap={3} px={isCollapsed ? 0 : 5} py={5} justify={isCollapsed ? 'center' : 'flex-start'}>
        <Icon as={Coffee} boxSize={7} color="primary.500" />
        {!isCollapsed && (
          <Box>
            <Text fontWeight="700" fontSize="md" color={textColor} lineHeight="1.1">
              Digita
            </Text>
            <Text fontSize="xs" color={mutedColor}>
              Sales &amp; Inventory
            </Text>
          </Box>
        )}
      </Flex>

      <Divider borderColor={border} />

      <VStack align="stretch" spacing={1} flex="1" overflowY="auto" px={2} py={3}>
        {menuGroups.map((group) => (
          <Box key={group.label} pb={2}>
            {!isCollapsed && (
              <Text px={3} pb={1} fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={mutedColor}>
                {group.label.toUpperCase()}
              </Text>
            )}
            {group.items.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <Tooltip
                  key={item.path}
                  label={item.label}
                  placement="right"
                  isDisabled={!isCollapsed}
                  openDelay={300}
                >
                  <Flex
                    as={Link}
                    to={item.path}
                    align="center"
                    gap={3}
                    px={3}
                    py={2.5}
                    borderRadius="8px"
                    bg={active ? activeBg : 'transparent'}
                    color={active ? activeColor : textColor}
                    fontWeight={active ? '600' : '400'}
                    fontSize="sm"
                    _hover={{ bg: active ? activeBg : hoverBg }}
                    justify={isCollapsed ? 'center' : 'flex-start'}
                  >
                    <Icon as={item.icon} boxSize={5} />
                    {!isCollapsed && <Text>{item.label}</Text>}
                  </Flex>
                </Tooltip>
              );
            })}
          </Box>
        ))}
      </VStack>

      <Divider borderColor={border} />

      <Flex align="center" gap={3} p={3} justify={isCollapsed ? 'center' : 'space-between'}>
        {!isCollapsed && (
          <Flex align="center" gap={2} minW={0}>
            <Avatar size="sm" name={name ?? undefined} />
            <Box minW={0}>
              <Text fontSize="sm" color={textColor} noOfLines={1}>
                {name}
              </Text>
              <Text fontSize="xs" color={mutedColor} noOfLines={1}>
                {profile?.role ?? 'No role'}
              </Text>
            </Box>
          </Flex>
        )}
        <Tooltip label="Sign out" placement="right" openDelay={300}>
          <IconButton
            aria-label="Sign out"
            icon={<LogOut size={18} />}
            variant="ghost"
            size="sm"
            onClick={() => void signOut()}
          />
        </Tooltip>
      </Flex>

      <IconButton
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        icon={<Menu size={18} />}
        variant="ghost"
        size="sm"
        m={2}
        onClick={toggleSidebar}
      />
    </Box>
  );
}
