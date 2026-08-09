import type { BaseUnit } from '../types/units.js';

/**
 * Opening price list, transcribed from the shop's costing sheets (Aug 2026).
 *
 * This is the starting point only. Once Receive Stock is live, cost comes from
 * actual batches and this file stops being consulted — it exists so the system
 * has real numbers on day one instead of zeros.
 *
 * Transcription notes:
 *  - Prices are per PACK, not per base unit. Per-unit cost is derived, never
 *    stored, because storing a rounded per-unit price is what made the source
 *    sheet understate milk by 2.8% and sugar by 3.9%.
 *  - Where the two sheets disagreed, the newer one wins. The older sheet had
 *    sugar at 100.25/100g (PHP 1,002.50/kg); the newer has PHP 104/kg. The
 *    older figure was a qty typo and is not carried over.
 */
export interface OpeningCost {
  name: string;
  category: string;
  baseUnit: BaseUnit;
  purchaseUnit: string;
  /** Base units in one purchase unit. */
  packSize: number;
  /** Pesos for one purchase unit. */
  packPrice: number;
  note?: string;
}

export const openingCosts: OpeningCost[] = [
  // --- Coffee ---
  {
    name: 'Benguet Arabica Beans',
    category: 'Coffee',
    baseUnit: 'g',
    purchaseUnit: 'Pack',
    packSize: 1000,
    packPrice: 566,
    note: 'Sheet price included the delivery fee. Split the bean price from the fee when receiving, so per-gram cost falls on larger orders.',
  },

  // --- Dairy ---
  { name: 'Fresh Milk', category: 'Dairy', baseUnit: 'ml', purchaseUnit: 'Pack', packSize: 1000, packPrice: 72 },
  { name: 'Whipping Cream', category: 'Dairy', baseUnit: 'ml', purchaseUnit: 'Pack', packSize: 1000, packPrice: 225 },
  { name: 'Easy Cream Base', category: 'Dairy', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 235 },
  { name: 'All Purpose Cream', category: 'Dairy', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 1, packPrice: 64 },
  { name: 'Condensed Milk', category: 'Dairy', baseUnit: 'each', purchaseUnit: 'Can', packSize: 1, packPrice: 50 },

  // --- Sauces & powders ---
  {
    name: 'Chocolate Sauce',
    category: 'Sauces',
    baseUnit: 'ml',
    purchaseUnit: 'Bottle',
    packSize: 475.25,
    packPrice: 250,
    note: 'Duplicate of Catcher Choco Sauce at a 32% higher per-ml cost. Pick one before building recipes.',
  },
  { name: 'Caramel Sauce', category: 'Sauces', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 475.25, packPrice: 250 },
  { name: 'Catcher Choco Sauce', category: 'Sauces', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2000, packPrice: 799 },
  { name: 'Catcher Choco Powder', category: 'Powders', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 790 },
  { name: 'Catcher Matcha Powder', category: 'Powders', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 850 },
  { name: 'Chocolate Chip', category: 'Powders', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 295 },

  // --- Syrups ---
  { name: 'White Chocolate Syrup', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2500, packPrice: 330 },
  { name: 'Strawberry Syrup (Easy)', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2500, packPrice: 352 },
  { name: 'Blueberry Syrup (Milin)', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2500, packPrice: 255 },
  { name: 'Green Apple Syrup (Milin)', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2500, packPrice: 255 },
  { name: 'Passion Fruit Syrup (Milin)', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2500, packPrice: 255 },
  { name: 'Lychee Syrup (Milin)', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 2500, packPrice: 255 },
  { name: 'Lemon', category: 'Syrups', baseUnit: 'ml', purchaseUnit: 'Bottle', packSize: 210, packPrice: 100 },

  // --- Bakery ---
  { name: 'Cream Cheese', category: 'Bakery', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 535 },
  { name: 'Refined Sugar', category: 'Bakery', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 115 },
  { name: 'White Sugar', category: 'Bakery', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 104 },
  { name: 'Flour', category: 'Bakery', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 4000, packPrice: 377 },
  { name: 'Crushed Graham', category: 'Bakery', baseUnit: 'g', purchaseUnit: 'Pack', packSize: 1000, packPrice: 240 },
  {
    name: 'Whipped Cream (Bakery)',
    category: 'Bakery',
    baseUnit: 'g',
    purchaseUnit: 'Pack',
    packSize: 1000,
    packPrice: 245,
    note: 'May be the same product as Whipping Cream (PHP 0.225/ml) under a different name. They differ by 9% — confirm before deduping.',
  },
  { name: 'Salted Butter', category: 'Bakery', baseUnit: 'g', purchaseUnit: 'Bar', packSize: 227, packPrice: 159 },
  {
    name: 'Egg',
    category: 'Bakery',
    baseUnit: 'each',
    purchaseUnit: 'Piece',
    packSize: 1,
    packPrice: 7,
    note: 'Sheet mixed units — priced per piece but measured in grams, which produced a PHP 0.02 line where PHP 42.00 belonged. Counted as "each" here.',
  },
  { name: 'Mango', category: 'Bakery', baseUnit: 'each', purchaseUnit: 'Piece', packSize: 1, packPrice: 75 },

  // --- Packaging ---
  { name: '12 Oz Cup', category: 'Packaging', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 100, packPrice: 140 },
  {
    name: '16 Oz Cup',
    category: 'Packaging',
    baseUnit: 'each',
    purchaseUnit: 'Pack',
    packSize: 100,
    packPrice: 255,
    note: 'Rose 50% between the two sheets (PHP 1.70 -> PHP 2.55 each).',
  },
  {
    name: '22 Oz Cup',
    category: 'Packaging',
    baseUnit: 'each',
    purchaseUnit: 'Pack',
    packSize: 100,
    packPrice: 321,
    note: 'Rose 46% between the two sheets (PHP 2.20 -> PHP 3.21 each).',
  },
  { name: 'Plastic Cup Transparent', category: 'Packaging', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 50, packPrice: 18 },
  { name: 'Wooden Spoon', category: 'Packaging', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 25, packPrice: 22 },
  { name: 'Wooden Fork', category: 'Packaging', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 25, packPrice: 22 },
  { name: 'Hamburger Box', category: 'Packaging', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 25, packPrice: 65 },
  { name: 'Spaghetti Lunch Box', category: 'Packaging', baseUnit: 'each', purchaseUnit: 'Pack', packSize: 25, packPrice: 60 },
];

/**
 * Still missing from every sheet, and each one costs real money per drink:
 * lids, straws, ice, filtered water, tea, cup sleeves, oat/almond milk.
 * Recipes referencing them will warn until they are priced.
 */
export const missingItems = [
  'Lids (12/16/22oz)',
  'Straws',
  'Ice',
  'Filtered water',
  'Tea leaves or bags',
  'Cup sleeves',
  'Oat / almond milk',
];

/** Derived, never stored — full precision, rounded only for display. */
export function unitCostOf(item: OpeningCost): number {
  return item.packPrice / item.packSize;
}

export function openingCostMap(): Record<string, number> {
  return Object.fromEntries(openingCosts.map((i) => [i.name, unitCostOf(i)]));
}
