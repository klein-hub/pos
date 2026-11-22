import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { takeHandoffFromUrl } from '@digita/core';
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
  const restoreShift = useSessionStore((s) => s.restoreShift);

  useEffect(() => {
    // Arriving from the launcher puts the session in the URL fragment. The
    // till still runs on its demo backend and has no sign-in to adopt it
    // into, but the token must not sit in the address bar or history either
    // way — so it is read and stripped here, even though nothing uses it yet.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      takeHandoffFromUrl(window.location, window.history);
    }
    void load();
    // A failure here is retried by unlock(), which surfaces it on the PIN pad.
    restoreShift().catch(() => {});
  }, [load, restoreShift]);

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
