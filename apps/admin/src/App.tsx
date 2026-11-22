import { useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminLayout } from './layouts/AdminLayout';
import { ComingSoon } from './pages/ComingSoon';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Login } from './pages/Login';
import { MenuMargins } from './pages/MenuMargins';
import { Purchasing } from './pages/Purchasing';
import { Recipes } from './pages/Recipes';
import { StockCounts } from './pages/StockCounts';
import { Waste } from './pages/Waste';
import { useAuthStore } from './store/authStore';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, initialised } = useAuthStore();
  if (!initialised) {
    return (
      <Center h="100vh">
        <Spinner color="primary.500" />
      </Center>
    );
  }
  return session ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const initialise = useAuthStore((s) => s.initialise);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  return (
    <Router>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/menu" element={<MenuMargins />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/purchasing" element={<Purchasing />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/counts" element={<StockCounts />} />
          <Route path="/waste" element={<Waste />} />
          <Route
            path="/settings"
            element={
              <ComingSoon
                title="Settings"
                phase="Phase 0 — users, roles, locations, tax"
                blurb="Cashier PINs, locations, VAT configuration and the audit log."
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
