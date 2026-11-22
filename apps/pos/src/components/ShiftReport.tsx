import { StyleSheet, Text, View } from 'react-native';
import { formatPeso, TENDER_LABELS, type ShiftSummary, type TenderMethod } from '@digita/core';
import { colors, numeric, text } from '../theme';

interface ShiftReportProps {
  summary: ShiftSummary;
  openingFloat: number;
  /** Before the count is submitted the expected cash stays hidden — see close-shift. */
  showDrawer: boolean;
}

const METHODS: TenderMethod[] = ['cash', 'gcash', 'qr', 'card'];

export function ShiftReport({ summary, openingFloat, showDrawer }: ShiftReportProps) {
  const variance = summary.variance;
  const varianceColor =
    variance === undefined ? colors.text : variance === 0 ? colors.good : variance < 0 ? colors.bad : colors.watch;

  return (
    <View style={styles.block}>
      <Row label="Sales" value={String(summary.salesCount)} />
      <Row label="Net sales" value={formatPeso(summary.netSales)} />
      {summary.discounts > 0 ? <Row label="Senior / PWD discounts" value={formatPeso(summary.discounts)} /> : null}
      <View style={styles.rule} />
      {METHODS.filter((m) => m === 'cash' || summary.byMethod[m] > 0).map((m) => (
        <Row key={m} label={`${TENDER_LABELS[m]} taken`} value={formatPeso(summary.byMethod[m])} />
      ))}
      <Row label="Opening float" value={formatPeso(openingFloat)} />

      {showDrawer ? (
        <>
          <View style={styles.rule} />
          <Row label="Expected in drawer" value={formatPeso(summary.expectedCash)} />
          {summary.countedCash !== undefined ? <Row label="Counted" value={formatPeso(summary.countedCash)} /> : null}
          {variance !== undefined ? (
            <View style={styles.row}>
              <Text style={[styles.label, styles.strong]}>
                {variance === 0 ? 'Balanced' : variance < 0 ? 'Short' : 'Over'}
              </Text>
              <Text style={[styles.value, styles.strong, { color: varianceColor }]}>
                {variance > 0 ? '+' : ''}
                {formatPeso(variance)}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { ...text.body, color: colors.muted },
  value: { ...text.body, ...numeric },
  strong: { fontSize: 18, fontWeight: '800', color: colors.text },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
