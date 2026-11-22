import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  Menu,
  MenuButton,
  MenuDivider,
  MenuItem,
  MenuList,
  Spinner,
  Text,
  Tooltip,
  useColorModeValue,
} from '@chakra-ui/react';
import { AlertTriangle, ChevronDown, Database, HardDrive, RefreshCw, Wifi } from 'lucide-react';
import { DATA_MODES, DATA_MODE_INFO, type DataMode } from '@digita/core';
import { useDataModeStore } from '../store/dataModeStore';

const ICON: Record<DataMode, typeof Database> = {
  live: Wifi,
  demo: Database,
  local: HardDrive,
};

const SCHEME: Record<DataMode, string> = {
  live: 'green',
  demo: 'purple',
  local: 'orange',
};

/**
 * The current data source, always visible in the header.
 *
 * Shown to everyone, not only to those who can change it: knowing which data
 * you are looking at matters more than being able to switch it. A badge that
 * only super admins see would leave everyone else unable to tell demo figures
 * from real ones.
 */
export function DataModeBadge() {
  const { mode, status, canSwitch, setMode, reload } = useDataModeStore();
  const info = DATA_MODE_INFO[mode];
  const Icon = ICON[mode];
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  // Hoisted: calling a hook inside the map below would make the number of
  // hooks depend on the list, which React forbids.
  const selectedBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100');

  const badge = (
    <Badge
      colorScheme={SCHEME[mode]}
      borderRadius="6px"
      px={2}
      py={1}
      display="flex"
      alignItems="center"
      gap={1.5}
      fontSize="xs"
      textTransform="none"
    >
      <Icon size={13} />
      {info.label}
      {status === 'loading' && <Spinner size="xs" />}
    </Badge>
  );

  if (!canSwitch) {
    return (
      <Tooltip label={info.summary} openDelay={200}>
        <Box>{badge}</Box>
      </Tooltip>
    );
  }

  return (
    <Menu placement="bottom-end">
      <MenuButton as={Button} variant="ghost" size="sm" rightIcon={<ChevronDown size={14} />} px={2}>
        {badge}
      </MenuButton>
      <MenuList minW="320px" py={2}>
        <Text px={3} pb={2} fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={muted}>
          DATA SOURCE
        </Text>
        {DATA_MODES.map((m) => {
          const d = DATA_MODE_INFO[m];
          const ItemIcon = ICON[m];
          return (
            <MenuItem
              key={m}
              onClick={() => void setMode(m)}
              bg={m === mode ? selectedBg : undefined}
            >
              <Flex align="flex-start" gap={3} w="full">
                <Box pt={0.5}>
                  <ItemIcon size={16} />
                </Box>
                <Box flex="1" minW={0}>
                  <Flex align="center" gap={2}>
                    <Text fontSize="sm" fontWeight="600">
                      {d.label}
                    </Text>
                    {!d.persists && (
                      <Badge fontSize="9px" colorScheme="orange">
                        nothing saved
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="xs" color={muted} whiteSpace="normal">
                    {d.summary}
                  </Text>
                </Box>
              </Flex>
            </MenuItem>
          );
        })}
        <MenuDivider />
        <MenuItem icon={<RefreshCw size={14} />} onClick={() => void reload()}>
          <Text fontSize="sm">Reload from source</Text>
        </MenuItem>
      </MenuList>
    </Menu>
  );
}

/**
 * A full-width warning whenever the screen is not showing the real shop.
 *
 * Deliberately not dismissible. Someone who forgets which mode they are in and
 * posts a stock count or reads a margin off demo figures has been actively
 * misled by the app, so the cost of a persistent strip is much lower than the
 * cost of letting it be closed and forgotten.
 */
export function DataModeBanner() {
  const { mode, status, error, fellBackOffline, reload, canSwitch, setMode } = useDataModeStore();
  const info = DATA_MODE_INFO[mode];

  if (status === 'error') {
    return (
      <Alert status="error" borderRadius="10px" mb={4} fontSize="sm">
        <AlertIcon />
        <Box flex="1">
          <Text fontWeight="600">Could not load {DATA_MODE_INFO[mode].label.toLowerCase()} data</Text>
          <Text fontSize="xs">{error}</Text>
        </Box>
        <Flex gap={2}>
          <Button size="xs" onClick={() => void reload()}>
            Retry
          </Button>
          {canSwitch && (
            <Button size="xs" variant="outline" onClick={() => void setMode('local')}>
              Use offline sample
            </Button>
          )}
        </Flex>
      </Alert>
    );
  }

  if (!info.warning) return null;

  return (
    <Alert
      status={mode === 'local' ? 'warning' : 'info'}
      borderRadius="10px"
      mb={4}
      fontSize="sm"
      alignItems="flex-start"
    >
      <Box pt={0.5} pr={3}>
        <AlertTriangle size={18} />
      </Box>
      <Box flex="1">
        <Text fontWeight="600">
          {info.label}
          {fellBackOffline && ' — the database could not be reached'}
        </Text>
        <Text fontSize="xs">{info.warning}</Text>
        {fellBackOffline && (
          <Text fontSize="xs" mt={1}>
            {error}
          </Text>
        )}
      </Box>
      {fellBackOffline && (
        <Button size="xs" onClick={() => void setMode('live')} isDisabled={!canSwitch}>
          Try live again
        </Button>
      )}
    </Alert>
  );
}
