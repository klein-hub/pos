import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/authStore";

export const ChangePassword = () => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const userRole = useAuthStore((state) => state.userRole);

  const passwordError = useMemo(() => {
    if (!newPassword) return "New password is required";
    if (newPassword.length < 8)
      return "New password must be at least 8 characters";
    if (newPassword !== confirmPassword) return "Passwords do not match";
    return null;
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const urlError = hashParams.get("error");
    const errorCode = hashParams.get("error_code");
    const errorDescription = hashParams.get("error_description");

    if (urlError) {
      const decodedDescription = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "Password reset link is invalid or expired.";
      if (errorCode === "otp_expired") {
        setLinkError(
          "This reset link has expired. Request a new password reset email and use it right away.",
        );
      } else {
        setLinkError(decodedDescription);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(Boolean(session?.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setHasSession(Boolean(session?.user));
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!hasSession) {
      setError(
        "No valid recovery session found. Request a new password reset link and try again.",
      );
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          temporary_password: false,
          requires_password_change: false,
        },
      });

      if (updateError) throw updateError;

      if (window.location.hash) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      }

      toast({
        title: "Password updated",
        description: "You can now continue to the app.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      if (userRole === "super_admin") {
        navigate("/admin", { replace: true });
      } else if (userRole === "employee") {
        navigate("/my-payslips", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (submitError: any) {
      setError(submitError?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const textColor = useColorModeValue("gray.900", "white");
  const subtleColor = useColorModeValue("gray.600", "gray.300");

  return (
    <Box>
      <Heading size="lg" color={textColor} mb={6}>
        Change Password
      </Heading>

      <Card p={6} maxW="720px">
        <VStack align="stretch" spacing={5}>
          {linkError && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">Reset link issue</AlertTitle>
                <AlertDescription fontSize="sm">{linkError}</AlertDescription>
              </Box>
            </Alert>
          )}

          {!hasSession && !linkError && (
            <Alert status="info" borderRadius="md">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="sm">Recovery link required</AlertTitle>
                <AlertDescription fontSize="sm">
                  Open this page from the password reset email to set a new
                  password.
                </AlertDescription>
              </Box>
            </Alert>
          )}

          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle fontSize="sm">Temporary password detected</AlertTitle>
              <AlertDescription fontSize="sm">
                This account uses a temporary password. Set a new password now
                to continue.
              </AlertDescription>
            </Box>
          </Alert>

          <Text fontSize="sm" color={subtleColor}>
            Choose a strong password and store it in a secure password manager.
          </Text>

          {error && (
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <VStack spacing={4} align="stretch">
              <FormControl isInvalid={!!error && !newPassword}>
                <FormLabel>New Password</FormLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(evt) => setNewPassword(evt.target.value)}
                  placeholder="Enter a new password"
                />
                <FormErrorMessage>{error || " "}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!error && !!confirmPassword}>
                <FormLabel>Confirm New Password</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(evt) => setConfirmPassword(evt.target.value)}
                  placeholder="Re-enter your new password"
                />
                <FormErrorMessage>{error || " "}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                alignSelf="start"
                isLoading={saving}
                loadingText="Updating"
              >
                Update Password
              </Button>
            </VStack>
          </form>
        </VStack>
      </Card>
    </Box>
  );
};
