import { useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminLayout } from './layouts/AdminLayout';
import { ComingSoon } from './pages/ComingSoon';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { MenuMargins } from './pages/MenuMargins';
import { Recipes } from './pages/Recipes';
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
          <Route
            path="/inventory"
            element={
              <ComingSoon
                title="Inventory"
                phase="Phase 2 — items, suppliers, batches, Receive Stock"
                blurb="Item master with per-gram costs, sealed and open container tracking, batch expiry and movement history."
              />
            }
          />
          <Route
            path="/purchasing"
            element={
              <ComingSoon
                title="Purchasing"
                phase="Phase 8 — purchase orders and reorder intelligence"
                blurb="Order suggestions from measured velocity and supplier lead time, rounded to whole purchase units."
              />
            }
          />
          <Route path="/recipes" element={<Recipes />} />
          <Route
            path="/counts"
            element={
              <ComingSoon
                title="Stock Counts"
                phase="Phase 7 — counts and variance"
                blurb="Guided physical counts with theoretical-versus-actual variance, so over-pouring and unlogged waste surface."
              />
            }
          />
          <Route
            path="/waste"
            element={
              <ComingSoon
                title="Waste"
                phase="Phase 7 — wastage log and reporting"
                blurb="Spillage, spoilage, remakes and staff drinks tracked separately, each costed at the batch price."
              />
            }
          />
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
