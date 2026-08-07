// Domain types
export * from './types/units.js';
export * from './types/inventory.js';
export * from './types/products.js';
export * from './types/sales.js';

// Costing engine — the numeric heart, shared by the POS and the admin app so
// a margin shown on the tablet and a margin shown on the dashboard cannot disagree.
export * from './costing/units.js';
export * from './costing/batches.js';
export * from './costing/recipe.js';
export * from './costing/pricing.js';
export * from './costing/reorder.js';
export * from './costing/menu.js';

// Utilities
export * from './utils/money.js';

// Data access
export * from './supabase/client.js';
