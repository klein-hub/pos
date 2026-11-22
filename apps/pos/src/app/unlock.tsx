import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Keypad } from '../components/Keypad';
import { ShiftReport } from '../components/ShiftReport';
import { DemoBadge } from '../components/TopBar';
import { backend } from '../backend';
import { DEMO_PINS } from '../backend/demo';
import { formatTime } from '../lib/format';
import { useSessionStore } from '../store/session';
import { useShopStore } from '../store/shop';
import { colors, radius, text } from '../theme';

/** pos_set_cashier_pin() accepts 4 to 8 digits. */
const MIN_PIN = 4;
const MAX_PIN = 8;

/**
 * Per-staff PIN on a shared till. Every sale is attributed to whoever unlocked
 * it, which is what makes a cashier-level sales report mean anything.
 */
export default function Unlock() {
  const status = useShopStore((s) => s.status);
  const loadError = useShopStore((s) => s.error);
  const shop = useShopStore((s) => s.catalog?.shop);
  const unlock = useSessionStore((s) => s.unlock);
  const shiftOpen = useSessionStore((s) => s.shift !== null);
  const lastClose = useSessionStore((s) => s.lastClose);
  const dismissLastClose = useSessionStore((s) => s.dismissLastClose);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (pin.length < MIN_PIN || checking) return;
    setChecking(true);
    setError(null);
    try {
      const ok = await unlock(pin);
      if (!ok) {
        setError('PIN not recognised. Try again.');
        setPin('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.column}>
        <View style={styles.brand}>
          <Text style={styles.shop}>{shop?.companyName ?? 'Digita POS'}</Text>
          <View style={styles.brandRow}>
            <Text style={text.muted}>{shop ? `${shop.locationName} · ` : ''}{shiftOpen ? 'Shift open' : 'No shift open'}</Text>
            <DemoBadge />
          </View>
        </View>

        {lastClose ? (
          <View style={styles.closed}>
            <Text style={text.heading}>Shift closed at {formatTime(lastClose.closedAt)}</Text>
            <ShiftReport summary={lastClose.summary} openingFloat={lastClose.openingFloat} showDrawer />
            <Button label="Done" variant="secondary" onPress={dismissLastClose} />
          </View>
        ) : status === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>The menu could not be loaded</Text>
            <Text style={text.muted}>{loadError}</Text>
          </View>
        ) : status !== 'ready' ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <>
            <Text style={text.heading}>Enter your PIN</Text>
            <View style={styles.dots} accessibilityLabel={`${pin.length} digits entered`}>
              {Array.from({ length: Math.max(MIN_PIN, pin.length) }, (_, i) => (
                <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
              ))}
            </View>
            <Text style={[styles.message, error ? styles.messageError : null]}>
              {error ?? (backend.mode === 'demo' ? `Demo PINs: ${DEMO_PINS.join(' or ')}` : ' ')}
            </Text>

            <Keypad
              keyHeight={68}
              onKey={(k) => {
                setError(null);
                setPin((p) => (p.length < MAX_PIN ? p + k : p));
              }}
              onBackspace={() => setPin((p) => p.slice(0, -1))}
            />
            <Button
              label="Unlock"
              size="xl"
              busy={checking}
              disabled={pin.length < MIN_PIN}
              onPress={() => void submit()}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  column: { width: '100%', maxWidth: 380, padding: 24, gap: 18 },
  brand: { alignItems: 'center', gap: 6, marginBottom: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shop: { fontSize: 28, fontWeight: '800', color: colors.primary },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, minHeight: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.faint },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  message: { ...text.muted, textAlign: 'center', minHeight: 20 },
  messageError: { color: colors.bad, fontWeight: '600' },
  closed: {
    padding: 18,
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBox: { padding: 16, gap: 6, borderRadius: radius.md, backgroundColor: colors.badSoft },
  errorTitle: { ...text.heading, color: colors.bad },
});
