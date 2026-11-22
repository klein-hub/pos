import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { colors, numeric, radius } from '../theme';

interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** At 0 the minus button becomes a remove button. */
  min?: 0 | 1;
  max?: number;
  large?: boolean;
}

export function QtyStepper({ value, onChange, min = 0, max = 99, large }: QtyStepperProps) {
  const size = large ? 52 : 40;
  const removes = min === 0 && value <= 1;
  const MinusIcon = removes ? Trash2 : Minus;

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={removes ? 'Remove' : 'Decrease quantity'}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={({ pressed }) => [styles.btn, { width: size, height: size }, pressed && styles.pressed, value <= min && styles.off]}
      >
        <MinusIcon size={large ? 20 : 17} color={removes ? colors.bad : colors.text} />
      </Pressable>
      <Text style={[styles.value, large && styles.valueLarge]} accessibilityLabel={`Quantity ${value}`}>
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={({ pressed }) => [styles.btn, { width: size, height: size }, pressed && styles.pressed, value >= max && styles.off]}
      >
        <Plus size={large ? 20 : 17} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.sunken },
  off: { opacity: 0.4 },
  value: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text, ...numeric },
  valueLarge: { minWidth: 36, fontSize: 20 },
});
