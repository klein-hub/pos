import { useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AdminLayout } from './layouts/AdminLayout';
import { RequireAppAccess } from './components/RequireAppAccess';
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
import { useDataModeStore } from './store/dataModeStore';

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
  // The user id, not the session object: the object's identity changes on
  // every token refresh and rehydrate, which refired the effect and reloaded
  // the whole catalog each time.
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);
  const initialised = useAuthStore((s) => s.initialised);
  const startData = useDataModeStore((s) => s.start);

  useEffect(() => {
    void initialise();
  }, [initialise]);

  // Only once auth has settled: the starting mode depends on whether this user
  // may switch and which company their profile points at, and loading before
  // that is known would read the wrong company and then have to redo it.
  useEffect(() => {
    if (initialised && userId) void startData();
  }, [initialised, userId, startData]);

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
          <Route
            path="/dashboard"
            element={<RequireAppAccess app="sales"><Dashboard /></RequireAppAccess>}
          />
          <Route
            path="/menu"
            element={<RequireAppAccess app="sales"><MenuMargins /></RequireAppAccess>}
          />
          <Route
            path="/inventory"
            element={<RequireAppAccess app="inventory"><Inventory /></RequireAppAccess>}
          />
          <Route
            path="/purchasing"
            element={<RequireAppAccess app="inventory"><Purchasing /></RequireAppAccess>}
          />
          <Route
            path="/recipes"
            element={<RequireAppAccess app="inventory"><Recipes /></RequireAppAccess>}
          />
          <Route
            path="/counts"
            element={<RequireAppAccess app="inventory"><StockCounts /></RequireAppAccess>}
          />
          <Route
            path="/waste"
            element={<RequireAppAccess app="inventory"><Waste /></RequireAppAccess>}
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
