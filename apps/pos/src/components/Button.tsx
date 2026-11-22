import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'xl';

interface ButtonProps {
  /** Empty for an icon-only button, which then needs accessibilityLabel. */
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  busy?: boolean;
  icon?: ComponentType<{ size?: number; color?: string }>;
  style?: StyleProp<ViewStyle>;
}

/** Touch targets sized for a busy counter: the smallest is still 44pt tall. */
export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  busy,
  icon: Icon,
  style,
}: ButtonProps) {
  const inactive = disabled || busy;
  const fg = FOREGROUND[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        SIZES[size],
        BACKGROUND[variant](pressed),
        inactive && styles.inactive,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={size === 'md' ? 18 : 20} color={fg} /> : null}
          {label ? (
            <Text style={[styles.label, { color: fg, fontSize: size === 'xl' ? 19 : size === 'lg' ? 17 : 15 }]}>
              {label}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const FOREGROUND: Record<Variant, string> = {
  primary: colors.onPrimary,
  secondary: colors.primary,
  ghost: colors.muted,
  danger: colors.onPrimary,
};

const BACKGROUND: Record<Variant, (pressed: boolean) => ViewStyle> = {
  primary: (p) => ({ backgroundColor: p ? colors.primaryPressed : colors.primary }),
  secondary: (p) => ({
    backgroundColor: p ? colors.primaryLine : colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryLine,
  }),
  ghost: (p) => ({ backgroundColor: p ? colors.sunken : 'transparent' }),
  danger: (p) => ({ backgroundColor: p ? '#9b2c2c' : colors.bad }),
};

const SIZES: Record<Size, ViewStyle> = {
  md: { minHeight: 44, paddingHorizontal: 14 },
  lg: { minHeight: 52, paddingHorizontal: 18 },
  xl: { minHeight: 64, paddingHorizontal: 22 },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
  },
  label: { fontWeight: '700' },
  inactive: { opacity: 0.45 },
});
