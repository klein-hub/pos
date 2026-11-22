import { useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Launcher } from './pages/Launcher';
import { Login } from './pages/Login';
import { useAuthStore } from './store/authStore';

export default function App() {
  const { initialise, initialised, session, loadAccess } = useAuthStore();
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
  return session ? <Launcher /> : <Login />;
}
