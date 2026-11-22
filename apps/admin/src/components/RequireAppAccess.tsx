import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Icon,
  Spinner,
  Text,
  useColorModeValue,
} from '@chakra-ui/react';
import { Grid3x3, Lock } from 'lucide-react';
import { decideAccess, fetchMyApps, type AccessState, type AppId } from '@digita/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useDataModeStore } from '../store/dataModeStore';

const HUB_URL = import.meta.env.VITE_HUB_URL ?? 'http://localhost:5175';

/**
 * Layer 2 of three: stops someone who typed the URL.
 *
 * Not a security boundary — RLS is. Without it a user lacking access would
 * still see the screens, just empty, and conclude the app is broken rather
 * than that they are not allowed in. This turns a confusing blank page into
 * an answer.
 *
 * Offline sample mode skips the check: there is no database to ask, and
 * locking someone out of sample data helps nobody.
 */
export function RequireAppAccess({ app, children }: { app: AppId; children: ReactNode }) {
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);
  const mode = useDataModeStore((s) => s.mode);
  const [state, setState] = useState<AccessState>({ status: 'loading' });

  const companyId = useDataModeStore((s) => s.companyIdForMode());

  useEffect(() => {
    if (mode === 'local') {
      setState({ status: 'granted' });
      return;
    }
    if (!userId || !companyId) return;

    let cancelled = false;
    void fetchMyApps(supabase, companyId)
      .then((granted) => {
        if (!cancelled) setState(decideAccess(app, granted));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: (error as Error).message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [app, userId, companyId, mode]);

  const muted = useColorModeValue('gray.500', 'whiteAlpha.600');
  const cardBg = useColorModeValue('white', 'gray.800');

  if (state.status === 'loading') {
    return (
      <Center py={20}>
        <Spinner color="primary.500" />
      </Center>
    );
  }

  if (state.status === 'error') {
    // Fail closed. A check that could not run is not a check that passed.
    return (
      <Message
        title="Could not confirm your access"
        body={state.message}
        bg={cardBg}
        muted={muted}
      />
    );
  }

  if (state.status === 'denied') {
    return (
      <Message
        title={`You do not have access to ${app}`}
        body={
          state.granted.length > 0
            ? `Your account can open: ${state.granted.join(', ')}.`
            : 'Your account has no apps assigned. Ask an administrator to grant you one.'
        }
        bg={cardBg}
        muted={muted}
      />
    );
  }

  return <>{children}</>;
}

function Message({
  title,
  body,
  bg,
  muted,
}: {
  title: string;
  body: string;
  bg: string;
  muted: string;
}) {
  return (
    <Flex bg={bg} borderRadius="12px" p={12} align="center" justify="center">
      <Box textAlign="center" maxW="420px">
        <Icon as={Lock} boxSize={8} color={muted} mb={3} />
        <Heading size="md" mb={2}>
          {title}
        </Heading>
        <Text fontSize="sm" color={muted} mb={5}>
          {body}
        </Text>
        <Button as="a" href={HUB_URL} leftIcon={<Grid3x3 size={16} />} size="sm">
          Back to all apps
        </Button>
      </Box>
    </Flex>
  );
}
