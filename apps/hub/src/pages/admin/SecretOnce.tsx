import { useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Code, Flex, Modal, ModalBody, ModalContent, ModalFooter,
  ModalHeader, ModalOverlay, Text,
} from '@chakra-ui/react';
import { Check, Copy } from 'lucide-react';

/**
 * A temporary password, shown exactly once.
 *
 * Nothing stores it — not the database (only a hash exists), not this app. If
 * the dialog is closed without copying, the only remedy is another reset,
 * which is the right trade: a password that can be re-displayed is a password
 * that can be stolen later.
 */
export function SecretOnce({ email, password, onClose }: { email: string; password: string | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal isOpen={password !== null} onClose={onClose} closeOnOverlayClick={false} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Temporary password</ModalHeader>
        <ModalBody>
          <Text fontSize="sm" mb={3}>Give this to <b>{email}</b>. They should change it after signing in.</Text>
          <Flex align="center" gap={2}>
            <Code fontSize="lg" px={3} py={2} borderRadius="8px" flex="1" textAlign="center">{password}</Code>
            <Button
              leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={() => { if (password) void navigator.clipboard.writeText(password); setCopied(true); }}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </Flex>
          <Alert status="warning" mt={4} borderRadius="8px" fontSize="xs">
            <AlertIcon />
            <Box>This is shown once and stored nowhere. Lose it and you will need to reset it again.</Box>
          </Alert>
        </ModalBody>
        <ModalFooter><Button onClick={onClose}>Done</Button></ModalFooter>
      </ModalContent>
    </Modal>
  );
}
