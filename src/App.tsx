import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import { Toaster } from "react-hot-toast";
import theme from "./theme";
import { AdminLayout } from "./layouts/AdminLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { Dashboard } from "./pages/Dashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Employees } from "./pages/Employees";
import { EmployeeForm } from "./pages/EmployeeForm";
import { Attendance } from "./pages/Attendance";
import { AttendancePage } from "./pages/AttendancePage";
import { PayRuns } from "./pages/PayRuns";
import { PayRunDetail } from "./pages/PayRunDetail";
import { Departments } from "./pages/Departments";
import { Projects } from "./pages/Projects";
import { Settings } from "./pages/Settings";
import { ConfigPage } from "./pages/ConfigPage";
import { PayTemplatesPage } from "./pages/PayTemplatesPage";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { CompanySelector } from "./pages/CompanySelector";
import { TestDashboard } from "./pages/TestDashboard";
import { PayrollApprovalQueue } from "./pages/PayrollApprovalQueue";
import { BatchPayrollGenerator } from "./pages/BatchPayrollGenerator";
import { PayrollAnalytics } from "./pages/PayrollAnalytics";
import { EmployeePayslips } from "./pages/EmployeePayslips";
import { ChangePassword } from "./pages/ChangePassword";
import { useAuthStore } from "./store/authStore";
import { useEffect } from "react";

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const userRole = useAuthStore((state) => state.userRole);
  const sessionLoading = useAuthStore((state) => state.sessionLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const isEmployeeUser = userRole === "employee";
  const employeeHomePath = "/my-payslips";
  const roleHomePath = isEmployeeUser ? employeeHomePath : "/dashboard";
  const requiresPasswordChange = Boolean(
    user?.user_metadata?.requires_password_change ||
    user?.app_metadata?.requires_password_change,
  );

  const employeeRedirect = <Navigate to={employeeHomePath} replace />;
  const passwordChangeRedirect = <Navigate to="/change-password" replace />;

  const renderOperationalRoute = (element: JSX.Element) =>
    requiresPasswordChange
      ? passwordChangeRedirect
      : isEmployeeUser
        ? employeeRedirect
        : element;

  useEffect(() => {
    initialize();
  }, []);

  if (sessionLoading) return null;

  return (
    <ChakraProvider theme={theme}>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <Toaster position="top-right" />

      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <AuthLayout>
                <Login />
              </AuthLayout>
            }
          />
          <Route
            path="/register"
            element={
              <AuthLayout>
                <Register />
              </AuthLayout>
            }
          />
          <Route
            path="/change-password"
            element={
              <AuthLayout>
                <ChangePassword />
              </AuthLayout>
            }
          />
          <Route
            path="/company-selector"
            element={
              isAuthenticated ? (
                <AuthLayout>
                  <CompanySelector />
                </AuthLayout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          <Route
            path="/"
            element={
              isAuthenticated ? <AdminLayout /> : <Navigate to="/login" />
            }
          >
            <Route index element={<Navigate to={roleHomePath} replace />} />
            <Route
              path="dashboard"
              element={
                requiresPasswordChange ? (
                  passwordChangeRedirect
                ) : isEmployeeUser ? (
                  employeeRedirect
                ) : (
                  <Dashboard />
                )
              }
            />
            <Route
              path="my-payslips"
              element={
                requiresPasswordChange ? (
                  passwordChangeRedirect
                ) : isEmployeeUser ? (
                  <EmployeePayslips />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route
              path="admin"
              element={
                requiresPasswordChange ? (
                  passwordChangeRedirect
                ) : userRole === "super_admin" ? (
                  <AdminDashboard />
                ) : (
                  <Navigate to={roleHomePath} replace />
                )
              }
            />
            <Route
              path="test"
              element={renderOperationalRoute(<TestDashboard />)}
            />
            <Route
              path="employees"
              element={renderOperationalRoute(<Employees />)}
            />
            <Route
              path="employees/new"
              element={renderOperationalRoute(<EmployeeForm />)}
            />
            <Route
              path="employees/:id"
              element={renderOperationalRoute(<EmployeeForm />)}
            />
            <Route
              path="attendance"
              element={renderOperationalRoute(<Attendance />)}
            />
            <Route
              path="attendance-tracker"
              element={renderOperationalRoute(<AttendancePage />)}
            />
            <Route
              path="payroll"
              element={renderOperationalRoute(<PayRuns />)}
            />
            <Route
              path="payroll/runs/:id"
              element={renderOperationalRoute(<PayRunDetail />)}
            />
            <Route
              path="payroll/analytics"
              element={renderOperationalRoute(<PayrollAnalytics />)}
            />
            <Route
              path="payroll/approvals"
              element={renderOperationalRoute(<PayrollApprovalQueue />)}
            />
            <Route
              path="payroll/batch-generate"
              element={renderOperationalRoute(<BatchPayrollGenerator />)}
            />
            <Route
              path="departments"
              element={renderOperationalRoute(<Departments />)}
            />
            <Route
              path="projects"
              element={renderOperationalRoute(<Projects />)}
            />
            <Route path="settings" element={<Settings />} />
            <Route
              path="payroll/config/pay-templates"
              element={renderOperationalRoute(<PayTemplatesPage />)}
            />
            <Route
              path=":section/config/:slug"
              element={renderOperationalRoute(<ConfigPage />)}
            />
          </Route>
        </Routes>
      </Router>
    </ChakraProvider>
  );
}

export default App;
