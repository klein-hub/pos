import { Button as ChakraButton, ButtonProps } from '@chakra-ui/react';

export const Button = ({ children, colorScheme = 'cyan', variant, ...props }: ButtonProps) => {
  return (
    <ChakraButton
      px={6}
      rounded="lg"
      fontWeight="medium"
      colorScheme={colorScheme}
      variant={variant}
      {...props}
    >
      {children}
    </ChakraButton>
  );
};