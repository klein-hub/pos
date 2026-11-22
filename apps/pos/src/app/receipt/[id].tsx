import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Share2 } from 'lucide-react-native';
import { formatPeso, TENDER_LABELS } from '@digita/core';
import { backend } from '../../backend';
import { Button } from '../../components/Button';
import { OrderLines } from '../../components/OrderLines';
import { Totals } from '../../components/Totals';
import { TopBar } from '../../components/TopBar';
import { formatDateTime } from '../../lib/format';
import { receiptText } from '../../lib/receipt';
import { useSessionStore } from '../../store/session';
import { useCatalog } from '../../store/shop';
import { colors, numeric, radius, text } from '../../theme';

/** Digital receipt — no printer in the brief — shared from the customer's side of the counter. */
export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sale = useSessionStore((s) => s.sales.find((x) => x.id === id));
  const catalog = useCatalog();
  const [shareError, setShareError] = useState<string | null>(null);

  const done = () => {
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  if (!sale) {
    return (
      <SafeAreaView style={styles.screen}>
        <TopBar title="Receipt" onBack={done} />
        <View style={styles.missing}>
          <Text style={text.muted}>That receipt is not in this shift.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { quote } = sale;
  const demo = backend.mode === 'demo';

  const share = async () => {
    setShareError(null);
    try {
      await Share.share({ message: receiptText(sale, catalog.shop, catalog, demo) });
    } catch {
      setShareError('Sharing is not available on this device.');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title={`Receipt ${sale.receiptNo}`} subtitle={formatDateTime(sale.soldAt)} onBack={done} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.paper}>
          <View style={styles.head}>
            <Text style={styles.shop}>{catalog.shop.companyName}</Text>
            <Text style={text.muted}>{catalog.shop.locationName}</Text>
            <Text style={[text.muted, numeric]}>
              {sale.receiptNo} · {formatDateTime(sale.soldAt)}
            </Text>
            <Text style={text.muted}>Cashier: {sale.cashier.name}</Text>
          </View>

          <OrderLines lines={quote.lines} />
          <Totals quote={quote} detail="full" />

          {quote.discount ? (
            <Text style={text.muted}>
              {quote.discount.kind === 'pwd' ? 'PWD' : 'Senior citizen'}: {quote.discount.holderName} · ID{' '}
              {quote.discount.idNumber}
            </Text>
          ) : null}

          <View style={styles.tenders}>
            {sale.payments.map((p, i) => (
              <View key={`${p.method}-${i}`} style={styles.row}>
                <Text style={text.body}>
                  {TENDER_LABELS[p.method]}
                  {p.referenceNo ? <Text style={text.muted}>  Ref {p.referenceNo}</Text> : null}
                </Text>
                <Text style={[text.body, numeric]}>{formatPeso(p.tendered ?? p.amount)}</Text>
              </View>
            ))}
            {sale.change > 0 ? (
              <View style={styles.row}>
                <Text style={[text.body, styles.bold]}>Change</Text>
                <Text style={[text.body, styles.bold, numeric]}>{formatPeso(sale.change)}</Text>
              </View>
            ) : null}
          </View>

          {demo ? <Text style={styles.demo}>DEMO DATA — NOT AN OFFICIAL RECEIPT</Text> : null}
        </View>

        {shareError ? <Text style={styles.error}>{shareError}</Text> : null}
        <View style={styles.actions}>
          <Button label="Share" icon={Share2} variant="secondary" size="lg" onPress={() => void share()} style={styles.flex} />
          <Button label="New order" size="lg" onPress={done} style={styles.flex} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { alignItems: 'center', padding: 20, gap: 16 },
  paper: {
    width: '100%',
    maxWidth: 440,
    padding: 20,
    gap: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
  },
  head: { alignItems: 'center', gap: 2, paddingBottom: 6 },
  shop: { fontSize: 20, fontWeight: '800', color: colors.text },
  tenders: { gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  bold: { fontWeight: '700' },
  demo: { textAlign: 'center', fontSize: 12, fontWeight: '800', letterSpacing: 0.6, color: colors.watch },
  actions: { flexDirection: 'row', gap: 12, width: '100%', maxWidth: 440 },
  flex: { flex: 1 },
  error: { color: colors.bad, fontWeight: '600' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
