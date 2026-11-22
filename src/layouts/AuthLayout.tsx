import { Box, Container, useColorModeValue } from '@chakra-ui/react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout = ({ children }: AuthLayoutProps) => {
  const bgColor = useColorModeValue('gray.50', 'gray.900');

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="md" py={20}>
        {children}
      </Container>
    </Box>
  );
};