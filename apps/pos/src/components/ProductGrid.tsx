import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { formatPeso, type Product } from '@digita/core';
import { useCatalog } from '../store/shop';
import { colors, numeric, radius } from '../theme';

interface ProductGridProps {
  products: Product[];
  /** Units of each product already in the order, for the badge. */
  inCart: Record<string, number>;
  onPick: (product: Product) => void;
}

const MIN_TILE = 150;
const GAP = 12;

export function ProductGrid({ products, inCart, onPick }: ProductGridProps) {
  const { variantsOf } = useCatalog();
  const [width, setWidth] = useState(0);

  // Fill the row with as many tiles as fit, rather than a fixed count that
  // leaves a phone cramped or a tablet half empty.
  const columns = Math.max(2, Math.floor((width + GAP) / (MIN_TILE + GAP)));
  const tileWidth = width > 0 ? (width - GAP * (columns - 1)) / columns : MIN_TILE;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {products.map((product) => {
          const prices = variantsOf(product.id).map((v) => v.sellingPrice);
          const from = Math.min(...prices);
          const count = inCart[product.id] ?? 0;
          return (
            <Pressable
              key={product.id}
              accessibilityRole="button"
              accessibilityLabel={`${product.name}, ${prices.length > 1 ? 'from ' : ''}${formatPeso(from)}`}
              onPress={() => onPick(product)}
              style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && styles.pressed]}
            >
              <Text style={styles.category}>{product.category}</Text>
              <Text style={styles.name} numberOfLines={2}>
                {product.name}
              </Text>
              <Text style={styles.price}>
                {prices.length > 1 ? <Text style={styles.from}>from </Text> : null}
                {formatPeso(from)}
              </Text>
              {count > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    minHeight: 112,
    padding: 14,
    justifyContent: 'space-between',
    gap: 6,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  },
  pressed: { backgroundColor: colors.primarySoft, borderColor: colors.primaryLine },
  category: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.faint },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  price: { fontSize: 15, fontWeight: '600', color: colors.primary, ...numeric },
  from: { fontSize: 13, fontWeight: '400', color: colors.muted },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  badgeText: { color: colors.onPrimary, fontSize: 13, fontWeight: '800', ...numeric },
});
