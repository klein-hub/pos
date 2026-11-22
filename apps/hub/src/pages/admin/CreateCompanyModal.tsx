import { useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Checkbox, Divider, FormControl, FormLabel, Input, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay,
  SimpleGrid, Text, Wrap, WrapItem,
} from '@chakra-ui/react';
import { createCompany, type AppId, type Provisioned } from '@digita/core';
import { apps } from '../../lib/apps';
import { supabase } from '../../lib/supabase';

/**
 * New client: the company, what it bought, and its first owner — in one step,
 * because a company with no owner is a company nobody can administer.
 */
export function CreateCompanyModal({
  isOpen, onClose, onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (companyId: string, owner: Provisioned | null) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [licensed, setLicensed] = useState<AppId[]>(['pos', 'inventory', 'sales']);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerFirst, setOwnerFirst] = useState('');
  const [ownerLast, setOwnerLast] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: AppId) =>
    setLicensed((cur) => (cur.includes(id) ? cur.filter((a) => a !== id) : [...cur, id]));

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await createCompany(supabase, {
        company: { name, email, phone, city },
        apps: licensed,
        owner: ownerEmail ? { email: ownerEmail, first_name: ownerFirst, last_name: ownerLast } : undefined,
      });
      onCreated(result.company.id, result.owner);
      setName(''); setEmail(''); setPhone(''); setCity('');
      setOwnerEmail(''); setOwnerFirst(''); setOwnerLast('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>New client company</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {error && (
            <Alert status="error" borderRadius="8px" mb={4} fontSize="sm"><AlertIcon />{error}</Alert>
          )}

          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl isRequired gridColumn={{ md: 'span 2' }}>
              <FormLabel fontSize="sm">Company name</FormLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kape Kalinga Roastery" />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Phone</FormLabel>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormControl>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel fontSize="sm">City</FormLabel>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </FormControl>
          </SimpleGrid>

          <Divider my={5} />
          <Text fontSize="sm" fontWeight="600" mb={2}>Licensed apps</Text>
          <Wrap spacing={3}>
            {apps.map((a) => (
              <WrapItem key={a.id}>
                <Checkbox isChecked={licensed.includes(a.id)} onChange={() => toggle(a.id)}>
                  <Text fontSize="sm">{a.name}</Text>
                </Checkbox>
              </WrapItem>
            ))}
          </Wrap>

          <Divider my={5} />
          <Text fontSize="sm" fontWeight="600">Company Super Admin</Text>
          <Text fontSize="xs" color="gray.500" mb={3}>
            Optional now, but someone has to be able to manage this company.
          </Text>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">First name</FormLabel>
              <Input value={ownerFirst} onChange={(e) => setOwnerFirst(e.target.value)} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Last name</FormLabel>
              <Input value={ownerLast} onChange={(e) => setOwnerLast(e.target.value)} />
            </FormControl>
          </SimpleGrid>
          <Box h={2} />
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void submit()} isLoading={saving} isDisabled={!name.trim()}>
            Create company
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
