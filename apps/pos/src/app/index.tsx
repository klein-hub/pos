import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronRight, Lock, LogOut, ReceiptText } from 'lucide-react-native';
import { formatPeso, type Product } from '@digita/core';
import { Button } from '../components/Button';
import { CartPanel } from '../components/CartPanel';
import { ProductGrid } from '../components/ProductGrid';
import { ProductSheet } from '../components/ProductSheet';
import { SalesSheet } from '../components/SalesSheet';
import { TopBar } from '../components/TopBar';
import { useIsWide } from '../lib/layout';
import { useCartStore, useQuote } from '../store/cart';
import { useSessionStore } from '../store/session';
import { useCatalog } from '../store/shop';
import { colors, numeric, radius } from '../theme';

const ALL = 'All';

/** The register: menu on the left, the running order on the right. */
export default function Register() {
  const wide = useIsWide();
  const { shop, products, categories, variantsOf, groupsOf, productOf } = useCatalog();
  const cashier = useSessionStore((s) => s.cashier);
  const sales = useSessionStore((s) => s.sales);
  const lock = useSessionStore((s) => s.lock);
  const lines = useCartStore((s) => s.lines);
  const add = useCartStore((s) => s.add);
  const quote = useQuote();

  const [category, setCategory] = useState(ALL);
  const [picking, setPicking] = useState<Product | null>(null);
  const [showSales, setShowSales] = useState(false);

  const shown = category === ALL ? products : products.filter((p) => p.category === category);

  const inCart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const line of lines) {
      const product = productOf(line.variantId);
      if (product) counts[product.id] = (counts[product.id] ?? 0) + line.qty;
    }
    return counts;
  }, [lines, productOf]);

  // Single-size items with nothing to choose go straight into the order —
  // the fast path matters more than consistency at a queue.
  const pick = (product: Product) => {
    const variants = variantsOf(product.id);
    const only = variants[0];
    if (variants.length === 1 && only && groupsOf(product.id).length === 0) add(only.id, []);
    else setPicking(product);
  };

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar
        title={shop.companyName}
        subtitle={`${shop.locationName} · ${sales.length} sale${sales.length === 1 ? '' : 's'} this shift`}
        right={
          <View style={styles.actions}>
            <Button
              label={wide ? 'Receipts' : ''}
              accessibilityLabel="This shift's receipts"
              icon={ReceiptText}
              variant="ghost"
              onPress={() => setShowSales(true)}
            />
            <Button
              label={wide ? 'Close shift' : ''}
              accessibilityLabel="Close shift"
              icon={LogOut}
              variant="ghost"
              onPress={() => router.push('/close-shift')}
            />
            <Button
              label={cashier?.name ?? ''}
              accessibilityLabel={`Lock the till (${cashier?.name ?? 'cashier'})`}
              icon={Lock}
              variant="secondary"
              onPress={lock}
            />
          </View>
        }
      />

      <View style={[styles.body, wide && styles.bodyWide]}>
        <View style={styles.menu}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={styles.tabs}>
            {[ALL, ...categories].map((c) => (
              <Pressable
                key={c}
                accessibilityRole="tab"
                accessibilityState={{ selected: c === category }}
                onPress={() => setCategory(c)}
                style={[styles.tab, c === category && styles.tabOn]}
              >
                <Text style={[styles.tabText, c === category && styles.tabTextOn]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ProductGrid products={shown} inCart={inCart} onPick={pick} />
        </View>

        {wide ? (
          <View style={styles.cart}>
            <CartPanel onCharge={() => router.push('/checkout')} />
          </View>
        ) : itemCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/cart')} style={styles.cartBar}>
            <Text style={styles.cartBarText}>
              {itemCount} item{itemCount === 1 ? '' : 's'} · {formatPeso(quote.total)}
            </Text>
            <View style={styles.cartBarCta}>
              <Text style={styles.cartBarText}>View order</Text>
              <ChevronRight size={20} color={colors.onPrimary} />
            </View>
          </Pressable>
        ) : null}
      </View>

      <ProductSheet product={picking} onClose={() => setPicking(null)} />
      <SalesSheet
        visible={showSales}
        sales={sales}
        onClose={() => setShowSales(false)}
        onOpen={(sale) => {
          setShowSales(false);
          router.push({ pathname: '/receipt/[id]', params: { id: sale.id } });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  menu: { flex: 1 },
  tabsBar: { flexGrow: 0 },
  tabs: { gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tab: {
    minHeight: 42,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.text, borderColor: colors.text },
  tabText: { fontSize: 15, fontWeight: '600', color: colors.muted },
  tabTextOn: { color: colors.surface },
  cart: { width: 380, borderLeftWidth: 1, borderLeftColor: colors.border },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 12,
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  cartBarCta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cartBarText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700', ...numeric },
});
