import { Input as ChakraInput, InputProps, FormControl, FormLabel } from '@chakra-ui/react';

interface CustomInputProps extends InputProps {
  label?: string;
}

export const Input = ({ label, ...props }: CustomInputProps) => {
  return (
    <FormControl>
      {label && <FormLabel>{label}</FormLabel>}
      <ChakraInput
        px={4}
        py={2}
        rounded="lg"
        {...props}
      />
    </FormControl>
  );
};