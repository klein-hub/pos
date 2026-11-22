import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BadgePercent, ChevronRight } from 'lucide-react-native';
import { formatPeso } from '@digita/core';
import { useCartStore, useQuote } from '../store/cart';
import { colors, radius, text } from '../theme';
import { Button } from './Button';
import { DiscountSheet } from './DiscountSheet';
import { OrderLines } from './OrderLines';
import { Totals } from './Totals';

interface CartPanelProps {
  onCharge: () => void;
}

/** The running order: lines, the senior/PWD discount, totals, and Charge. */
export function CartPanel({ onCharge }: CartPanelProps) {
  const lines = useCartStore((s) => s.lines);
  const discount = useCartStore((s) => s.discount);
  const setQty = useCartStore((s) => s.setQty);
  const clear = useCartStore((s) => s.clear);
  const quote = useQuote();
  const [discountOpen, setDiscountOpen] = useState(false);
  const empty = lines.length === 0;

  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={text.heading}>Order</Text>
        {!empty ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button">
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.lines} contentContainerStyle={empty ? styles.emptyWrap : styles.linesContent}>
        {empty ? (
          <Text style={styles.empty}>Tap a drink or dessert to start an order.</Text>
        ) : (
          <OrderLines
            lines={quote.lines}
            onQtyChange={(index, qty) => {
              const line = lines[index];
              if (line) setQty(line.key, qty);
            }}
          />
        )}
      </ScrollView>

      <View style={styles.foot}>
        <Pressable
          accessibilityRole="button"
          disabled={empty}
          onPress={() => setDiscountOpen(true)}
          style={({ pressed }) => [styles.discount, discount && styles.discountOn, pressed && styles.pressed, empty && styles.off]}
        >
          <BadgePercent size={20} color={discount ? colors.good : colors.muted} />
          <View style={styles.discountText}>
            <Text style={[text.body, styles.discountTitle]}>
              {discount ? `${discount.kind === 'pwd' ? 'PWD' : 'Senior citizen'} discount` : 'Senior / PWD discount'}
            </Text>
            {discount ? (
              <Text style={text.muted} numberOfLines={1}>
                {discount.holderName} · ID {discount.idNumber}
                {(discount.totalPax ?? 1) > 1 ? ` · ${discount.qualifiedPax ?? 1} of ${discount.totalPax} diners` : ''}
              </Text>
            ) : null}
          </View>
          {discount ? <Text style={styles.saving}>−{formatPeso(quote.discountTotal)}</Text> : null}
          <ChevronRight size={18} color={colors.faint} />
        </Pressable>

        <Totals quote={quote} />

        <Button label={`Charge ${formatPeso(quote.total)}`} size="xl" disabled={empty} onPress={onCharge} />
      </View>

      <DiscountSheet visible={discountOpen} onClose={() => setDiscountOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, backgroundColor: colors.surface },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  clear: { fontSize: 14, fontWeight: '600', color: colors.bad },
  lines: { flex: 1 },
  linesContent: { paddingHorizontal: 18 },
  emptyWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { ...text.muted, textAlign: 'center' },
  foot: { gap: 14, padding: 18, borderTopWidth: 1, borderTopColor: colors.border },
  discount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.canvas,
  },
  discountOn: { backgroundColor: colors.goodSoft, borderColor: '#bfe3cd' },
  discountText: { flex: 1, minWidth: 0 },
  discountTitle: { fontWeight: '600' },
  saving: { fontSize: 15, fontWeight: '700', color: colors.good },
  pressed: { opacity: 0.8 },
  off: { opacity: 0.5 },
});
