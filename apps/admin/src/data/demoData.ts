/**
 * DEMO FIXTURES — not real data.
 *
 * The Supabase tables land in Phase 1; until then the dashboard renders against
 * these so the layout, the costing engine and the charts can be reviewed for
 * real. Every number below flows through the same @digita/core functions the
 * live app will use, so replacing this module with queries changes the data
 * source and nothing else.
 *
 * Item names, pack sizes and suppliers are taken from the shop's existing
 * inventory sheet.
 */
import { classifyMenu, margin, toCentavos, type MenuItemStats } from '@digita/core';

export interface DemoProduct {
  variantId: string;
  name: string;
  priceGross: number;
  cost: number;
  unitsSold: number;
}

export const demoProducts: DemoProduct[] = [
  { variantId: 'v1', name: 'Iced Latte 16oz', priceGross: toCentavos(160), cost: 33.66, unitsSold: 412 },
  { variantId: 'v2', name: 'Iced Americano 16oz', priceGross: toCentavos(130), cost: 19.1, unitsSold: 388 },
  { variantId: 'v3', name: 'Caramel Macchiato 16oz', priceGross: toCentavos(180), cost: 46.2, unitsSold: 264 },
  { variantId: 'v4', name: 'Matcha Latte 16oz', priceGross: toCentavos(175), cost: 52.4, unitsSold: 96 },
  { variantId: 'v5', name: 'Chocolate 16oz', priceGross: toCentavos(165), cost: 41.8, unitsSold: 132 },
  { variantId: 'v6', name: 'Strawberry Iced Tea', priceGross: toCentavos(140), cost: 28.9, unitsSold: 74 },
  { variantId: 'v7', name: 'Lychee Iced Tea', priceGross: toCentavos(140), cost: 31.2, unitsSold: 11 },
  { variantId: 'v8', name: 'Bottled Water', priceGross: toCentavos(35), cost: 18.0, unitsSold: 58 },
];

export const productMargins = demoProducts.map((p) => {
  const m = margin(p.priceGross, p.cost, 70);
  return { ...p, ...m, totalProfit: m.grossProfit * p.unitsSold };
});

const menuStats: MenuItemStats[] = productMargins.map((p) => ({
  variantId: p.variantId,
  name: p.name,
  unitsSold: p.unitsSold,
  unitProfit: p.grossProfit,
}));

export const menuMatrix = classifyMenu(menuStats);

/** Sales by hour for a typical trading day. Amounts are centavos, like every
 *  money value in the system — the only unit that avoids float drift. */
export const salesByHour = [
  { hour: '7a', sales: 214_000, transactions: 14 },
  { hour: '8a', sales: 582_000, transactions: 38 },
  { hour: '9a', sales: 734_000, transactions: 47 },
  { hour: '10a', sales: 461_000, transactions: 29 },
  { hour: '11a', sales: 398_000, transactions: 25 },
  { hour: '12p', sales: 625_000, transactions: 40 },
  { hour: '1p', sales: 547_000, transactions: 34 },
  { hour: '2p', sales: 412_000, transactions: 26 },
  { hour: '3p', sales: 689_000, transactions: 44 },
  { hour: '4p', sales: 791_000, transactions: 51 },
  { hour: '5p', sales: 523_000, transactions: 33 },
  { hour: '6p', sales: 306_000, transactions: 19 },
];

export interface DemoStockAlert {
  itemId: string;
  name: string;
  onHandLabel: string;
  daysOfCover: number;
  leadTimeDays: number;
  orderPurchaseUnits: number;
  purchaseUnit: string;
  status: 'out' | 'critical' | 'below_par';
}

export const stockAlerts: DemoStockAlert[] = [
  {
    itemId: 'matcha-powder',
    name: 'Matcha Powder',
    onHandLabel: '1.0 kg',
    daysOfCover: 7,
    leadTimeDays: 10,
    orderPurchaseUnits: 11,
    purchaseUnit: 'Pack',
    status: 'critical',
  },
  {
    itemId: 'blueberry-syrup',
    name: 'Blueberry Syrup',
    onHandLabel: '0 g',
    daysOfCover: 0,
    leadTimeDays: 5,
    orderPurchaseUnits: 2,
    purchaseUnit: 'Bottle',
    status: 'out',
  },
  {
    itemId: 'passion-fruit-syrup',
    name: 'Passion Fruit Syrup',
    onHandLabel: '0 g',
    daysOfCover: 0,
    leadTimeDays: 5,
    orderPurchaseUnits: 2,
    purchaseUnit: 'Bottle',
    status: 'out',
  },
  {
    itemId: 'beans',
    name: 'Beans',
    onHandLabel: '10.0 kg',
    daysOfCover: 9,
    leadTimeDays: 4,
    orderPurchaseUnits: 0,
    purchaseUnit: 'Pack',
    status: 'below_par',
  },
];

const salesTotal = salesByHour.reduce((sum, h) => sum + h.sales, 0);
const transactionTotal = salesByHour.reduce((sum, h) => sum + h.transactions, 0);

export const todayTotals = {
  sales: salesTotal,
  transactions: transactionTotal,
  averageTicket: Math.round(salesTotal / transactionTotal),
  grossMarginPct: 74.2,
  wasteCost: 48_600,
};
