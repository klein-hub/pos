import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Grid3x3 } from 'lucide-react-native';
import { colors, radius } from '../theme';

/**
 * Returns to the Digita app launcher.
 *
 * Web only, and deliberately so: the launcher is a web page, and on a tablet
 * running the real till there is nothing to go back to — the POS is the whole
 * app. Rendering nothing on native is the correct behaviour, not a gap.
 */
const HUB_URL = process.env.EXPO_PUBLIC_HUB_URL ?? 'http://localhost:5175';

export function BackToHub() {
  if (Platform.OS !== 'web') return null;

  return (
    <Pressable
      onPress={() => {
        // location exists here because this branch only runs on web.
        window.location.href = HUB_URL;
      }}
      accessibilityRole="button"
      accessibilityLabel="Back to all apps"
      style={styles.button}
      hitSlop={8}
    >
      <Grid3x3 size={16} color={colors.text} />
      <Text style={styles.label}>Apps</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  label: { color: colors.text, fontSize: 13, fontWeight: '600' },
});
