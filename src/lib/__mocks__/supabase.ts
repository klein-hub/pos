/**
 * Jest manual mock for the Supabase client.
 * Replaces src/lib/supabase.ts in test environments.
 */
import { jest } from '@jest/globals';

const mockChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  order: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
};

export const supabase = {
  rpc: jest.fn(),
  from: jest.fn(() => ({ ...mockChain })),
};
