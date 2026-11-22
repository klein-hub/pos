import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Container,
  Flex,
  Icon,
  Input,
  InputGroup,
  InputLeftElement,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  SimpleGrid,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  Banknote,
  BarChart3,
  Boxes,
  ChevronDown,
  Clock,
  Coffee,
  LogOut,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { appHref, withHandoff, type LaunchableApp } from '@digita/core';
import { apps } from '../lib/apps';
import { useAuthStore } from '../store/authStore';

/** The registry names icons as strings so it stays free of React imports. */
const ICONS: Record<string, LucideIcon> = {
  BarChart3,
  Boxes,
  ShoppingCart,
  Banknote,
  Users,
  Clock,
  ReceiptText,
};

export function Launcher() {
  const { displayName, isSuperAdmin, signOut, handoff } = useAuthStore();
  const [query, setQuery] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const headerBg = useColorModeValue('whiteAlpha.900', 'blackAlpha.600');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q),
    );
  }, [query]);

  /**
   * Opening an app carries the current session with it, so a user signed in
   * here is not asked to sign in again one click later. The apps sit on
   * different ports, and a port is part of an origin, so nothing is shared
   * between them automatically — see withHandoff.
   */
  const open = (app: LaunchableApp) => {
    const href = appHref(app);
    if (!href) return;
    window.location.href = withHandoff(href, handoff());
  };

  return (
    <Box minH="100vh">
      <Flex
        as="header"
        align="center"
        justify="space-between"
        px={{ base: 4, md: 8 }}
        h="60px"
        position="sticky"
        top={0}
        zIndex={10}
        bg={headerBg}
        backdropFilter="blur(10px)"
        borderBottom="1px solid"
        borderColor={border}
      >
        <Flex align="center" gap={2.5}>
          <Icon as={Coffee} boxSize={6} color="primary.500" />
          <Text fontWeight="700" fontSize="lg">
            Digita
          </Text>
        </Flex>

        <Menu placement="bottom-end">
          <MenuButton>
            <Flex align="center" gap={2}>
              <Flex
                align="center"
                justify="center"
                boxSize="30px"
                borderRadius="full"
                bg="primary.500"
                color="white"
                fontSize="xs"
                fontWeight="700"
              >
                {(displayName ?? '?').slice(0, 2).toUpperCase()}
              </Flex>
              <Text fontSize="sm" display={{ base: 'none', md: 'block' }}>
                {displayName}
              </Text>
              <ChevronDown size={14} />
            </Flex>
          </MenuButton>
          <MenuList>
            <Box px={3} py={2}>
              <Text fontSize="sm" fontWeight="600">
                {displayName}
              </Text>
              {isSuperAdmin && (
                <Badge colorScheme="purple" fontSize="10px" mt={1}>
                  <Flex align="center" gap={1}>
                    <ShieldCheck size={10} /> super admin
                  </Flex>
                </Badge>
              )}
            </Box>
            <MenuDivider />
            <MenuItem icon={<LogOut size={14} />} onClick={() => void signOut()}>
              Sign out
            </MenuItem>
          </MenuList>
        </Menu>
      </Flex>

      <Container maxW="1100px" py={{ base: 6, md: 10 }}>
        <InputGroup mb={8} maxW="420px" mx="auto">
          <InputLeftElement pointerEvents="none" color={muted}>
            <Search size={16} />
          </InputLeftElement>
          <Input
            bg={cardBg}
            placeholder="Search apps…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            borderRadius="10px"
            autoFocus
          />
        </InputGroup>

        <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={{ base: 4, md: 6 }}>
          {visible.map((app) => {
            const AppIcon = ICONS[app.icon] ?? Boxes;
            const ready = app.status === 'ready';
            return (
              <Tooltip
                key={app.id}
                label={ready ? app.summary : `${app.summary} — not built yet`}
                openDelay={400}
                placement="bottom"
              >
                <Flex
                  direction="column"
                  align="center"
                  gap={3}
                  p={4}
                  borderRadius="14px"
                  cursor={ready ? 'pointer' : 'not-allowed'}
                  opacity={ready ? 1 : 0.45}
                  transition="transform 120ms ease, background 120ms ease"
                  _hover={ready ? { bg: cardBg, transform: 'translateY(-2px)' } : undefined}
                  onClick={() => ready && open(app)}
                  role="button"
                  aria-disabled={!ready}
                >
                  <Flex
                    align="center"
                    justify="center"
                    boxSize="72px"
                    borderRadius="18px"
                    bg={cardBg}
                    boxShadow="0 2px 10px rgba(0,0,0,.08)"
                  >
                    <Icon as={AppIcon} boxSize={8} color={app.colour} strokeWidth={1.75} />
                  </Flex>
                  <Box textAlign="center">
                    <Text fontSize="sm" fontWeight="600" noOfLines={1}>
                      {app.name}
                    </Text>
                    {!ready && (
                      <Text fontSize="10px" color={muted}>
                        coming soon
                      </Text>
                    )}
                  </Box>
                </Flex>
              </Tooltip>
            );
          })}
        </SimpleGrid>

        {visible.length === 0 && (
          <Text textAlign="center" color={muted} fontSize="sm" py={10}>
            No app matches “{query}”.
          </Text>
        )}

        <Text textAlign="center" fontSize="xs" color={muted} mt={12}>
          {isSuperAdmin
            ? 'Signed in as a super admin — the apps you open here will not ask you to sign in again.'
            : 'Opening an app carries your session across, so you should not need to sign in again.'}
        </Text>
      </Container>
    </Box>
  );
}
