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
  useToast,
} from "@chakra-ui/react";
import { Link, useNavigate } from "react-router-dom";
import { Rocket, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Input } from "../components/ui/Input";
import { useAuthStore } from "../store/authStore";
import { Card } from "../components/ui/Card";

export const Login = () => {
  const [email, setEmail] = useState("kleinhans.esc@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const { signIn, sendPasswordReset, loading } = useAuthStore();
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const toast = useToast();

  const validateForm = () => {
    const newErrors = { email: "", password: "" };
    let isValid = true;

    if (!email) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email format";
      isValid = false;
    }

    if (!password) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      await signIn(email, password);

      // Fetch user's assigned companies (and detect super_admin)
      const { fetchUserCompanies } = useAuthStore.getState();
      await fetchUserCompanies();

      const { userRole } = useAuthStore.getState();
      const { user } = useAuthStore.getState();
      const requiresPasswordChange = Boolean(
        user?.user_metadata?.requires_password_change ||
        user?.app_metadata?.requires_password_change,
      );

      if (requiresPasswordChange) {
        toast({
          title: "Password update required",
          description:
            "This account is using a temporary password. Please set a new password.",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
        navigate("/change-password");
        return;
      }

      toast({
        title: "Login successful",
        description: "Welcome back to Propel!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Routing rules:
      // - super_admin: go straight to admin dashboard and choose a company from the sidebar.
      // - everyone else: route directly to their role home using the company from profiles.
      if (userRole === "super_admin") {
        navigate("/admin");
      } else if (userRole === "employee") {
        navigate("/my-payslips");
      } else if (userRole === "admin") {
        navigate("/dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description:
          error.message || "Please check your credentials and try again",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast({
        title: "Email required",
        description: "Enter your email first, then request a reset link.",
        status: "warning",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address.",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    try {
      await sendPasswordReset(trimmedEmail);
      toast({
        title: "Password reset sent",
        description:
          "Check your email for the reset link. It will return you to this app.",
        status: "success",
        duration: 6000,
        isClosable: true,
      });
    } catch (error: any) {
      toast({
        title: "Reset request failed",
        description: error.message || "Could not send reset email.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
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

      <Card maxW="md" mx="auto" bg={cardBg} p={8}>
        <VStack spacing={8} align="stretch">
          <VStack spacing={3} align="center">
            <Box p={3} bg="cyan.100" rounded="full" color="cyan.500">
              <Icon as={Rocket} boxSize={8} />
            </Box>
            <Heading size="xl">Welcome Back</Heading>
            <Text color="gray.500">Sign in to continue to Propel</Text>
          </VStack>

          <form onSubmit={handleSubmit}>
            <VStack spacing={4}>
              <FormControl isInvalid={!!errors.email}>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
                <FormErrorMessage>{errors.email}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.password}>
                <FormLabel>Password</FormLabel>
                <InputGroup>
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label="Toggle password visibility"
                      icon={
                        showPassword ? <EyeOff size={18} /> : <Eye size={18} />
                      }
                      variant="ghost"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </InputRightElement>
                </InputGroup>
                <FormErrorMessage>{errors.password}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                colorScheme="cyan"
                size="lg"
                w="full"
                isLoading={loading}
              >
                Sign In
              </Button>
            </VStack>
          </form>

          <HStack justify="center" spacing={1}>
            <Text color="gray.500">Don't have an account?</Text>
            <Button as={Link} to="/register" variant="link" color="cyan.500">
              Sign up
            </Button>
          </HStack>

          <HStack justify="center" spacing={1}>
            <Text color="gray.500">Forgot your password?</Text>
            <Button
              variant="link"
              color="cyan.500"
              onClick={handleForgotPassword}
            >
              Send reset link
            </Button>
          </HStack>

          <Box borderWidth={1} p={4} rounded="md" borderStyle="dashed">
            <Text fontSize="sm" color="gray.500" textAlign="center">
              Demo Credentials:
              <br />
              Email: demo@propel.com
              <br />
              Password: Demo123!
            </Text>
          </Box>
        </VStack>
      </Card>
    </Box>
  );
};
