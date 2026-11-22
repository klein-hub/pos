import { StyleSheet, Text, View } from 'react-native';
import { formatPeso, type SaleQuote } from '@digita/core';
import { colors, numeric } from '../theme';

interface TotalsProps {
  quote: SaleQuote;
  /**
   * 'short' for the cart: what the customer pays. 'full' for checkout and the
   * receipt: the VAT breakdown a BIR-style receipt carries.
   */
  detail?: 'short' | 'full';
}

export function Totals({ quote, detail = 'short' }: TotalsProps) {
  const kind = quote.discount?.kind === 'pwd' ? 'PWD' : 'Senior';
  const discounted = quote.discountTotal > 0;

  return (
    <View style={styles.block}>
      <Row label="Subtotal" value={quote.subtotal} />
      {discounted ? (
        <>
          <Row label={`Less VAT exemption (${kind})`} value={-quote.vatExemption} />
          <Row label={`Less 20% ${kind} discount`} value={-quote.exemptDiscount} />
        </>
      ) : null}
      <View style={styles.rule} />
      <Row label="Total" value={quote.total} strong />

      {detail === 'full' ? (
        <View style={styles.vat}>
          <Row label="VATable sales" value={quote.vatableSales} small />
          <Row label="VAT (12%)" value={quote.vatAmount} small />
          <Row label="VAT-exempt sales" value={quote.vatExemptSales} small />
        </View>
      ) : !discounted && quote.subtotal > 0 ? (
        <Text style={styles.note}>Includes {formatPeso(quote.vatAmount)} VAT</Text>
      ) : null}
    </View>
  );
}

function Row({ label, value, strong, small }: { label: string; value: number; strong?: boolean; small?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.strong, small && styles.small]}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong, small && styles.small]}>{formatPeso(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 15, color: colors.muted, flexShrink: 1 },
  value: { fontSize: 15, color: colors.text, ...numeric },
  strong: { fontSize: 20, fontWeight: '800', color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  vat: { marginTop: 8, paddingTop: 8, gap: 4, borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' },
  note: { fontSize: 13, color: colors.faint, textAlign: 'right' },
});
