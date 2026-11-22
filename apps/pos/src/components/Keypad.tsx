import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { colors, numeric, radius } from '../theme';

interface KeypadProps {
  onKey: (key: string) => void;
  onBackspace: () => void;
  /** '.' for amounts; omitted for PINs, which are digits only. */
  extraKey?: '.';
  keyHeight?: number;
}

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

/** One keypad for PINs, floats, tendered cash and the drawer count. */
export function Keypad({ onKey, onBackspace, extraKey, keyHeight = 60 }: KeypadProps) {
  const key = (label: string) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => onKey(label)}
      style={({ pressed }) => [styles.key, { height: keyHeight }, pressed && styles.pressed]}
    >
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.grid}>
      {ROWS.map((row) => (
        <View key={row.join('')} style={styles.row}>
          {row.map(key)}
        </View>
      ))}
      <View style={styles.row}>
        {extraKey ? key(extraKey) : <View style={[styles.key, styles.blank, { height: keyHeight }]} />}
        {key('0')}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Backspace"
          onPress={onBackspace}
          style={({ pressed }) => [styles.key, { height: keyHeight }, pressed && styles.pressed]}
        >
          <Delete size={24} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Applies a keypad press to an amount typed as text. Keeps it a valid peso
 * amount at every step: one decimal point, two decimals, no leading zeros.
 */
export function applyAmountKey(current: string, key: string, maxWholeDigits = 7): string {
  if (key === '.') {
    if (current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }
  const [whole = '', frac] = current.split('.');
  if (frac !== undefined) return frac.length >= 2 ? current : current + key;
  if (whole === '0') return key;
  return whole.length >= maxWholeDigits ? current : current + key;
}

const styles = StyleSheet.create({
  grid: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blank: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pressed: { backgroundColor: colors.primarySoft, borderColor: colors.primaryLine },
  keyText: { fontSize: 24, fontWeight: '600', color: colors.text, ...numeric },
});
