import { Box, Flex, IconButton, Text, useColorMode, useColorModeValue } from '@chakra-ui/react';
import { Moon, Sun } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { BackToHub } from '../components/BackToHub';
import { DataModeBadge, DataModeBanner } from '../components/DataModeBar';
import { Sidebar } from '../components/layout/Sidebar';
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/menu': 'Menu & Margins',
  '/inventory': 'Inventory',
  '/purchasing': 'Purchasing',
  '/recipes': 'Recipes',
  '/counts': 'Stock Counts',
  '/waste': 'Waste',
  '/settings': 'Settings',
};

function LayoutContent() {
  const { isCollapsed } = useSidebar();
  const { colorMode, toggleColorMode } = useColorMode();
  const location = useLocation();
  const mainBg = useColorModeValue('#f6f4f1', 'gray.900');
  const headerBg = useColorModeValue('whiteAlpha.800', 'blackAlpha.500');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const title =
    Object.entries(TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] ?? 'Digita';

  return (
    <Flex minH="100vh" bg={mainBg}>
      <Sidebar />
      <Box flex="1" ml={isCollapsed ? '76px' : '248px'} transition="margin 180ms ease">
        <Flex
          as="header"
          align="center"
          justify="space-between"
          px={6}
          h="64px"
          position="sticky"
          top={0}
          zIndex={10}
          bg={headerBg}
          backdropFilter="blur(8px)"
          borderBottom="1px solid"
          borderColor={border}
        >
          <Text fontSize="lg" fontWeight="600">
            {title}
          </Text>
          <Flex align="center" gap={3}>
            <BackToHub />
            <DataModeBadge />
            <IconButton
              aria-label="Toggle colour mode"
              icon={colorMode === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              variant="ghost"
              size="sm"
              onClick={toggleColorMode}
            />
          </Flex>
        </Flex>
        <Box as="main" p={6}>
          <DataModeBanner />
          <Outlet />
        </Box>
      </Box>
    </Flex>
  );
}

export function AdminLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
