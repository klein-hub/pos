import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { formatPeso, quoteSale, type Modifier, type ModifierGroup, type Product } from '@digita/core';
import { useCartStore } from '../store/cart';
import { useCatalog } from '../store/shop';
import { colors, numeric, radius, text } from '../theme';
import { Button } from './Button';
import { QtyStepper } from './QtyStepper';
import { Sheet } from './Sheet';

interface ProductSheetProps {
  product: Product | null;
  onClose: () => void;
}

/** Size, add-ons and quantity for one product, then into the order. */
export function ProductSheet({ product, onClose }: ProductSheetProps) {
  return (
    <Sheet visible={!!product} onClose={onClose} title={product?.name ?? ''} scroll>
      {/* Keyed so each product opens with fresh choices, not the last one's. */}
      {product ? <Choices key={product.id} product={product} onDone={onClose} /> : null}
    </Sheet>
  );
}

function Choices({ product, onDone }: { product: Product; onDone: () => void }) {
  const { variantsOf, groupsOf, modifiersIn, pricing, costing } = useCatalog();
  const add = useCartStore((s) => s.add);

  const variants = variantsOf(product.id);
  const groups = groupsOf(product.id);
  const [variantId, setVariantId] = useState(variants[0]?.id ?? '');
  const [modifierIds, setModifierIds] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const line = useMemo(
    () => (variantId ? quoteSale([{ variantId, modifierIds, qty }], pricing, costing).lines[0] : undefined),
    [variantId, modifierIds, qty, pricing, costing],
  );

  const toggle = (group: ModifierGroup, modifier: Modifier) => {
    setModifierIds((current) => {
      if (current.includes(modifier.id)) return current.filter((id) => id !== modifier.id);
      const inGroup = modifiersIn(group.id).map((m) => m.id);
      const chosen = current.filter((id) => inGroup.includes(id));
      // A pick-one group behaves like radio buttons; a pick-many group stops at its limit.
      if (group.maxSelect === 1) return [...current.filter((id) => !inGroup.includes(id)), modifier.id];
      if (chosen.length >= group.maxSelect) return current;
      return [...current, modifier.id];
    });
  };

  const unmet = groups.find(
    (g) => modifierIds.filter((id) => modifiersIn(g.id).some((m) => m.id === id)).length < g.minSelect,
  );

  return (
    <>
      {variants.length > 1 ? (
        <View style={styles.section}>
          <Text style={text.label}>Size</Text>
          <View style={styles.chips}>
            {variants.map((v) => {
              const selected = v.id === variantId;
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setVariantId(v.id)}
                  style={[styles.chip, selected && styles.chipOn]}
                >
                  <Text style={[styles.chipTitle, selected && styles.chipTitleOn]}>{v.size}</Text>
                  <Text style={[styles.chipPrice, selected && styles.chipTitleOn]}>{formatPeso(v.sellingPrice)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.id} style={styles.section}>
          <Text style={text.label}>
            {group.name}
            {group.minSelect > 0 ? ' · required' : ''}
          </Text>
          {modifiersIn(group.id).map((m) => {
            const on = modifierIds.includes(m.id);
            return (
              <Pressable
                key={m.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(group, m)}
                style={[styles.option, on && styles.optionOn]}
              >
                <View style={[styles.box, on && styles.boxOn]}>{on ? <Check size={16} color={colors.onPrimary} /> : null}</View>
                <Text style={[text.body, styles.optionName]}>{m.name}</Text>
                <Text style={styles.delta}>
                  {m.priceDelta === 0 ? 'free' : `${m.priceDelta > 0 ? '+' : ''}${formatPeso(m.priceDelta)}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <QtyStepper value={qty} onChange={setQty} min={1} large />
        <Button
          label={line ? `Add · ${formatPeso(line.lineGross)}` : 'Add'}
          size="lg"
          disabled={!line || !!unmet}
          onPress={() => {
            add(variantId, modifierIds, qty);
            onDone();
          }}
          style={styles.add}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minWidth: 96,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 2,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  chipPrice: { fontSize: 13, color: colors.muted, ...numeric },
  chipTitleOn: { color: colors.onPrimary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primaryLine, backgroundColor: colors.primarySoft },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionName: { flex: 1 },
  delta: { fontSize: 15, color: colors.muted, ...numeric },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  add: { flex: 1 },
});
