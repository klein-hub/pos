// Domain types
export * from './types/units.js';
export * from './types/inventory.js';
export * from './types/products.js';
export * from './types/sales.js';

// Costing engine — the numeric heart, shared by the POS and the admin app so
// a margin shown on the tablet and a margin shown on the dashboard cannot disagree.
export * from './costing/units.js';
export * from './costing/batches.js';
export * from './costing/ledger.js';
export * from './costing/recipe.js';
export * from './costing/pricing.js';
export * from './costing/reorder.js';
export * from './costing/menu.js';
export * from './costing/checkout.js';

// Opening price list transcribed from the shop's costing sheets, and the
// starter catalog both apps run on until they read from Supabase
export * from './seed/openingCosts.js';
export * from './seed/catalog.js';

// Where data comes from: the in-memory seed, a demo company, or the live one
export * from './data/dataMode.js';
export * from './data/catalogRepository.js';

// The app launcher: which apps exist, and carrying a session between them
export * from './apps/registry.js';
export * from './apps/handoff.js';
export * from './apps/access.js';

// Utilities
export * from './utils/money.js';

// Data access
export * from './supabase/client.js';
