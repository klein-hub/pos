/**
 * Prints the in-memory seed catalog as normalised JSON, for comparison against
 * the same catalog read out of the database.
 *
 *   ./scripts/run-ts.sh scripts/dump-seed-catalog.ts
 *
 * Normalised means: addressed by name rather than id (ids differ between the
 * two — slugs here, random uuids there), sorted deterministically, and numbers
 * fixed to a set precision so 36 and 36.0000 compare equal. Anything left in
 * the output is a real difference.
 */
import { buildSeedCatalog } from '../packages/core/src/seed/catalog.js';

declare const process: { stdout: { write(s: string): void } };

const c = buildSeedCatalog();

const itemName = new Map(c.items.map((i) => [i.id, i.name]));
const productName = new Map(c.products.map((p) => [p.id, p.name]));
const variantById = new Map(c.variants.map((v) => [v.id, v]));
const groupById = new Map(c.modifierGroups.map((g) => [g.id, g]));
const modifierById = new Map(c.modifiers.map((m) => [m.id, m]));

const n = (v: number | undefined | null, dp = 4) =>
  v === undefined || v === null ? null : Number(v.toFixed(dp));

/** A recipe owner's stable, human-readable address. */
function ownerKey(l: (typeof c.recipeLines)[number]): string {
  if (l.ownerType === 'variant') {
    const v = variantById.get(l.ownerId);
    return `variant:${productName.get(v?.productId ?? '')}/${v?.size}`;
  }
  if (l.ownerType === 'modifier') {
    const m = modifierById.get(l.ownerId);
    const g = m ? groupById.get(m.groupId) : undefined;
    const owner = g?.productId ? productName.get(g.productId) : '-';
    return `modifier:${owner}/${g?.name}/${m?.name}`;
  }
  return `prep:${itemName.get(l.ownerId)}`;
}

const sorted = <T>(xs: T[], key: (x: T) => string) =>
  [...xs].sort((a, b) => key(a).localeCompare(key(b)));

const out = {
  items: sorted(c.items, (i) => i.name).map((i) => ({
    name: i.name,
    category: i.category,
    itemType: i.itemType,
    baseUnit: i.baseUnit,
    purchaseUnit: i.purchaseUnit,
    packSize: n(i.packSize),
    prepYieldQty: n(i.prepYieldQty),
    unitCost: n(c.unitCosts[i.id], 6),
  })),
  products: sorted(c.products, (p) => p.name).map((p) => ({
    name: p.name,
    category: p.category,
    productType: p.productType,
  })),
  variants: sorted(c.variants, (v) => `${productName.get(v.productId)}/${v.size}`).map((v) => ({
    product: productName.get(v.productId),
    size: v.size,
    sellingPrice: v.sellingPrice,
    targetMarginPct: n(v.targetMarginPct, 2),
  })),
  modifiers: sorted(c.modifiers, (m) => {
    const g = groupById.get(m.groupId);
    return `${g?.productId ? productName.get(g.productId) : '-'}/${g?.name}/${m.name}`;
  }).map((m) => {
    const g = groupById.get(m.groupId);
    return {
      product: g?.productId ? productName.get(g.productId) : null,
      group: g?.name,
      name: m.name,
      priceDelta: m.priceDelta,
    };
  }),
  recipeLines: sorted(c.recipeLines, (l) => `${ownerKey(l)}|${itemName.get(l.itemId)}`).map((l) => ({
    owner: ownerKey(l),
    item: itemName.get(l.itemId),
    qty: n(l.dose.qty),
  })),
};

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
