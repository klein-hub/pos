import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Kbd,
  Flex,
  Text,
  VStack,
  Box,
  useDisclosure,
  HStack,
  Divider,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

interface ShortcutRow {
  keys: string[];
  label: string;
  scope?: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: ['?'], label: 'Show this help', scope: 'Global' },
  { keys: ['g', 'e'], label: 'Go to Employees', scope: 'Global' },
  { keys: ['g', 'p'], label: 'Go to Payroll', scope: 'Global' },
  { keys: ['g', 'd'], label: 'Go to Dashboard', scope: 'Global' },
  { keys: ['n'], label: 'New employee', scope: 'Employees' },
  { keys: ['/'], label: 'Focus search', scope: 'Employees' },
  { keys: ['Esc'], label: 'Close dialog', scope: 'Modals' },
];

/**
 * Global help dialog showing the app's keyboard shortcuts. Triggered by `?`.
 * Also wires a tiny "go to" leader sequence: `g` then `e/p/d`.
 */
export const KeyboardShortcutsHelp = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

  // `?` opens help
  useKeyboardShortcuts([
    { key: '?', shift: true, handler: onOpen, description: 'Show shortcuts' },
  ]);

  // Tiny leader-key flow: press `g` then `e|p|d` within 1s.
  useKeyboardShortcuts([
    {
      key: 'g',
      handler: () => {
        const onNext = (ev: KeyboardEvent) => {
          // ignore if user is typing
          const t = ev.target as HTMLElement | null;
          const editable =
            t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
          if (editable) return cleanup();
          if (ev.key === 'e') navigate('/employees');
          else if (ev.key === 'p') navigate('/payroll');
          else if (ev.key === 'd') navigate('/');
          cleanup();
        };
        const cleanup = () => {
          window.removeEventListener('keydown', onNext, true);
          clearTimeout(timer);
        };
        const timer = window.setTimeout(cleanup, 1000);
        window.addEventListener('keydown', onNext, true);
      },
    },
  ]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Keyboard Shortcuts</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack align="stretch" spacing={3}>
            {['Global', 'Employees', 'Modals'].map((scope) => (
              <Box key={scope}>
                <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="0.05em" mb={2}>
                  {scope}
                </Text>
                <VStack align="stretch" spacing={1}>
                  {SHORTCUTS.filter((s) => s.scope === scope).map((s, i) => (
                    <Flex key={i} justify="space-between" align="center" py={1}>
                      <Text fontSize="sm" color="gray.700">{s.label}</Text>
                      <HStack spacing={1}>
                        {s.keys.map((k, j) => (
                          <Kbd key={j} fontSize="xs">{k}</Kbd>
                        ))}
                      </HStack>
                    </Flex>
                  ))}
                </VStack>
                {scope !== 'Modals' && <Divider mt={3} />}
              </Box>
            ))}
            <Text fontSize="xs" color="gray.400" mt={2}>
              Tip: press <Kbd fontSize="xs">?</Kbd> any time to reopen this.
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
