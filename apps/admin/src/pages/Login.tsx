import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  Tooltip,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { Coffee, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

/**
 * A throwaway development login, prefilled so the app can be opened and closed
 * repeatedly during build-out.
 *
 * Gated on import.meta.env.DEV and read from the environment rather than
 * hardcoded, for two reasons: Vite strips the dead branch from a production
 * build, so these can never reach a deployed bundle; and the values live in
 * .env, which is gitignored, so a password is not committed to the repository.
 *
 * Delete the VITE_DEV_LOGIN_* vars — and the account itself — before the shop's
 * real data arrives.
 */
const devLogin = import.meta.env.DEV
  ? {
      email: import.meta.env.VITE_DEV_LOGIN_EMAIL ?? '',
      password: import.meta.env.VITE_DEV_LOGIN_PASSWORD ?? '',
    }
  : { email: '', password: '' };

export function Login() {
  const navigate = useNavigate();
  const { signIn, loading, error } = useAuthStore();
  const [email, setEmail] = useState(devLogin.email);
  const [password, setPassword] = useState(devLogin.password);
  const [showPassword, setShowPassword] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const isPrefilled = Boolean(devLogin.email) && email === devLogin.email;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch {
      // The store surfaces the message; nothing to do here.
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bgGradient="linear(to-br, #4a2f16, #a76f38)" p={4}>
      <Box w="full" maxW="400px" bg={cardBg} borderRadius="14px" boxShadow="0 20px 60px rgba(0,0,0,.3)" p={8}>
        <VStack spacing={2} mb={6}>
          <Icon as={Coffee} boxSize={10} color="primary.500" />
          <Heading size="md">Digita</Heading>
          <Text fontSize="sm" color="gray.500">
            Sales &amp; Inventory
          </Text>
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
              <Input
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Password</FormLabel>
              <InputGroup>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  pr="2.5rem"
                />
                <InputRightElement>
                  <Tooltip label={showPassword ? 'Hide password' : 'Show password'} openDelay={300}>
                    <Button
                      variant="ghost"
                      size="sm"
                      h="1.75rem"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </Tooltip>
                </InputRightElement>
              </InputGroup>
            </FormControl>
            <Button type="submit" w="full" isLoading={loading}>
              Sign in
            </Button>

            {isPrefilled && (
              <Flex align="center" gap={2} pt={1}>
                <Badge colorScheme="orange" fontSize="10px">
                  dev
                </Badge>
                <Text fontSize="xs" color={muted}>
                  Prefilled development account. Use the eye to read the password.
                </Text>
              </Flex>
            )}
          </VStack>
        </form>
      </Box>
    </Flex>
  );
}
