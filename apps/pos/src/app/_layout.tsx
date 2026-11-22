import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSessionStore } from '../store/session';
import { useShopStore } from '../store/shop';
import { colors } from '../theme';

/**
 * The till's state machine lives in the route guards, not in imperative
 * navigation: no cashier -> PIN pad; cashier but no shift -> open a shift;
 * both -> the register. Locking or closing flips a guard and the router
 * follows, so no screen can be reached out of order.
 */
export default function RootLayout() {
  const ready = useShopStore((s) => s.status === 'ready');
  const load = useShopStore((s) => s.load);
  const hasCashier = useSessionStore((s) => s.cashier !== null);
  const hasShift = useSessionStore((s) => s.shift !== null);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Protected guard={ready && hasCashier && hasShift}>
          <Stack.Screen name="index" />
          <Stack.Screen name="cart" />
          <Stack.Screen name="checkout" />
          <Stack.Screen name="receipt/[id]" />
          <Stack.Screen name="close-shift" />
        </Stack.Protected>
        <Stack.Protected guard={ready && hasCashier && !hasShift}>
          <Stack.Screen name="open-shift" />
        </Stack.Protected>
        {/* Also where the till waits while the catalog loads, or says why it could not. */}
        <Stack.Protected guard={!ready || !hasCashier}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
