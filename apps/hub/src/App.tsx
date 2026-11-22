import { useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Launcher } from './pages/Launcher';
import { Login } from './pages/Login';
import { AdminIndex } from './pages/admin/AdminIndex';
import { CompanyDetail } from './pages/admin/CompanyDetail';
import { useAuthStore } from './store/authStore';

export default function App() {
  const { initialise, initialised, session, loadAccess, isSuperAdmin, access } = useAuthStore();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    void initialise();
  }, [initialise]);

  // Keyed on the user id, not the session object: the object's identity
  // changes on every token refresh, which would refetch access constantly.
  useEffect(() => {
    if (userId) void loadAccess();
  }, [userId, loadAccess]);

  if (!initialised) {
    return (
      <Center h="100vh">
        <Spinner color="primary.500" />
      </Center>
    );
  }
  if (!session) return <Login />;

  // The console is offered to Digita admins and to anyone who administers a
  // company. Everyone else is sent back to the launcher — the database would
  // refuse them anyway; this just avoids showing them an error to get there.
  const canAdminister = isSuperAdmin || access.some((c) => c.canManage);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Launcher />} />
        <Route path="/admin" element={canAdminister ? <AdminIndex /> : <Navigate to="/" replace />} />
        <Route path="/admin/companies/:id" element={canAdminister ? <CompanyDetail /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
