import { Box, useColorModeValue } from '@chakra-ui/react';

interface CardProps {
  children: React.ReactNode;
  [key: string]: any;
}

export const Card = ({ children, ...props }: CardProps) => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');

  return (
    <Box
      bg={bgColor}
      borderWidth={1}
      borderColor={borderColor}
      rounded="xl"
      shadow="sm"
      {...props}
    >
      {children}
    </Box>
  );
};