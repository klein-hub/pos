import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AlertIcon, Badge, Box, Button, Center, Checkbox, Flex, IconButton, Menu, MenuButton,
  MenuItem, MenuList, Select, Spinner, Table, Tbody, Td, Text, Th, Thead, Tooltip, Tr, Wrap,
  WrapItem, useColorModeValue, useToast,
} from '@chakra-ui/react';
import { KeyRound, MoreVertical, Plus, UserMinus } from 'lucide-react';
import { useParams } from 'react-router-dom';
import {
  COMPANY_ROLES, licensedAppsFor, listMembers, removeMember, resetPassword, roleLabel,
  setCompanyLicenses, setMemberApps, setMemberRole,
  type AppId, type CompanyMember, type CompanyRole, type Provisioned,
} from '@digita/core';
import { apps } from '../../lib/apps';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { AddPersonModal } from './AddPersonModal';
import { AdminShell } from './AdminShell';
import { SecretOnce } from './SecretOnce';

export function CompanyDetail() {
  const { id = '' } = useParams();
  const toast = useToast();
  const { isSuperAdmin, access, user } = useAuthStore();
  const membership = access.find((c) => c.companyId === id);
  const isOwner = isSuperAdmin || membership?.role === 'owner';

  const [licensed, setLicensed] = useState<AppId[] | null>(null);
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [savingLicences, setSavingLicences] = useState(false);

  const cardBg = useColorModeValue('white', 'gray.800');
  const border = useColorModeValue('blackAlpha.100', 'whiteAlpha.100');

  const load = useCallback(async () => {
    try {
      const [l, m] = await Promise.all([licensedAppsFor(supabase, id), listMembers(supabase, id)]);
      setLicensed(l);
      setMembers(m);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast({ status: 'success', title: label, duration: 2000 });
      await load();
    } catch (e) {
      toast({ status: 'error', title: (e as Error).message, duration: 5000 });
    }
  };

  const licensedApps = useMemo(() => apps.filter((a) => (licensed ?? []).includes(a.id)), [licensed]);

  const toggleLicence = async (appId: AppId) => {
    if (!licensed) return;
    const next = licensed.includes(appId) ? licensed.filter((a) => a !== appId) : [...licensed, appId];
    setSavingLicences(true);
    await run('Licences updated', () => setCompanyLicenses(supabase, id, next));
    setSavingLicences(false);
  };

  const toggleMemberApp = (m: CompanyMember, appId: AppId) => {
    const next = m.apps.includes(appId) ? m.apps.filter((a) => a !== appId) : [...m.apps, appId];
    void run('Access updated', () => setMemberApps(supabase, id, m.userId, next));
  };

  const title = membership?.companyName ?? 'Company';

  return (
    <AdminShell
      title={title}
      actions={<Button leftIcon={<Plus size={16} />} onClick={() => setAdding(true)} isDisabled={!licensed}>Add person</Button>}
    >
      {error && <Alert status="error" borderRadius="10px" mb={4} fontSize="sm"><AlertIcon />{error}</Alert>}

      {licensed === null && !error ? (
        <Center py={16}><Spinner color="primary.500" /></Center>
      ) : (
        <>
          {/* Licences: what the company bought. Digita decides; clients see. */}
          <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" p={5} mb={5}>
            <Flex justify="space-between" align="center" mb={3}>
              <Text fontWeight="600">Licensed apps</Text>
              {!isSuperAdmin && <Text fontSize="xs" color="gray.500">Managed by Digita — contact us to change your plan</Text>}
            </Flex>
            <Wrap spacing={4}>
              {apps.map((a) => (
                <WrapItem key={a.id}>
                  <Checkbox
                    isChecked={(licensed ?? []).includes(a.id)}
                    isDisabled={!isSuperAdmin || savingLicences}
                    onChange={() => void toggleLicence(a.id)}
                  >
                    <Text fontSize="sm">{a.name}</Text>
                  </Checkbox>
                </WrapItem>
              ))}
            </Wrap>
          </Box>

          {/* People */}
          <Box bg={cardBg} border="1px solid" borderColor={border} borderRadius="12px" overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr><Th>Person</Th><Th w="200px">Role</Th><Th>App access</Th><Th>Last sign-in</Th><Th w="40px" /></Tr>
              </Thead>
              <Tbody>
                {(members ?? []).map((m) => {
                  const self = m.userId === user?.id;
                  const memberIsOwner = m.role === 'owner';
                  const lockedRole = self || (memberIsOwner && !isOwner);
                  return (
                    <Tr key={m.userId}>
                      <Td>
                        <Text fontWeight="600">
                          {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                          {self && <Badge ml={2} fontSize="9px">you</Badge>}
                        </Text>
                        <Text fontSize="xs" color="gray.500">{m.email}</Text>
                      </Td>
                      <Td>
                        {lockedRole ? (
                          <Text fontSize="sm">{roleLabel(m.role)}</Text>
                        ) : (
                          <Select size="sm" value={m.role}
                            onChange={(e) => void run('Role changed', () =>
                              setMemberRole(supabase, id, m.userId, e.target.value as CompanyRole))}>
                            {!COMPANY_ROLES.some((r) => r.id === m.role) && <option value={m.role}>{roleLabel(m.role)}</option>}
                            {COMPANY_ROLES.filter((r) => r.id !== 'owner' || isOwner).map((r) => (
                              <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                          </Select>
                        )}
                      </Td>
                      <Td>
                        {memberIsOwner ? (
                          <Text fontSize="xs" color="gray.500">All licensed apps</Text>
                        ) : (
                          <Wrap spacing={1}>
                            {licensedApps.map((a) => {
                              const on = m.apps.includes(a.id);
                              return (
                                <WrapItem key={a.id}>
                                  <Tooltip label={on ? `Remove ${a.name}` : `Grant ${a.name}`} openDelay={400}>
                                    <Badge as="button" cursor="pointer" fontSize="10px" px={2} py={0.5}
                                      colorScheme={on ? 'green' : 'gray'} variant={on ? 'solid' : 'outline'}
                                      onClick={() => toggleMemberApp(m, a.id)}>
                                      {a.name}
                                    </Badge>
                                  </Tooltip>
                                </WrapItem>
                              );
                            })}
                          </Wrap>
                        )}
                      </Td>
                      <Td fontSize="xs" color="gray.500">
                        {m.lastSignInAt ? new Date(m.lastSignInAt).toLocaleDateString() : 'never'}
                      </Td>
                      <Td>
                        {!self && !(memberIsOwner && !isOwner) && (
                          <Menu placement="bottom-end">
                            <MenuButton as={IconButton} icon={<MoreVertical size={16} />} size="xs" variant="ghost" aria-label="Actions" />
                            <MenuList>
                              <MenuItem icon={<KeyRound size={14} />} onClick={() => void (async () => {
                                try {
                                  const r = await resetPassword(supabase, id, m.userId);
                                  setSecret({ email: m.email, password: r.temporary_password });
                                } catch (e) {
                                  toast({ status: 'error', title: (e as Error).message });
                                }
                              })()}>
                                Reset password
                              </MenuItem>
                              <MenuItem icon={<UserMinus size={14} />} color="red.500"
                                onClick={() => {
                                  if (window.confirm(`Remove ${m.email} from ${title}? Their sign-in stays; their access goes.`)) {
                                    void run('Removed', () => removeMember(supabase, id, m.userId));
                                  }
                                }}>
                                Remove from company
                              </MenuItem>
                            </MenuList>
                          </Menu>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
                {members?.length === 0 && (
                  <Tr><Td colSpan={5}><Text py={6} textAlign="center" color="gray.500" fontSize="sm">No one yet.</Text></Td></Tr>
                )}
              </Tbody>
            </Table>
          </Box>
        </>
      )}

      <AddPersonModal
        companyId={id}
        licensed={licensed ?? []}
        canAppointOwner={isOwner}
        isOpen={adding}
        onClose={() => setAdding(false)}
        onCreated={(r: Provisioned) => {
          setAdding(false);
          void load();
          if (r.temporary_password) setSecret({ email: r.email, password: r.temporary_password });
        }}
      />
      <SecretOnce email={secret?.email ?? ''} password={secret?.password ?? null} onClose={() => setSecret(null)} />
    </AdminShell>
  );
}
