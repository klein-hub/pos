import {
  openingCosts,
  unitCostOf,
  type InventoryItem,
  type Product,
  type ProductVariant,
  type RecipeLine,
} from '@digita/core';
import { toCentavos } from '@digita/core';

/**
 * The catalog the recipe builder starts from.
 *
 * Ingredient costs are the shop's real price list. The RECIPES are starter
 * assumptions — plausible builds for a Philippine café, not the shop's actual
 * ones — and the UI says so, because a recipe nobody has confirmed produces a
 * cost nobody should trust. The two batch items (cheesecake, mango float) are
 * the exception: those come straight off the costing sheets.
 *
 * Replaced wholesale by Supabase queries in Phase 1. The shapes are the core
 * domain types already, so the swap touches this file and the store, nothing else.
 */

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

interface SubAssemblySpec {
  name: string;
  baseUnit: InventoryItem['baseUnit'];
  /** Base units produced by one run of the prep recipe. */
  prepYieldQty: number;
  lines: [item: string, qty: number][];
  note: string;
}

const subAssemblies: SubAssemblySpec[] = [
  {
    name: 'Espresso',
    baseUnit: 'ml',
    prepYieldQty: 36,
    lines: [['Benguet Arabica Beans', 18]],
    note: 'An 18g dose pulling a 36ml double. Adjust the dose to your actual recipe.',
  },
  {
    name: 'Cheesecake',
    baseUnit: 'each',
    prepYieldQty: 12,
    lines: [
      ['Cream Cheese', 1250],
      ['Refined Sugar', 675],
      ['Flour', 47],
      ['Whipped Cream (Bakery)', 150],
      ['Egg', 6],
      ['Crushed Graham', 300],
      ['Salted Butter', 150],
    ],
    note: 'From your costing sheet, with the egg row corrected from ₱0.02 to ₱42.00.',
  },
  {
    name: 'Mango Float',
    baseUnit: 'each',
    prepYieldQty: 15,
    lines: [
      ['All Purpose Cream', 2],
      ['Condensed Milk', 1],
      ['Mango', 2],
      ['Crushed Graham', 625],
    ],
    note: 'From your costing sheet — ₱478 for 15 servings, ₱31.87 each.',
  },
];

interface ProductSpec {
  name: string;
  category: string;
  productType: Product['productType'];
  variants: {
    size: string;
    price: number;
    lines: [item: string, qty: number][];
  }[];
}

const productSpecs: ProductSpec[] = [
  {
    name: 'Iced Latte',
    category: 'Espresso',
    productType: 'composite',
    variants: [
      { size: '12oz', price: 130, lines: [['Espresso', 36], ['Fresh Milk', 120], ['12 Oz Cup', 1]] },
      { size: '16oz', price: 160, lines: [['Espresso', 36], ['Fresh Milk', 180], ['16 Oz Cup', 1]] },
      { size: '22oz', price: 190, lines: [['Espresso', 54], ['Fresh Milk', 260], ['22 Oz Cup', 1]] },
    ],
  },
  {
    name: 'Iced Americano',
    category: 'Espresso',
    productType: 'composite',
    variants: [
      { size: '16oz', price: 130, lines: [['Espresso', 36], ['16 Oz Cup', 1]] },
      { size: '22oz', price: 155, lines: [['Espresso', 54], ['22 Oz Cup', 1]] },
    ],
  },
  {
    name: 'Caramel Macchiato',
    category: 'Espresso',
    productType: 'composite',
    variants: [
      {
        size: '16oz',
        price: 180,
        lines: [['Espresso', 36], ['Fresh Milk', 170], ['Caramel Sauce', 30], ['16 Oz Cup', 1]],
      },
    ],
  },
  {
    name: 'White Chocolate Mocha',
    category: 'Espresso',
    productType: 'composite',
    variants: [
      {
        size: '16oz',
        price: 185,
        lines: [['Espresso', 36], ['Fresh Milk', 170], ['White Chocolate Syrup', 30], ['16 Oz Cup', 1]],
      },
    ],
  },
  {
    name: 'Matcha Latte',
    category: 'Non-coffee',
    productType: 'composite',
    variants: [
      {
        size: '16oz',
        price: 175,
        lines: [['Catcher Matcha Powder', 12], ['Fresh Milk', 200], ['White Sugar', 10], ['16 Oz Cup', 1]],
      },
    ],
  },
  {
    name: 'Chocolate',
    category: 'Non-coffee',
    productType: 'composite',
    variants: [
      {
        size: '16oz',
        price: 165,
        lines: [['Catcher Choco Powder', 25], ['Fresh Milk', 200], ['16 Oz Cup', 1]],
      },
    ],
  },
  {
    name: 'Strawberry Iced Tea',
    category: 'Tea',
    productType: 'composite',
    variants: [
      {
        size: '16oz',
        price: 140,
        lines: [['Strawberry Syrup (Easy)', 40], ['Lemon', 10], ['16 Oz Cup', 1]],
      },
    ],
  },
  {
    name: 'Lychee Iced Tea',
    category: 'Tea',
    productType: 'composite',
    variants: [
      {
        size: '16oz',
        price: 140,
        lines: [['Lychee Syrup (Milin)', 40], ['Lemon', 10], ['16 Oz Cup', 1]],
      },
    ],
  },
  {
    name: 'Cheesecake Slice',
    category: 'Food',
    productType: 'composite',
    variants: [
      {
        size: 'Slice',
        price: 150,
        lines: [['Cheesecake', 1], ['Hamburger Box', 1], ['Wooden Fork', 1]],
      },
    ],
  },
  {
    name: 'Mango Float',
    category: 'Food',
    productType: 'composite',
    variants: [
      {
        size: 'Cup',
        price: 95,
        lines: [['Mango Float', 1], ['Plastic Cup Transparent', 1], ['Wooden Spoon', 1]],
      },
    ],
  },
];

/** Units of trailing-4-week volume, used by the menu engineering matrix. */
export const seedVolumes: Record<string, number> = {
  'iced-latte-16oz': 412,
  'iced-latte-12oz': 168,
  'iced-latte-22oz': 96,
  'iced-americano-16oz': 388,
  'iced-americano-22oz': 74,
  'caramel-macchiato-16oz': 264,
  'white-chocolate-mocha-16oz': 118,
  'matcha-latte-16oz': 96,
  'chocolate-16oz': 132,
  'strawberry-iced-tea-16oz': 74,
  'lychee-iced-tea-16oz': 11,
  'cheesecake-slice-slice': 86,
  'mango-float-cup': 143,
};

export interface SeedCatalog {
  items: InventoryItem[];
  unitCosts: Record<string, number>;
  products: Product[];
  variants: ProductVariant[];
  recipeLines: RecipeLine[];
  /** Prep-item ids keyed by name, so the UI can label a nested cost. */
  notes: Record<string, string>;
}

export function buildSeedCatalog(): SeedCatalog {
  const items: InventoryItem[] = [];
  const unitCosts: Record<string, number> = {};
  const notes: Record<string, string> = {};

  for (const seed of openingCosts) {
    const id = slug(seed.name);
    items.push({
      id,
      companyId: 'seed',
      locationId: 'seed',
      name: seed.name,
      category: seed.category,
      itemType: 'raw_material',
      baseUnit: seed.baseUnit,
      purchaseUnit: seed.purchaseUnit,
      packSize: seed.packSize,
      yieldPct: 1,
      reorderPoint: 0,
      parLevel: 0,
      isSeasonal: false,
    });
    unitCosts[id] = unitCostOf(seed);
    if (seed.note) notes[id] = seed.note;
  }

  const recipeLines: RecipeLine[] = [];
  const addLines = (
    ownerId: string,
    ownerType: RecipeLine['ownerType'],
    lines: [string, number][],
  ) => {
    for (const [itemName, qty] of lines) {
      recipeLines.push({
        id: `${ownerId}:${slug(itemName)}`,
        ownerId,
        ownerType,
        itemId: slug(itemName),
        dose: { qty },
      });
    }
  };

  for (const sub of subAssemblies) {
    const id = slug(sub.name);
    items.push({
      id,
      companyId: 'seed',
      locationId: 'seed',
      name: sub.name,
      category: 'Prep',
      itemType: 'sub_assembly',
      baseUnit: sub.baseUnit,
      purchaseUnit: 'Batch',
      packSize: sub.prepYieldQty,
      yieldPct: 1,
      reorderPoint: 0,
      parLevel: 0,
      isSeasonal: false,
      prepYieldQty: sub.prepYieldQty,
    });
    notes[id] = sub.note;
    addLines(id, 'prep', sub.lines);
  }

  const products: Product[] = [];
  const variants: ProductVariant[] = [];

  for (const spec of productSpecs) {
    const productId = slug(spec.name);
    products.push({
      id: productId,
      companyId: 'seed',
      name: spec.name,
      category: spec.category,
      productType: spec.productType,
      isActive: true,
    });

    for (const v of spec.variants) {
      const variantId = `${productId}-${slug(v.size)}`;
      variants.push({
        id: variantId,
        productId,
        size: v.size,
        sellingPrice: toCentavos(v.price),
        targetMarginPct: 70,
        isActive: true,
      });
      addLines(variantId, 'variant', v.lines);
    }
  }

  return { items, unitCosts, products, variants, recipeLines, notes };
}
