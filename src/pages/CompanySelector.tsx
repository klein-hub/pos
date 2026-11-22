import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  VStack,
  HStack,
  Box,
  Heading,
  Text,
  Button,
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { useAuthStore, type Company } from "../store/authStore";

export function CompanySelector() {
  const navigate = useNavigate();
  const { userCompanies, companiesLoading, setActiveCompany, userRole } =
    useAuthStore();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  useEffect(() => {
    // If only one company, auto-select it
    if (userCompanies.length === 1 && !selectedCompany) {
      handleSelectCompany(userCompanies[0]);
    }
  }, [userCompanies, selectedCompany]);

  const handleSelectCompany = (company: Company) => {
    setActiveCompany(company.id);
    navigate(userRole === "employee" ? "/my-payslips" : "/dashboard");
  };

  if (companiesLoading) {
    return (
      <Container maxW="md" centerContent py={20}>
        <VStack spacing={4}>
          <Spinner size="lg" color="blue.500" />
          <Text>Loading your companies...</Text>
        </VStack>
      </Container>
    );
  }

  if (!userCompanies || userCompanies.length === 0) {
    return (
      <Container maxW="md" centerContent py={20}>
        <VStack spacing={4} width="100%">
          <Alert status="warning" borderRadius="lg">
            <AlertIcon />
            <Box>
              <AlertTitle>No Companies Found</AlertTitle>
              <AlertDescription>
                You haven't been assigned to any companies yet. Please contact
                your administrator.
              </AlertDescription>
            </Box>
          </Alert>
        </VStack>
      </Container>
    );
  }

  return (
    <Container maxW="lg" centerContent py={20}>
      <VStack spacing={8} width="100%">
        <VStack spacing={2} textAlign="center">
          <Heading as="h1" size="xl">
            Select Your Company
          </Heading>
          <Text color="gray.600">Choose the company you want to work with</Text>
        </VStack>

        <VStack spacing={4} width="100%">
          {userCompanies.map((company) => (
            <Card
              key={company.id}
              width="100%"
              cursor="pointer"
              borderWidth={2}
              borderColor={
                selectedCompany?.id === company.id ? "blue.500" : "gray.200"
              }
              transition="all 0.2s"
              _hover={{ borderColor: "blue.500", shadow: "md" }}
              onClick={() => setSelectedCompany(company)}
            >
              <CardHeader>
                <Heading size="md">{company.name}</Heading>
              </CardHeader>
              <CardBody>
                <Text color="gray.600" fontSize="sm">
                  ID: {company.id}
                </Text>
                {company.created_at && (
                  <Text color="gray.500" fontSize="xs">
                    Created: {new Date(company.created_at).toLocaleDateString()}
                  </Text>
                )}
              </CardBody>
            </Card>
          ))}
        </VStack>

        {selectedCompany && (
          <HStack spacing={4} width="100%">
            <Button
              flex={1}
              colorScheme="blue"
              size="lg"
              onClick={() => handleSelectCompany(selectedCompany)}
            >
              Continue to {selectedCompany.name}
            </Button>
            <Button
              flex={1}
              variant="outline"
              size="lg"
              onClick={() => setSelectedCompany(null)}
            >
              Cancel
            </Button>
          </HStack>
        )}
      </VStack>
    </Container>
  );
}
