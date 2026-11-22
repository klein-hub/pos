import { StyleSheet, Text, View } from 'react-native';
import { formatPeso, type QuotedLine } from '@digita/core';
import { lineLabel } from '../lib/format';
import { useCatalog } from '../store/shop';
import { colors, numeric } from '../theme';
import { QtyStepper } from './QtyStepper';

interface OrderLinesProps {
  lines: QuotedLine[];
  /** Editable in the cart; read-only on checkout and the receipt. */
  onQtyChange?: (index: number, qty: number) => void;
}

export function OrderLines({ lines, onQtyChange }: OrderLinesProps) {
  const { productOf, variantsOf, pricing } = useCatalog();

  return (
    <View style={styles.list}>
      {lines.map((line, index) => {
        const product = productOf(line.variantId);
        const variant = pricing.getVariant(line.variantId);
        const name = product && variant ? lineLabel(product.name, variant.size, variantsOf(product.id).length) : line.variantId;
        return (
          <View key={`${line.variantId}|${line.modifierIds.join(',')}|${index}`} style={styles.line}>
            <View style={styles.main}>
              <Text style={styles.name}>
                {onQtyChange ? '' : `${line.qty} × `}
                {name}
              </Text>
              {line.modifierIds.map((id, i) => {
                const modifier = pricing.getModifier(id);
                return (
                  <Text key={`${id}-${i}`} style={styles.modifier}>
                    + {modifier?.name ?? id}
                    {modifier && modifier.priceDelta !== 0 ? `  ${formatPeso(modifier.priceDelta)}` : ''}
                  </Text>
                );
              })}
              {line.qty > 1 && onQtyChange ? (
                <Text style={styles.each}>{formatPeso(line.unitPrice)} each</Text>
              ) : null}
            </View>
            {onQtyChange ? <QtyStepper value={line.qty} onChange={(q) => onQtyChange(index, q)} /> : null}
            <Text style={styles.amount}>{formatPeso(line.lineGross)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  modifier: { fontSize: 13, color: colors.muted },
  each: { fontSize: 12, color: colors.faint, ...numeric },
  amount: { minWidth: 78, textAlign: 'right', fontSize: 15, fontWeight: '600', color: colors.text, ...numeric },
});
