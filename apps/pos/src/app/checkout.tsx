import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { QrCode, Smartphone, X } from 'lucide-react-native';
import {
  formatPeso,
  saleDraws,
  settleTenders,
  TENDER_LABELS,
  type Centavos,
  type TenderInput,
} from '@digita/core';
import { AmountPad } from '../components/AmountPad';
import { Button } from '../components/Button';
import { OrderLines } from '../components/OrderLines';
import { Totals } from '../components/Totals';
import { TopBar } from '../components/TopBar';
import { parsePesos, pesosText } from '../lib/format';
import { useIsWide } from '../lib/layout';
import { useCartStore, useQuote } from '../store/cart';
import { useSessionStore } from '../store/session';
import { useCatalog } from '../store/shop';
import { card, colors, numeric, radius, text } from '../theme';

interface ElectronicTender {
  key: number;
  method: 'gcash' | 'qr';
  /** As typed, in pesos. */
  amount: string;
  referenceNo: string;
}

/** Bills a customer is likely to hand over, for one-tap cash entry. */
const NOTES = [50, 100, 500, 1000];

/**
 * Tenders and completion. Electronic tenders take the exact amount sent and
 * the reference from the customer's phone; cash takes what was handed over,
 * and the engine works out the change. Split payments are just several tenders.
 */
export default function Checkout() {
  const wide = useIsWide();
  const { costing } = useCatalog();
  const quote = useQuote();
  const lineCount = useCartStore((s) => s.lines.length);
  const clear = useCartStore((s) => s.clear);
  const recordSale = useSessionStore((s) => s.recordSale);

  const [cash, setCash] = useState('');
  const [electronic, setElectronic] = useState<ElectronicTender[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenders: TenderInput[] = [
    ...electronic.map((t) => ({ method: t.method, amount: parsePesos(t.amount) ?? 0, referenceNo: t.referenceNo })),
    ...(cash !== '' ? [{ method: 'cash' as const, tendered: parsePesos(cash) ?? 0 }] : []),
  ];
  const settlement = settleTenders(quote.total, tenders);
  const electronicTotal = electronic.reduce((sum, t) => sum + (parsePesos(t.amount) ?? 0), 0);
  const dueInCash = Math.max(0, quote.total - electronicTotal);

  const addElectronic = (method: ElectronicTender['method']) => {
    // Prefill with whatever is still unpaid — the common case is one wallet for the lot.
    const unpaid = Math.max(0, quote.total - electronicTotal - (parsePesos(cash) ?? 0));
    setElectronic((list) => [...list, { key: nextKey, method, amount: unpaid > 0 ? pesosText(unpaid) : '', referenceNo: '' }]);
    setNextKey((k) => k + 1);
  };

  const update = (key: number, patch: Partial<ElectronicTender>) =>
    setElectronic((list) => list.map((t) => (t.key === key ? { ...t, ...patch } : t)));

  const complete = async () => {
    // A double tap must not ring the sale twice.
    if (!settlement.complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const sale = await recordSale({
        quote,
        payments: settlement.payments,
        change: settlement.change,
        draws: saleDraws(quote.lines, costing).draws,
      });
      router.replace({ pathname: '/receipt/[id]', params: { id: sale.id } });
      clear();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  if (lineCount === 0 && !submitting) {
    return (
      <SafeAreaView style={styles.screen}>
        <TopBar title="Checkout" onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text style={text.muted}>There is nothing to charge.</Text>
          <Button label="Back to the menu" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const summary = (
    <View style={[card, styles.section]}>
      <Text style={text.label}>Order</Text>
      <OrderLines lines={quote.lines} />
      <Totals quote={quote} detail="full" />
      {quote.discount ? (
        <Text style={text.muted}>
          {quote.discount.kind === 'pwd' ? 'PWD' : 'Senior citizen'}: {quote.discount.holderName} · ID{' '}
          {quote.discount.idNumber}
        </Text>
      ) : null}
    </View>
  );

  const payment = (
    <>
      <View style={[card, styles.due]}>
        <Text style={text.label}>Amount due</Text>
        <Text style={styles.dueAmount}>{formatPeso(quote.total)}</Text>
      </View>

      <View style={[card, styles.section]}>
        <Text style={text.label}>E-wallet</Text>
        {electronic.map((t) => (
          <View key={t.key} style={styles.wallet}>
            <View style={styles.walletHead}>
              <Text style={[text.body, styles.walletName]}>{TENDER_LABELS[t.method]}</Text>
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${TENDER_LABELS[t.method]} payment`}
                onPress={() => setElectronic((list) => list.filter((x) => x.key !== t.key))}
              >
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.walletFields}>
              <TextInput
                value={t.amount}
                onChangeText={(amount) => update(t.key, { amount })}
                keyboardType="decimal-pad"
                placeholder="Amount"
                placeholderTextColor={colors.faint}
                accessibilityLabel={`${TENDER_LABELS[t.method]} amount`}
                style={[styles.input, styles.amountInput]}
              />
              <TextInput
                value={t.referenceNo}
                onChangeText={(referenceNo) => update(t.key, { referenceNo })}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="Reference no."
                placeholderTextColor={colors.faint}
                accessibilityLabel={`${TENDER_LABELS[t.method]} reference number`}
                style={[styles.input, styles.refInput]}
              />
            </View>
          </View>
        ))}
        <View style={styles.walletButtons}>
          <Button label="Add GCash" icon={Smartphone} variant="secondary" onPress={() => addElectronic('gcash')} style={styles.flex} />
          <Button label="Add QR" icon={QrCode} variant="secondary" onPress={() => addElectronic('qr')} style={styles.flex} />
        </View>
      </View>

      <View style={[card, styles.section]}>
        <AmountPad
          label="Cash received"
          value={cash}
          onChange={setCash}
          keyHeight={wide ? 56 : 52}
          quick={cashSuggestions(dueInCash)}
        />
      </View>
    </>
  );

  const status = (
    <View style={styles.status}>
      {settlement.problems.map((p) => (
        <Text key={p} style={styles.problem}>
          {p}
        </Text>
      ))}
      {error ? <Text style={styles.problem}>{error}</Text> : null}
      <View style={styles.statusRow}>
        {settlement.remaining > 0 ? (
          <>
            <Text style={styles.statusLabel}>Still due</Text>
            <Text style={[styles.statusAmount, { color: colors.watch }]}>{formatPeso(settlement.remaining)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.statusLabel}>Change</Text>
            <Text style={[styles.statusAmount, { color: colors.good }]}>{formatPeso(settlement.change)}</Text>
          </>
        )}
      </View>
      <Button
        label="Complete sale"
        size="xl"
        busy={submitting}
        disabled={!settlement.complete}
        onPress={() => void complete()}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title="Checkout" onBack={() => router.back()} />
      {wide ? (
        <View style={styles.columns}>
          <ScrollView style={styles.flex} contentContainerStyle={styles.pane}>
            {summary}
          </ScrollView>
          <View style={styles.side}>
            <ScrollView style={styles.flex} contentContainerStyle={styles.pane} keyboardShouldPersistTaps="handled">
              {payment}
            </ScrollView>
            {status}
          </View>
        </View>
      ) : (
        <>
          <ScrollView style={styles.flex} contentContainerStyle={styles.pane} keyboardShouldPersistTaps="handled">
            {payment}
            {summary}
          </ScrollView>
          {status}
        </>
      )}
    </SafeAreaView>
  );
}

/** Exact, then the next round amounts above it that a customer would hand over. */
function cashSuggestions(due: Centavos): { label: string; value: string }[] {
  if (due <= 0) return [];
  const pesos = due / 100;
  const ups = [...new Set(NOTES.map((n) => Math.ceil(pesos / n) * n))]
    .filter((v) => v > pesos)
    .sort((a, b) => a - b)
    .slice(0, 3);
  return [
    { label: `Exact ${formatPeso(due)}`, value: pesosText(due) },
    ...ups.map((v) => ({ label: formatPeso(v * 100).replace('.00', ''), value: String(v) })),
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row' },
  side: { width: 460, borderLeftWidth: 1, borderLeftColor: colors.border, backgroundColor: colors.canvas },
  pane: { padding: 16, gap: 14 },
  section: { padding: 16, gap: 12 },
  due: { padding: 16, gap: 2, alignItems: 'center' },
  dueAmount: { fontSize: 40, fontWeight: '800', color: colors.text, ...numeric },
  wallet: { gap: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  walletHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  walletName: { fontWeight: '700' },
  walletFields: { flexDirection: 'row', gap: 8 },
  walletButtons: { flexDirection: 'row', gap: 8 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  amountInput: { width: 130, ...numeric },
  refInput: { flex: 1 },
  status: { gap: 10, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  statusRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  statusLabel: { ...text.heading, color: colors.muted },
  statusAmount: { fontSize: 30, fontWeight: '800', ...numeric },
  problem: { color: colors.bad, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
