import { useCallback, useEffect, useState } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Center, Flex, Input, InputGroup, InputLeftElement,
  Spinner, Table, Tbody, Td, Text, Th, Thead, Tr, Wrap, WrapItem, useColorModeValue,
} from '@chakra-ui/react';
import { Building2, Plus, Search } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { listCompanies, type AdminCompany, type Provisioned } from '@digita/core';
import { apps } from '../../lib/apps';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { AdminShell } from './AdminShell';
import { CreateCompanyModal } from './CreateCompanyModal';
import { SecretOnce } from './SecretOnce';

const appName = (id: string) => apps.find((a) => a.id === id)?.name ?? id;

/**
 * Where the console starts.
 *
 * Digita admins get every client company. A company's own admins skip
 * straight to their company — the list would only ever have one row, and the
 * database refuses them the full list anyway.
 */
export function AdminIndex() {
  const { isSuperAdmin, access } = useAuthStore();
  const manageable = access.filter((c) => c.canManage);

  if (!isSuperAdmin) {
    if (manageable.length === 1) return <Navigate to={`/admin/companies/${manageable[0]!.companyId}`} replace />;
    return <ManageableCompanies />;
  }
  return <AllCompanies />;
}

function AllCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<AdminCompany[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<Provisioned | null>(null);

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const load = useCallback(async () => {
    try {
      setCompanies(await listCompanies(supabase));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const q = query.trim().toLowerCase();
  const visible = (companies ?? []).filter(
    (c) => !q || c.name.toLowerCase().includes(q) || (c.city ?? '').toLowerCase().includes(q),
  );

  return (
    <AdminShell
      title="Client companies"
      actions={<Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>New company</Button>}
    >
      {error && <Alert status="error" borderRadius="10px" mb={4} fontSize="sm"><AlertIcon />{error}</Alert>}

      <InputGroup mb={4} maxW="360px">
        <InputLeftElement pointerEvents="none"><Search size={16} /></InputLeftElement>
        <Input bg={cardBg} placeholder="Search companies…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </InputGroup>

      {companies === null && !error ? (
        <Center py={16}><Spinner color="primary.500" /></Center>
      ) : (
        <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" overflowX="auto">
          <Table size="sm">
            <Thead>
              <Tr><Th>Company</Th><Th>Licensed apps</Th><Th isNumeric>People</Th><Th>Since</Th></Tr>
            </Thead>
            <Tbody>
              {visible.map((c) => (
                <Tr key={c.id} cursor="pointer" _hover={{ bg: 'blackAlpha.50' }}
                  onClick={() => navigate(`/admin/companies/${c.id}`)}>
                  <Td>
                    <Text fontWeight="600">{c.name}</Text>
                    <Text fontSize="xs" color="gray.500">{[c.city, c.email].filter(Boolean).join(' · ') || '—'}</Text>
                  </Td>
                  <Td>
                    <Wrap spacing={1}>
                      {c.licensed.length === 0
                        ? <Text fontSize="xs" color="gray.500">none</Text>
                        : c.licensed.map((a) => (
                          <WrapItem key={a}><Badge fontSize="10px" colorScheme="orange">{appName(a)}</Badge></WrapItem>
                        ))}
                    </Wrap>
                  </Td>
                  <Td isNumeric>{c.members}</Td>
                  <Td fontSize="xs" color="gray.500">{new Date(c.createdAt).toLocaleDateString()}</Td>
                </Tr>
              ))}
              {visible.length === 0 && (
                <Tr><Td colSpan={4}><Text py={6} textAlign="center" color="gray.500" fontSize="sm">No companies match.</Text></Td></Tr>
              )}
            </Tbody>
          </Table>
        </Box>
      )}

      <CreateCompanyModal
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreated={(id, owner) => {
          setCreating(false);
          void load();
          if (owner?.temporary_password) setSecret(owner);
          else navigate(`/admin/companies/${id}`);
        }}
      />
      <SecretOnce
        email={secret?.email ?? ''}
        password={secret?.temporary_password ?? null}
        onClose={() => setSecret(null)}
      />
    </AdminShell>
  );
}

function ManageableCompanies() {
  const navigate = useNavigate();
  const { access } = useAuthStore();
  const manageable = access.filter((c) => c.canManage);
  return (
    <AdminShell title="Your companies">
      {manageable.length === 0 ? (
        <Text color="gray.500" fontSize="sm">You do not administer any company.</Text>
      ) : (
        <Flex direction="column" gap={2}>
          {manageable.map((c) => (
            <Button key={c.companyId} justifyContent="flex-start" variant="outline" leftIcon={<Building2 size={16} />}
              onClick={() => navigate(`/admin/companies/${c.companyId}`)}>
              {c.companyName}
            </Button>
          ))}
        </Flex>
      )}
    </AdminShell>
  );
}
