import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { formatPeso, TENDER_LABELS } from '@digita/core';
import type { RecordedSale } from '../backend';
import { formatTime } from '../lib/format';
import { colors, numeric, text } from '../theme';
import { Sheet } from './Sheet';

interface SalesSheetProps {
  visible: boolean;
  sales: RecordedSale[];
  onClose: () => void;
  onOpen: (sale: RecordedSale) => void;
}

/** This shift's receipts, newest first, for re-sharing one at the counter. */
export function SalesSheet({ visible, sales, onClose, onOpen }: SalesSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title="This shift’s receipts">
      {sales.length === 0 ? (
        <Text style={text.muted}>No sales yet this shift.</Text>
      ) : (
        <View>
          {sales.map((sale) => (
            <Pressable
              key={sale.id}
              accessibilityRole="button"
              onPress={() => onOpen(sale)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.main}>
                <Text style={styles.receipt}>{sale.receiptNo}</Text>
                <Text style={text.muted} numberOfLines={1}>
                  {formatTime(sale.soldAt)} · {sale.cashier.name} ·{' '}
                  {sale.payments.map((p) => TENDER_LABELS[p.method]).join(' + ')}
                </Text>
              </View>
              <Text style={styles.total}>{formatPeso(sale.quote.total)}</Text>
              <ChevronRight size={18} color={colors.faint} />
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  receipt: { fontSize: 15, fontWeight: '700', color: colors.text, ...numeric },
  total: { fontSize: 16, fontWeight: '700', color: colors.text, ...numeric },
});
