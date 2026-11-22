import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { backend } from '../backend';
import { colors, radius, text } from '../theme';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function TopBar({ title, subtitle, onBack, right }: TopBarProps) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <ChevronLeft size={26} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <View style={styles.titleRow}>
          <Text style={text.heading} numberOfLines={1}>
            {title}
          </Text>
          <DemoBadge />
        </View>
        {subtitle ? (
          <Text style={text.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * Shown on every screen while the till runs on seed data, so nobody mistakes
 * a rehearsal for trading.
 */
export function DemoBadge() {
  if (backend.mode !== 'demo') return null;
  return (
    <View style={styles.badge} accessibilityLabel="Demo data — nothing is saved">
      <Text style={styles.badgeText}>DEMO DATA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { marginLeft: -6 },
  titles: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.watchSoft,
    borderWidth: 1,
    borderColor: '#efd9a8',
  },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: colors.watch },
});
