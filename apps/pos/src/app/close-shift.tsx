import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { summariseShift } from '@digita/core';
import { AmountPad } from '../components/AmountPad';
import { Button } from '../components/Button';
import { ShiftReport } from '../components/ShiftReport';
import { TopBar } from '../components/TopBar';
import { formatTime, parsePesos } from '../lib/format';
import { useIsWide } from '../lib/layout';
import { toShiftRecord } from '../lib/shift';
import { useCartStore } from '../store/cart';
import { useSessionStore } from '../store/session';
import { card, colors, text } from '../theme';

/**
 * A blind count: the cashier enters what is in the drawer before seeing what
 * should be there. Showing the expected figure first invites counting to match
 * it, which hides exactly the variance this screen exists to catch.
 */
export default function CloseShift() {
  const wide = useIsWide();
  const shift = useSessionStore((s) => s.shift);
  const sales = useSessionStore((s) => s.sales);
  const closeShift = useSessionStore((s) => s.closeShift);
  const openOrder = useCartStore((s) => s.lines.length > 0);
  const clearCart = useCartStore((s) => s.clear);

  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = parsePesos(counted);

  if (!shift) return null;
  const summary = summariseShift(shift.openingFloat, sales.map(toShiftRecord));

  const submit = async () => {
    if (amount === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      // On success the session clears and the guards take the till back to the PIN pad.
      await closeShift(amount);
      clearCart();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title="Close shift" subtitle={`Opened ${formatTime(shift.openedAt)}`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]}>
        <View style={[card, styles.section, wide && styles.half]}>
          <Text style={text.label}>This shift</Text>
          <ShiftReport summary={summary} openingFloat={shift.openingFloat} showDrawer={false} />
          {openOrder ? (
            <Text style={styles.warning}>There is an order still open. It will be discarded when the shift closes.</Text>
          ) : null}
        </View>

        <View style={[styles.section, wide && styles.half]}>
          <Text style={text.muted}>Count the cash in the drawer, including the float.</Text>
          <AmountPad label="Cash counted" value={counted} onChange={setCounted} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label="Close shift"
            variant="danger"
            size="xl"
            busy={busy}
            disabled={amount === null}
            onPress={() => void submit()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { padding: 16, gap: 16 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', padding: 24, gap: 24 },
  section: { padding: 16, gap: 12 },
  half: { flex: 1, maxWidth: 460 },
  warning: { color: colors.watch, fontWeight: '600' },
  error: { color: colors.bad, fontWeight: '600' },
});
