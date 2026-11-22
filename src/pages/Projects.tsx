import {
  Box,
  Heading,
  useColorModeValue,
  Grid,
  Text,
  Flex,
  Button,
  Progress,
  useDisclosure,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Table } from "../components/ui/Table";
import { FolderKanban, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectStore } from "../store/projectStore";
import { useDepartmentStore } from "../store/departmentStore";
import { useCompanyContext } from "../hooks/useCompanyContext";

interface ProjectFormData {
  name: string;
  department_id: number;
  start_date: string;
  end_date: string;
}

export const Projects = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [formData, setFormData] = useState<ProjectFormData>({
    name: "",
    department_id: 0,
    start_date: "",
    end_date: "",
  });

  const {
    projects,
    loading,
    fetchProjects,
    addProject,
    updateProject,
    deleteProject,
  } = useProjectStore();
  const { departments, fetchDepartments } = useDepartmentStore();
  const toast = useToast();
  const textColor = useColorModeValue("gray.900", "white");
  const { activeCompanyId } = useCompanyContext();

  useEffect(() => {
    if (activeCompanyId) {
      fetchProjects();
      fetchDepartments();
    }
  }, [activeCompanyId, fetchProjects, fetchDepartments]);

  const handleRefresh = () => {
    fetchProjects();
    fetchDepartments();
  };

  const handleSubmit = async () => {
    try {
      if (selectedProject) {
        await updateProject(selectedProject.id, formData);
        toast({
          title: "Project updated",
          status: "success",
          duration: 3000,
        });
      } else {
        await addProject(formData);
        toast({
          title: "Project created",
          status: "success",
          duration: 3000,
        });
      }
      onClose();
      setSelectedProject(null);
      setFormData({
        name: "",
        department_id: 0,
        start_date: "",
        end_date: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      toast({
        title: "Project deleted",
        status: "success",
        duration: 3000,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        status: "error",
        duration: 5000,
      });
    }
  };

  const calculateProgress = (startDate: string, endDate: string) => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = new Date().getTime();

    if (now < start) return 0;
    if (now > end) return 100;

    const total = end - start;
    const current = now - start;
    return Math.round((current / total) * 100);
  };

  const getStatusColor = (progress: number) => {
    if (progress >= 75) return "green";
    if (progress >= 50) return "blue";
    return "orange";
  };

  const headers = [
    "Project",
    "Department",
    "Start Date",
    "End Date",
    "Progress",
    "Actions",
  ];

  const renderRow = (project: any) => [
    project.name,
    departments.find((d) => d.id === project.department_id)?.name || "Unknown",
    new Date(project.start_date).toLocaleDateString(),
    new Date(project.end_date).toLocaleDateString(),
    <Box>
      <Flex justify="space-between" mb={1}>
        <Text fontSize="sm">
          {calculateProgress(project.start_date, project.end_date)}%
        </Text>
      </Flex>
      <Progress
        value={calculateProgress(project.start_date, project.end_date)}
        size="sm"
        rounded="full"
        colorScheme={getStatusColor(
          calculateProgress(project.start_date, project.end_date),
        )}
      />
    </Box>,
    <Flex gap={2}>
      <Button
        size="sm"
        variant="ghost"
        colorScheme="blue"
        leftIcon={<Pencil size={16} />}
        onClick={() => {
          setSelectedProject(project);
          setFormData({
            name: project.name,
            department_id: project.department_id,
            start_date: project.start_date.split("T")[0],
            end_date: project.end_date.split("T")[0],
          });
          onOpen();
        }}
      >
        Edit
      </Button>
      <Button
        size="sm"
        variant="ghost"
        colorScheme="red"
        leftIcon={<Trash2 size={16} />}
        onClick={() => handleDelete(project.id)}
      >
        Delete
      </Button>
    </Flex>,
  ];

  const completedProjects = projects.filter(
    (p) => calculateProgress(p.start_date, p.end_date) === 100,
  ).length;
  const inProgressProjects = projects.filter((p) => {
    const progress = calculateProgress(p.start_date, p.end_date);
    return progress > 0 && progress < 100;
  }).length;
  const pendingProjects = projects.filter(
    (p) => calculateProgress(p.start_date, p.end_date) === 0,
  ).length;

  const openCreateProjectModal = () => {
    setSelectedProject(null);
    setFormData({
      name: "",
      department_id: 0,
      start_date: "",
      end_date: "",
    });
    onOpen();
  };

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={8}>
        <Heading size="lg" color={textColor}>
          Projects
        </Heading>
      </Flex>

      {!activeCompanyId && (
        <Card p={6} mb={4}>
          <Text color="gray.500">
            Select a company from the sidebar to view projects.
          </Text>
        </Card>
      )}

      <Grid templateColumns="repeat(4, 1fr)" gap={6} mb={8}>
        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="blue.100" rounded="full" mr={4}>
              <FolderKanban size={24} color="blue" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Total Projects
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {projects.length}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="green.100" rounded="full" mr={4}>
              <FolderKanban size={24} color="green" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Completed
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {completedProjects}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="yellow.100" rounded="full" mr={4}>
              <FolderKanban size={24} color="orange" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                In Progress
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {inProgressProjects}
              </Text>
            </Box>
          </Flex>
        </Card>

        <Card p={6}>
          <Flex align="center">
            <Box p={3} bg="purple.100" rounded="full" mr={4}>
              <FolderKanban size={24} color="purple" />
            </Box>
            <Box>
              <Text fontSize="sm" color="gray.500">
                Pending
              </Text>
              <Text fontSize="2xl" fontWeight="bold">
                {pendingProjects}
              </Text>
            </Box>
          </Flex>
        </Card>
      </Grid>

      <Card p={6}>
        <Table
          headers={headers}
          data={projects}
          renderRow={renderRow}
          isLoading={loading}
          searchable
          searchPlaceholder="Search projects..."
          searchPredicate={(project: any, q: string) => {
            const departmentName =
              departments.find((d) => d.id === project.department_id)?.name ||
              "";
            const hay = [
              project.name,
              departmentName,
              project.start_date,
              project.end_date,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return hay.includes(q);
          }}
          filterable
          filterOptions={[
            {
              label: "Department",
              value: "department",
              getValue: (project: any) =>
                departments.find((d) => d.id === project.department_id)?.name ||
                "Unassigned",
            },
          ]}
          sortable
          sortOptions={[
            {
              label: "Name",
              value: "name",
              getValue: (project: any) => project.name || "",
            },
            {
              label: "Department",
              value: "department",
              getValue: (project: any) =>
                departments.find((d) => d.id === project.department_id)?.name ||
                "",
            },
            {
              label: "Created At",
              value: "created_at",
              getValue: (project: any) => project.created_at || "",
            },
            {
              label: "Updated At",
              value: "updated_at",
              getValue: (project: any) => project.updated_at || "",
            },
          ]}
          defaultSortBy="name"
          defaultSortDirection="asc"
          onRefresh={handleRefresh}
          isRefreshing={loading}
          onAdd={openCreateProjectModal}
          tableName="Project"
          pagination
          defaultPageSize={10}
          emptyMessage="No projects found."
          emptySearchMessage="No projects match your search."
        />
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={selectedProject ? "Edit Project" : "New Project"}
        onSubmit={handleSubmit}
        isLoading={loading}
      >
        <VStack spacing={4}>
          <Input
            label="Project Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter project name"
          />
          <Input
            as="select"
            label="Department"
            value={formData.department_id}
            onChange={(e) =>
              setFormData({
                ...formData,
                department_id: Number(e.target.value),
              })
            }
          >
            <option value={0}>Select department</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </Input>
          <Input
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) =>
              setFormData({ ...formData, start_date: e.target.value })
            }
          />
          <Input
            label="End Date"
            type="date"
            value={formData.end_date}
            onChange={(e) =>
              setFormData({ ...formData, end_date: e.target.value })
            }
          />
        </VStack>
      </Modal>
    </Box>
  );
};
