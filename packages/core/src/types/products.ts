import type { Centavos } from './units.js';
import type { Dose } from './units.js';

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: string;
  productType: 'composite' | 'resale';
  imageUrl?: string;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  productId: string;
  /** '12oz', '16oz', '22oz', or 'Regular' for single-size products. */
  size: string;
  /** VAT-inclusive, as shown on the menu board. */
  sellingPrice: Centavos;
  sku?: string;
  /** Warn when realised margin falls below this. */
  targetMarginPct?: number;
  isActive: boolean;
}

/**
 * Recipes are owned by a variant (the drink), a modifier (the add-on) or a
 * sub-assembly item (the prep batch). All three roll up the same way.
 */
export type RecipeOwnerType = 'variant' | 'modifier' | 'prep';

/**
 * One line of a recipe. Always points at an inventory item — a sub-assembly
 * such as brewed espresso *is* an inventory item, so nesting needs no special
 * case beyond recursion.
 */
export interface RecipeLine {
  id: string;
  ownerId: string;
  ownerType: RecipeOwnerType;
  itemId: string;
  dose: Dose;
}

export interface ModifierGroup {
  id: string;
  productId?: string;
  name: string;
  minSelect: number;
  maxSelect: number;
}

export interface Modifier {
  id: string;
  groupId: string;
  name: string;
  /** Added to the variant's VAT-inclusive price. May be negative. */
  priceDelta: Centavos;
  isActive: boolean;
}
