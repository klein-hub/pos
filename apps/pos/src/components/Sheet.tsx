import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useIsWide } from '../lib/layout';
import { colors, radius, text } from '../theme';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned below the scrolling content — the primary action lives here. */
  footer?: ReactNode;
  /** When the content scrolls itself (a cart), let it own the height. */
  scroll?: boolean;
}

/** A centred dialog on a tablet, a bottom sheet on a phone. */
export function Sheet({ visible, onClose, title, children, footer, scroll = true }: SheetProps) {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <View style={[styles.scrim, wide ? styles.centre : styles.bottom]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.panel,
            wide ? styles.dialog : [styles.drawer, { paddingBottom: Math.max(insets.bottom, 16) }],
          ]}
        >
          <View style={styles.header}>
            <Text style={text.heading} numberOfLines={1}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={22} color={colors.muted} />
            </Pressable>
          </View>
          {scroll ? (
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.bodyContent]}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  bottom: { justifyContent: 'flex-end' },
  panel: { backgroundColor: colors.canvas, overflow: 'hidden' },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '90%', borderRadius: radius.lg },
  drawer: { maxHeight: '92%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { padding: 20, gap: 16 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
