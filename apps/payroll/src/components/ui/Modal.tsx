import {
  Modal as ChakraModal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
} from '@chakra-ui/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  isLoading?: boolean;
  size?: string;
}

export const Modal = ({ isOpen, onClose, title, children, onSubmit, isLoading, size = 'md' }: ModalProps) => {
  return (
    <ChakraModal isOpen={isOpen} onClose={onClose} size={size} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {children}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" colorScheme="red" mr={3} onClick={onClose}>
            Cancel
          </Button>
          {onSubmit && (
            <Button colorScheme="cyan" onClick={onSubmit} isLoading={isLoading}>
              Save
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </ChakraModal>
  );
};