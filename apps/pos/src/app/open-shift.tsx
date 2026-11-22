import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lock } from 'lucide-react-native';
import { AmountPad } from '../components/AmountPad';
import { Button } from '../components/Button';
import { TopBar } from '../components/TopBar';
import { parsePesos } from '../lib/format';
import { useSessionStore } from '../store/session';
import { useCatalog } from '../store/shop';
import { colors, text } from '../theme';

/**
 * The opening float is what the drawer starts with. It is the baseline the
 * close-of-shift count is measured against, so it is counted, not assumed.
 */
export default function OpenShift() {
  const { shop } = useCatalog();
  const cashier = useSessionStore((s) => s.cashier);
  const openShift = useSessionStore((s) => s.openShift);
  const lock = useSessionStore((s) => s.lock);

  const [float, setFloat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = parsePesos(float);

  const open = async () => {
    if (amount === null) return;
    setBusy(true);
    setError(null);
    try {
      await openShift(amount);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar
        title={shop.companyName}
        subtitle={shop.locationName}
        right={<Button label={cashier?.name ?? 'Lock'} icon={Lock} variant="ghost" onPress={lock} />}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.column}>
          <View style={styles.intro}>
            <Text style={text.title}>Open a shift</Text>
            <Text style={text.muted}>Count the cash in the drawer before the first sale.</Text>
          </View>
          <AmountPad
            label="Opening float"
            value={float}
            onChange={setFloat}
            quick={[
              { label: '₱500', value: '500' },
              { label: '₱1,000', value: '1000' },
              { label: '₱2,000', value: '2000' },
            ]}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Open shift" size="xl" busy={busy} disabled={amount === null} onPress={() => void open()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  body: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  column: { width: '100%', maxWidth: 400, gap: 16 },
  intro: { gap: 4 },
  error: { color: colors.bad, fontWeight: '600' },
});
