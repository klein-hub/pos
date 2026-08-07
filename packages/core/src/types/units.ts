/**
 * Every inventory item is measured in exactly one base unit. Recipes, stock
 * levels and costs are all expressed in that unit — never in purchase units.
 *
 *   g    weighable solids (beans, powders, syrups sold by mass)
 *   ml   pourables (milk, sauces sold by volume, water)
 *   each countables (cups, lids, straws, tea bags)
 */
export type BaseUnit = 'g' | 'ml' | 'each';

/** Pesos, floating point. Only ever rounded at a display or persistence boundary. */
export type Pesos = number;

/** Integer centavos. Used for anything a customer sees or pays. */
export type Centavos = number;

/**
 * A dosing unit is how staff actually measure at the bar: pumps of syrup,
 * scoops of powder, shots of espresso. Recipes are authored in these and
 * stored in base units, so the model matches real behaviour without giving
 * up gram-level costing.
 */
export interface DosingUnit {
  id: string;
  itemId: string;
  /** 'pump', 'scoop', 'shot', 'bar spoon' */
  name: string;
  /** Base units delivered by one dose. Calibrated, not assumed. */
  baseQtyPerUnit: number;
  isDefault: boolean;
}

/** A quantity as authored in a recipe, before conversion to base units. */
export interface Dose {
  qty: number;
  /** Omitted means the qty is already in the item's base unit. */
  dosingUnitId?: string;
}

export class UnitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitError';
  }
}
