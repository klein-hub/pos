import { useWindowDimensions } from 'react-native';

/**
 * Tablet layout — menu and order side by side — from this width up. Below it
 * the order moves into a sheet so a phone still works as a till.
 */
export const WIDE_BREAKPOINT = 768;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
