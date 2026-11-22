import { Box, Flex, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { LucideIcon } from 'lucide-react';

interface AdminStatsProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  bgColor?: string;
}

export const AdminStats = ({ label, value, icon, bgColor = 'cyan' }: AdminStatsProps) => {
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.900', 'white');
  const labelColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Box
      bg={cardBg}
      p={6}
      rounded="xl"
      shadow="sm"
      borderWidth={1}
      borderColor={borderColor}
      transition="all 0.2s"
      _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
    >
      <Flex align="center" mb={4}>
        <Flex
          w={12}
          h={12}
          align="center"
          justify="center"
          borderRadius="8px"
          bg={`${bgColor}.100`}
          mr={4}
        >
          <Icon as={icon} boxSize={6} color={`${bgColor}.600`} />
        </Flex>
        <Box flex={1}>
          <Text fontSize="sm" color={labelColor} fontWeight="medium">
            {label}
          </Text>
          <Text fontSize="2xl" fontWeight="bold" color={textColor}>
            {value}
          </Text>
        </Box>
      </Flex>
    </Box>
  );
};
