import type { ReactNode } from 'react';
import { Badge, Box, Button, Container, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { ArrowLeft, Coffee, ShieldCheck } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

/** Frame for every access-console screen: who you are, and the way back. */
export function AdminShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { isSuperAdmin, displayName } = useAuthStore();
  const headerBg = useColorModeValue('whiteAlpha.900', 'blackAlpha.600');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  return (
    <Box minH="100vh">
      <Flex as="header" align="center" justify="space-between" px={{ base: 4, md: 8 }} h="60px"
        position="sticky" top={0} zIndex={10} bg={headerBg} backdropFilter="blur(10px)"
        borderBottom="1px solid" borderColor={border}>
        <Flex align="center" gap={3}>
          <Button as={RouterLink} to="/" size="sm" variant="ghost" leftIcon={<ArrowLeft size={16} />}>Apps</Button>
          <Icon as={Coffee} boxSize={5} color="primary.500" />
          <Text fontWeight="700">Access</Text>
        </Flex>
        <Flex align="center" gap={2}>
          {isSuperAdmin && (
            <Badge colorScheme="purple" fontSize="10px">
              <Flex align="center" gap={1}><ShieldCheck size={10} /> Digita admin</Flex>
            </Badge>
          )}
          <Text fontSize="sm" display={{ base: 'none', md: 'block' }}>{displayName}</Text>
        </Flex>
      </Flex>
      <Container maxW="1100px" py={8}>
        <Flex align="center" justify="space-between" mb={6} gap={3} wrap="wrap">
          <Text fontSize="2xl" fontWeight="700">{title}</Text>
          {actions}
        </Flex>
        {children}
      </Container>
    </Box>
  );
}
