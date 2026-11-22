import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, numeric, radius, text } from '../theme';
import { applyAmountKey, Keypad } from './Keypad';

interface AmountPadProps {
  label: string;
  /** The amount as typed, in pesos: "300", "257.14". */
  value: string;
  onChange: (value: string) => void;
  /** One-tap amounts: exact change, the next notes up, a usual float. */
  quick?: { label: string; value: string }[];
  keyHeight?: number;
}

export function AmountPad({ label, value, onChange, quick, keyHeight }: AmountPadProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.display}>
        <Text style={text.label}>{label}</Text>
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
          ₱{value === '' ? '0' : formatTyped(value)}
        </Text>
      </View>
      {quick && quick.length > 0 ? (
        <View style={styles.quick}>
          {quick.map((q) => (
            <Pressable
              key={q.label}
              accessibilityRole="button"
              onPress={() => onChange(q.value)}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipText}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Keypad
        extraKey="."
        keyHeight={keyHeight}
        onKey={(k) => onChange(applyAmountKey(value, k))}
        onBackspace={() => onChange(value.slice(0, -1))}
      />
    </View>
  );
}

/** Thousands separators on the whole part while typing, without touching the decimals. */
function formatTyped(value: string): string {
  const [whole = '0', frac] = value.split('.');
  const grouped = Number(whole).toLocaleString('en-PH');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  display: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amount: { fontSize: 36, fontWeight: '800', color: colors.text, ...numeric },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLine,
  },
  chipPressed: { backgroundColor: colors.primaryLine },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.primary, ...numeric },
});
