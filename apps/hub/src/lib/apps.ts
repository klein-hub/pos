import { resolveApps, type AppId } from '@digita/core';

/**
 * Where each app lives in this environment.
 *
 * The defaults are the local dev ports. Setting VITE_APP_<NAME>_URL moves one
 * without touching code, which is what makes splitting these onto their own
 * hosts a deployment change rather than a rewrite.
 */
const overrides: Partial<Record<AppId, string | null>> = {};
const env = import.meta.env;
if (env.VITE_APP_SALES_URL) overrides.sales = env.VITE_APP_SALES_URL;
if (env.VITE_APP_INVENTORY_URL) overrides.inventory = env.VITE_APP_INVENTORY_URL;
if (env.VITE_APP_POS_URL) overrides.pos = env.VITE_APP_POS_URL;
if (env.VITE_APP_PAYROLL_URL) overrides.payroll = env.VITE_APP_PAYROLL_URL;

export const apps = resolveApps(overrides);
