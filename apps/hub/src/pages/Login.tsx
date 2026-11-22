import { useState, type FormEvent } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Flex, FormControl, FormLabel, Heading, Icon,
  Input, InputGroup, InputRightElement, Text, Tooltip, VStack, useColorModeValue,
} from '@chakra-ui/react';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

/**
 * Prefilled throwaway development login. Gated on import.meta.env.DEV and read
 * from .env, so it is stripped from production builds and no password is
 * committed. Same arrangement as the admin app.
 */
const devLogin = import.meta.env.DEV
  ? {
      email: import.meta.env.VITE_DEV_LOGIN_EMAIL ?? '',
      password: import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? '',
    }
  : { email: '', password: '' };

export function Login() {
  const { signIn, loading, error } = useAuthStore();
  const [email, setEmail] = useState(devLogin.email);
  const [password, setPassword] = useState(devLogin.password);
  const [show, setShow] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const prefilled = Boolean(devLogin.email) && email === devLogin.email;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch {
      // the store surfaces the message
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bgGradient="linear(to-br, #4a2f16, #a76f38)" p={4}>
      <Box w="full" maxW="400px" bg={cardBg} borderRadius="14px" boxShadow="0 20px 60px rgba(0,0,0,.3)" p={8}>
        <VStack spacing={2} mb={6}>
          <Icon as={Coffee} boxSize={10} color="primary.500" />
          <Heading size="md">Digita</Heading>
          <Text fontSize="sm" color={muted}>Sign in once for every app</Text>
        </VStack>

        {error && (
          <Alert status="error" borderRadius="8px" mb={4} fontSize="sm">
            <AlertIcon />
            {error}
          </Alert>
        )}

        <form onSubmit={onSubmit}>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Password</FormLabel>
              <InputGroup>
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  pr="2.5rem"
                />
                <InputRightElement>
                  <Tooltip label={show ? 'Hide password' : 'Show password'} openDelay={300}>
                    <Button variant="ghost" size="sm" h="1.75rem" onClick={() => setShow((v) => !v)}
                      aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </Tooltip>
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <Button type="submit" w="full" isLoading={loading}>Sign in</Button>
            {prefilled && (
              <Flex align="center" gap={2} pt={1}>
                <Badge colorScheme="orange" fontSize="10px">dev</Badge>
                <Text fontSize="xs" color={muted}>Prefilled development account.</Text>
              </Flex>
            )}
          </VStack>
        </form>
      </Box>
    </Flex>
  );
}
