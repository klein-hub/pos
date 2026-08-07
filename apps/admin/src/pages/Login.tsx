import { useState, type FormEvent } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  Input,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { Coffee } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function Login() {
  const navigate = useNavigate();
  const { signIn, loading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const cardBg = useColorModeValue('white', 'gray.800');

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
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormControl>
            <Button type="submit" w="full" isLoading={loading}>
              Sign in
            </Button>
          </VStack>
        </form>
      </Box>
    </Flex>
  );
}
