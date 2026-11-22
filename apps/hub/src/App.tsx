import { useEffect } from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Launcher } from './pages/Launcher';
import { Login } from './pages/Login';
import { useAuthStore } from './store/authStore';

export default function App() {
  const { initialise, initialised, session } = useAuthStore();

  useEffect(() => {
    void initialise();
  }, [initialise]);

  if (!initialised) {
    return (
      <Center h="100vh">
        <Spinner color="primary.500" />
      </Center>
    );
  }
  return session ? <Launcher /> : <Login />;
}
