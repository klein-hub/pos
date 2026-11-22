import { useState } from 'react';
import {
  Alert, AlertIcon, Button, Checkbox, FormControl, FormHelperText, FormLabel, Input, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select,
  SimpleGrid, Text, Wrap, WrapItem,
} from '@chakra-ui/react';
import { COMPANY_ROLES, createUser, type AppId, type CompanyRole, type Provisioned } from '@digita/core';
import { apps as allApps } from '../../lib/apps';
import { supabase } from '../../lib/supabase';

/** Add someone to a company: a sign-in, a role, and which licensed apps they get. */
export function AddPersonModal({
  companyId, licensed, canAppointOwner, isOpen, onClose, onCreated,
}: {
  companyId: string;
  licensed: AppId[];
  canAppointOwner: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: Provisioned) => void;
}) {
  const [email, setEmail] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [role, setRole] = useState<CompanyRole>('user');
  const [picked, setPicked] = useState<AppId[]>(['pos']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offered = allApps.filter((a) => licensed.includes(a.id));
  const isOwner = role === 'owner';

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await createUser(supabase, companyId, {
        email, first_name: first, last_name: last, role,
        apps: isOwner ? [] : picked.filter((a) => licensed.includes(a)),
      });
      onCreated(result);
      setEmail(''); setFirst(''); setLast(''); setRole('user'); setPicked(['pos']);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add person</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {error && <Alert status="error" borderRadius="8px" mb={4} fontSize="sm"><AlertIcon />{error}</Alert>}

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl isRequired gridColumn={{ md: 'span 2' }}>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">First name</FormLabel>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Last name</FormLabel>
              <Input value={last} onChange={(e) => setLast(e.target.value)} />
            </FormControl>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel fontSize="sm">Role</FormLabel>
              <Select value={role} onChange={(e) => setRole(e.target.value as CompanyRole)}>
                {COMPANY_ROLES.filter((r) => r.id !== 'owner' || canAppointOwner).map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </Select>
              <FormHelperText fontSize="xs">{COMPANY_ROLES.find((r) => r.id === role)?.summary}</FormHelperText>
            </FormControl>
          </SimpleGrid>

          <Text fontSize="sm" fontWeight="600" mt={5} mb={2}>Apps</Text>
          {isOwner ? (
            <Text fontSize="xs" color="gray.500">A Company Super Admin gets every app the company licenses.</Text>
          ) : offered.length === 0 ? (
            <Text fontSize="xs" color="gray.500">This company has no licensed apps yet.</Text>
          ) : (
            <Wrap spacing={3}>
              {offered.map((a) => (
                <WrapItem key={a.id}>
                  <Checkbox
                    isChecked={picked.includes(a.id)}
                    onChange={() => setPicked((cur) => (cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]))}
                  >
                    <Text fontSize="sm">{a.name}</Text>
                  </Checkbox>
                </WrapItem>
              ))}
            </Wrap>
          )}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} isLoading={saving} isDisabled={!email.trim()}>Add person</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
