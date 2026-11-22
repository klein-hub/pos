import { createDemoBackend } from './demo';
import type { PosBackend } from './types';

export type * from './types';

/**
 * The one place the app chooses its data source. Demo until the Supabase
 * backend exists — that needs a sale-recording RPC migration first, because a
 * sale, its stock draws and its tenders must land in a single transaction.
 */
export const backend: PosBackend = createDemoBackend();
