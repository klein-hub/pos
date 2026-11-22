import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CartPanel } from '../components/CartPanel';
import { TopBar } from '../components/TopBar';
import { colors } from '../theme';

/**
 * The order on a phone, where it cannot sit beside the menu. A route rather
 * than a sheet, so the discount sheet it opens is never a modal inside a modal.
 */
export default function Cart() {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <TopBar title="Order" onBack={() => router.back()} />
      <CartPanel onCharge={() => router.push('/checkout')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
});
