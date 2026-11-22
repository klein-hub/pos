import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { formatPeso, quoteSale, type StatutoryDiscountRequest } from '@digita/core';
import { useCartStore } from '../store/cart';
import { useCatalog } from '../store/shop';
import { colors, numeric, radius, text } from '../theme';
import { Button } from './Button';
import { QtyStepper } from './QtyStepper';
import { Sheet } from './Sheet';

interface DiscountSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Senior citizen / PWD discount. The ID number and name go on the discount
 * register BIR asks for, so both are required. The engine strips VAT first and
 * then takes 20% — the cashier never does that arithmetic.
 */
export function DiscountSheet({ visible, onClose }: DiscountSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Senior / PWD discount">
      {visible ? <DiscountForm onDone={onClose} /> : null}
    </Sheet>
  );
}

function DiscountForm({ onDone }: { onDone: () => void }) {
  const { pricing, costing } = useCatalog();
  const lines = useCartStore((s) => s.lines);
  const current = useCartStore((s) => s.discount);
  const setDiscount = useCartStore((s) => s.setDiscount);

  const [kind, setKind] = useState<StatutoryDiscountRequest['kind']>(current?.kind ?? 'senior');
  const [idNumber, setIdNumber] = useState(current?.idNumber ?? '');
  const [holderName, setHolderName] = useState(current?.holderName ?? '');
  const [totalPax, setTotalPax] = useState(current?.totalPax ?? 1);
  const [qualifiedPax, setQualifiedPax] = useState(current?.qualifiedPax ?? 1);

  const complete = idNumber.trim() !== '' && holderName.trim() !== '';
  const request: StatutoryDiscountRequest = { kind, idNumber, holderName, totalPax, qualifiedPax };

  // Cheap enough to recompute per keystroke; showing the payable as the form
  // fills in is what lets the cashier tell the customer before charging.
  const before = quoteSale(lines, pricing, costing);
  const after = complete ? quoteSale(lines, pricing, costing, request) : null;

  return (
    <>
      <View style={styles.segment}>
        {(['senior', 'pwd'] as const).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === k }}
            onPress={() => setKind(k)}
            style={[styles.segmentItem, kind === k && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, kind === k && styles.segmentTextOn]}>
              {k === 'senior' ? 'Senior citizen' : 'PWD'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Field label={kind === 'senior' ? 'OSCA / Senior ID number' : 'PWD ID number'}>
        <TextInput
          value={idNumber}
          onChangeText={setIdNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="As printed on the card"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
      </Field>
      <Field label="Name on the card">
        <TextInput
          value={holderName}
          onChangeText={setHolderName}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="Full name"
          placeholderTextColor={colors.faint}
          style={styles.input}
        />
      </Field>

      <View style={styles.paxRow}>
        <Field label="Diners on this bill">
          <QtyStepper
            value={totalPax}
            min={1}
            max={30}
            onChange={(n) => {
              setTotalPax(n);
              setQualifiedPax((q) => Math.min(q, n));
            }}
          />
        </Field>
        <Field label="With a card">
          <QtyStepper value={qualifiedPax} min={1} max={totalPax} onChange={setQualifiedPax} />
        </Field>
      </View>
      <Text style={text.muted}>
        In a group, only the cardholders’ share of the bill is discounted; the rest stays VATable.
      </Text>

      <View style={styles.preview}>
        <Text style={text.muted}>Customer pays</Text>
        <Text style={styles.previewAmount}>{formatPeso(after?.total ?? before.total)}</Text>
        {after ? <Text style={styles.saving}>saves {formatPeso(after.discountTotal)}</Text> : null}
      </View>

      <View style={styles.actions}>
        {current ? (
          <Button
            label="Remove discount"
            variant="ghost"
            onPress={() => {
              setDiscount(null);
              onDone();
            }}
          />
        ) : null}
        <Button
          label="Apply discount"
          size="lg"
          disabled={!complete}
          onPress={() => {
            setDiscount({ ...request, idNumber: idNumber.trim(), holderName: holderName.trim() });
            onDone();
          }}
          style={styles.apply}
        />
      </View>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={text.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.sunken,
  },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.surface, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)' },
  segmentText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  segmentTextOn: { color: colors.text },
  field: { gap: 8, flex: 1 },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  paxRow: { flexDirection: 'row', gap: 16 },
  preview: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewAmount: { fontSize: 28, fontWeight: '800', color: colors.text, ...numeric },
  saving: { fontSize: 14, fontWeight: '600', color: colors.good },
  actions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  apply: { flex: 1 },
});
