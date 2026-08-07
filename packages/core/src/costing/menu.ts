import type { Pesos } from '../types/units.js';

/**
 * Classic menu-engineering quadrants. Popularity is measured against an even
 * share of sales, so a menu of 20 items has an expected 5% share each; the
 * conventional cut-off is 70% of that expected share.
 */
export type MenuQuadrant = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface MenuItemStats {
  variantId: string;
  name: string;
  unitsSold: number;
  /** Peso profit per unit, VAT-exclusive. */
  unitProfit: Pesos;
}

export interface MenuClassification extends MenuItemStats {
  quadrant: MenuQuadrant;
  popularityShare: number;
  totalProfit: Pesos;
  advice: string;
}

const POPULARITY_THRESHOLD = 0.7;

export function classifyMenu(items: readonly MenuItemStats[]): MenuClassification[] {
  if (items.length === 0) return [];

  const totalUnits = items.reduce((sum, i) => sum + i.unitsSold, 0);
  const expectedShare = 1 / items.length;
  const popularityCutoff = expectedShare * POPULARITY_THRESHOLD;

  // Profit cut-off is the sales-weighted average unit profit: the yardstick is
  // what the menu actually earns per drink, not an unweighted mean that a
  // never-ordered item could skew.
  const weightedProfit =
    totalUnits > 0
      ? items.reduce((sum, i) => sum + i.unitProfit * i.unitsSold, 0) / totalUnits
      : 0;

  return items.map((item) => {
    const popularityShare = totalUnits > 0 ? item.unitsSold / totalUnits : 0;
    const popular = popularityShare >= popularityCutoff;
    const profitable = item.unitProfit >= weightedProfit;

    const quadrant: MenuQuadrant = popular
      ? profitable
        ? 'star'
        : 'plowhorse'
      : profitable
        ? 'puzzle'
        : 'dog';

    return {
      ...item,
      quadrant,
      popularityShare,
      totalProfit: item.unitProfit * item.unitsSold,
      advice: ADVICE[quadrant],
    };
  });
}

const ADVICE: Record<MenuQuadrant, string> = {
  star: 'Popular and profitable. Protect the recipe and keep it prominent.',
  plowhorse: 'Sells well but earns little. Trim cost or nudge the price — small changes compound here.',
  puzzle: 'Profitable but overlooked. Reposition, rename, or push it at the counter.',
  dog: 'Neither popular nor profitable. A candidate to cut — it still ties up stock and shelf life.',
};
