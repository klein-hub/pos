import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Divider,
  Textarea,
  useColorModeValue,
} from '@chakra-ui/react';
import { Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface BankAccount {
  id?: string;
  employee_id: number | string;
  account_number: string;
  clearing_number: string;
  bic_swift: string;
  holder_name: string;
  bank_name: string;
  bank_street: string;
  bank_street2: string;
  bank_city: string;
  bank_state: string;
  bank_zip: string;
  bank_country: string;
  notes: string;
}

const emptyAccount = (employeeId: number | string, holderName: string): BankAccount => ({
  employee_id: employeeId,
  account_number: '',
  clearing_number: '',
  bic_swift: '',
  holder_name: holderName,
  bank_name: '',
  bank_street: '',
  bank_street2: '',
  bank_city: '',
  bank_state: '',
  bank_zip: '',
  bank_country: 'Philippines',
  notes: '',
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: number | string;
  holderName: string;
  existing?: BankAccount | null;
  onSaved: () => void;
}

type SubTab = 'note' | 'bank_info';

export const BankAccountModal = ({ isOpen, onClose, employeeId, holderName, existing, onSaved }: Props) => {
  const [form, setForm] = useState<BankAccount>(emptyAccount(employeeId, holderName));
  const [subTab, setSubTab] = useState<SubTab>('note');
  const [saving, setSaving] = useState(false);

  const bgModal = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const labelColor = useColorModeValue('gray.600', 'gray.300');
  const subTextColor = useColorModeValue('gray.500', 'gray.400');
  const tabActiveColor = useColorModeValue('blue.600', 'blue.300');
  const tabActiveBorder = useColorModeValue('blue.500', 'blue.400');
  const tabInactiveColor = useColorModeValue('gray.500', 'gray.400');
  const tabHoverBg = useColorModeValue('gray.50', 'gray.700');
  const textareaBg = useColorModeValue('white', 'gray.700');

  useEffect(() => {
    if (isOpen) {
      setForm(existing ? { ...existing } : emptyAccount(employeeId, holderName));
      setSubTab('note');
    }
  }, [isOpen, existing, employeeId, holderName]);

  const handleChange = (field: keyof BankAccount, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        account_number: form.account_number,
        clearing_number: form.clearing_number,
        bic_swift: form.bic_swift,
        holder_name: form.holder_name || holderName,
        bank_name: form.bank_name,
        bank_street: form.bank_street,
        bank_street2: form.bank_street2,
        bank_city: form.bank_city,
        bank_state: form.bank_state,
        bank_zip: form.bank_zip,
        bank_country: form.bank_country || 'Philippines',
        notes: form.notes,
      };
      if (existing?.id) {
        const { error } = await supabase.from('bank_accounts').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_accounts').insert([payload]);
        if (error) throw error;
      }
      toast.success('Bank account saved');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const FieldRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <Flex align="flex-start" mb={4} gap={6}>
      <Box w="160px" flexShrink={0} pt="8px">
        <Text fontSize="sm" fontWeight="medium" color={labelColor}>{label}</Text>
      </Box>
      <Box flex={1}>{children}</Box>
    </Flex>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered>
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(4px)" />
      <ModalContent bg={bgModal} borderRadius="xl" border="1px solid" borderColor={borderColor}>
        <ModalHeader fontSize="lg" fontWeight="semibold" pb={2}>
          {existing ? 'Edit Bank Account' : 'Create Bank Account'}
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody pb={6}>
          {/* Main fields */}
          <Box mb={4}>
            <FieldRow label="Account Number">
              <Input
                placeholder=""
                value={form.account_number}
                onChange={e => handleChange('account_number', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Clearing Number">
              <Input
                placeholder=""
                value={form.clearing_number}
                onChange={e => handleChange('clearing_number', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="BIC/SWIFT">
              <Input
                placeholder=""
                value={form.bic_swift}
                onChange={e => handleChange('bic_swift', e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Holder Name">
              <Input
                placeholder={holderName}
                value={form.holder_name}
                onChange={e => handleChange('holder_name', e.target.value)}
              />
            </FieldRow>
          </Box>

          {/* Sub-tabs */}
          <Flex borderBottom="1px solid" borderColor={borderColor} mb={4}>
            {(['note', 'bank_info'] as SubTab[]).map(t => {
              const label = t === 'note' ? 'Note' : 'Bank Information';
              const isActive = subTab === t;
              return (
                <Box
                  key={t}
                  as="button"
                  px={4}
                  py={2.5}
                  fontSize="sm"
                  fontWeight={isActive ? 'semibold' : 'medium'}
                  color={isActive ? tabActiveColor : tabInactiveColor}
                  borderBottom="2px solid"
                  borderColor={isActive ? tabActiveBorder : 'transparent'}
                  mb="-1px"
                  transition="all 0.15s"
                  _hover={{ bg: tabHoverBg, color: tabActiveColor }}
                  onClick={() => setSubTab(t)}
                >
                  {label}
                </Box>
              );
            })}
          </Flex>

          {subTab === 'note' && (
            <Textarea
              placeholder="Internal notes..."
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
              rows={5}
              bg={textareaBg}
              borderColor={borderColor}
              fontSize="sm"
              resize="vertical"
            />
          )}

          {subTab === 'bank_info' && (
            <VStack spacing={0} align="stretch">
              <FieldRow label="Bank Name">
                <Input
                  placeholder="e.g. Bank of the Philippine Islands"
                  value={form.bank_name}
                  onChange={e => handleChange('bank_name', e.target.value)}
                />
              </FieldRow>
              <Box mb={2}>
                <Text fontSize="xs" fontWeight="medium" color={subTextColor} mb={1} ml={0}>Bank Address</Text>
                <VStack spacing={2}>
                  <Input
                    placeholder="Street..."
                    value={form.bank_street}
                    onChange={e => handleChange('bank_street', e.target.value)}
                  />
                  <Input
                    placeholder="Street 2..."
                    value={form.bank_street2}
                    onChange={e => handleChange('bank_street2', e.target.value)}
                  />
                  <HStack spacing={2}>
                    <Input
                      placeholder="City"
                      value={form.bank_city}
                      onChange={e => handleChange('bank_city', e.target.value)}
                    />
                    <Input
                      placeholder="State"
                      value={form.bank_state}
                      onChange={e => handleChange('bank_state', e.target.value)}
                    />
                    <Input
                      placeholder="ZIP"
                      value={form.bank_zip}
                      onChange={e => handleChange('bank_zip', e.target.value)}
                    />
                  </HStack>
                  <Input
                    placeholder="Country"
                    value={form.bank_country}
                    onChange={e => handleChange('bank_country', e.target.value)}
                  />
                </VStack>
              </Box>
            </VStack>
          )}

          {/* Actions */}
          <Flex mt={6} gap={2}>
            <Button
              colorScheme="blue"
              size="sm"
              leftIcon={<Save size={14} />}
              onClick={handleSave}
              isLoading={saving}
              loadingText="Saving"
            >
              Save
            </Button>
            <Button variant="outline" colorScheme="gray" size="sm" onClick={onClose}>
              Discard
            </Button>
          </Flex>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
