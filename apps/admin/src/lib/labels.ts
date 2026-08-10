/**
 * A size suffix only earns its place when there is something to distinguish.
 * Appending it unconditionally gives "Cheesecake Slice Slice" and
 * "Mango Float Cup" — noise that makes every list harder to scan.
 */
export function variantLabel(productName: string, size: string, siblingCount: number): string {
  return siblingCount > 1 ? `${productName} ${size}` : productName;
}
