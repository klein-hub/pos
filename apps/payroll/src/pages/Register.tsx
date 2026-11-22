import { useState } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  useColorModeValue,
  useColorMode,
  HStack,
  Icon,
  FormControl,
  FormLabel,
  InputGroup,
  InputRightElement,
  IconButton,
  FormErrorMessage,
  Grid,
  useToast,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { Rocket, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../store/authStore";
import { Card } from "../components/ui/Card";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const Register = () => {
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const { loading, register } = useAuthStore();
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();

  const validateForm = () => {
    const newErrors: FormErrors = {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
    };
    let isValid = true;

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
      isValid = false;
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
      isValid = false;
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
      isValid = false;
    } else if (
      !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
        formData.password,
      )
    ) {
      newErrors.password =
        "Password must include uppercase, lowercase, number and special character";
      isValid = false;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        roleName: 'user',
      });

      toast({
        title: "Registration successful",
        description: "Welcome to Propel! Please sign in with your new account.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const bgColor = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");

  return (
    <Box minH="100vh" bg={bgColor} py={20}>
      <IconButton
        aria-label="Toggle color mode"
        icon={colorMode === "light" ? <Moon size={20} /> : <Sun size={20} />}
        onClick={toggleColorMode}
        position="absolute"
        top={4}
        right={4}
        rounded="full"
      />

      <Card maxW="2xl" mx="auto" bg={cardBg} p={8}>
        <VStack spacing={8} align="stretch">
          <VStack spacing={3} align="center">
            <Box p={3} bg="cyan.100" rounded="full" color="cyan.500">
              <Icon as={Rocket} boxSize={8} />
            </Box>
            <Heading size="xl">Create Account</Heading>
            <Text color="gray.500">Get started with Propel</Text>
          </VStack>

          <form onSubmit={handleSubmit}>
            <VStack spacing={6}>
              <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                <FormControl isInvalid={!!errors.firstName}>
                  <FormLabel>First Name</FormLabel>
                  <Input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter your first name"
                  />
                  <FormErrorMessage>{errors.firstName}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.lastName}>
                  <FormLabel>Last Name</FormLabel>
                  <Input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter your last name"
                  />
                  <FormErrorMessage>{errors.lastName}</FormErrorMessage>
                </FormControl>
              </Grid>

              <FormControl isInvalid={!!errors.email}>
                <FormLabel>Email</FormLabel>
                <Input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                />
                <FormErrorMessage>{errors.email}</FormErrorMessage>
              </FormControl>

              <Grid templateColumns="repeat(2, 1fr)" gap={4} w="full">
                <FormControl isInvalid={!!errors.password}>
                  <FormLabel>Password</FormLabel>
                  <InputGroup>
                    <Input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a password"
                    />
                    <InputRightElement>
                      <IconButton
                        aria-label="Toggle password visibility"
                        icon={
                          showPassword ? (
                            <EyeOff size={18} />
                          ) : (
                            <Eye size={18} />
                          )
                        }
                        variant="ghost"
                        onClick={() => setShowPassword(!showPassword)}
                      />
                    </InputRightElement>
                  </InputGroup>
                  <FormErrorMessage>{errors.password}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.confirmPassword}>
                  <FormLabel>Confirm Password</FormLabel>
                  <Input
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                  />
                  <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
                </FormControl>
              </Grid>

              <Button
                type="submit"
                colorScheme="cyan"
                size="lg"
                w="full"
                isLoading={loading}
              >
                Create Account
              </Button>
            </VStack>
          </form>

          <HStack justify="center" spacing={1}>
            <Text color="gray.500">Already have an account?</Text>
            <Button as={Link} to="/login" variant="link" color="cyan.500">
              Sign in
            </Button>
          </HStack>
        </VStack>
      </Card>
    </Box>
  );
};
