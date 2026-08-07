import { Box, Flex, Heading, Icon, Text, useColorModeValue } from '@chakra-ui/react';
import { Hammer } from 'lucide-react';

/**
 * Placeholder for pages whose build phase has not landed yet. Naming the phase
 * keeps the roadmap visible in the product itself rather than only in SPEC.md.
 */
export function ComingSoon({ title, phase, blurb }: { title: string; phase: string; blurb: string }) {
  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');
  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');

  return (
    <Flex
      bg={cardBg}
      border="1px dashed"
      borderColor={border}
      borderRadius="12px"
      p={12}
      align="center"
      justify="center"
    >
      <Box textAlign="center" maxW="440px">
        <Icon as={Hammer} boxSize={8} color="primary.400" mb={3} />
        <Heading size="md" mb={2}>
          {title}
        </Heading>
        <Text fontSize="sm" color={muted} mb={3}>
          {blurb}
        </Text>
        <Text fontSize="xs" fontWeight="600" color="primary.600">
          {phase}
        </Text>
      </Box>
    </Flex>
  );
}
