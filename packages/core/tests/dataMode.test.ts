import { describe, expect, it } from '@jest/globals';
import { DATA_MODE_INFO, canSwitchDataMode, resolveInitialMode } from '../src/index.js';

describe('who may switch data mode', () => {
  it('allows a super admin, as named in the JWT', () => {
    expect(canSwitchDataMode({ role: 'super_admin', provider: 'email' })).toBe(true);
  });

  it('tolerates the spacing and casing variants the DB helper normalises', () => {
    expect(canSwitchDataMode({ role: 'Super Admin' })).toBe(true);
    expect(canSwitchDataMode({ user_role: 'SUPER_ADMIN' })).toBe(true);
  });

  it('refuses an ordinary admin', () => {
    // profiles.role = 'admin' is not the same thing, and the database agrees:
    // is_super_admin() reads the JWT, not the profile.
    expect(canSwitchDataMode({ role: 'admin' })).toBe(false);
  });

  it('refuses when there is no metadata at all', () => {
    expect(canSwitchDataMode(undefined)).toBe(false);
    expect(canSwitchDataMode({})).toBe(false);
  });
});

describe('starting mode', () => {
  it('defaults to live', () => {
    expect(resolveInitialMode({ stored: null, canSwitch: true, profileCompanyId: 'c1' })).toBe('live');
  });

  it('honours what a super admin last chose on this device', () => {
    expect(resolveInitialMode({ stored: 'demo', canSwitch: true, profileCompanyId: 'c1' })).toBe('demo');
  });

  it('ignores a stored choice for someone not allowed to switch', () => {
    // Otherwise a demo or offline mode left behind by someone else would
    // strand an ordinary user on data that is not the shop's.
    expect(resolveInitialMode({ stored: 'demo', canSwitch: false, profileCompanyId: 'c1' })).toBe('live');
    expect(resolveInitialMode({ stored: 'local', canSwitch: false, profileCompanyId: 'c1' })).toBe('live');
  });

  it('falls back to the offline sample when the user has no company', () => {
    expect(resolveInitialMode({ stored: null, canSwitch: false, profileCompanyId: null })).toBe('local');
  });
});

describe('mode descriptions', () => {
  it('warns on every mode that is not the real shop', () => {
    expect(DATA_MODE_INFO.live.warning).toBeUndefined();
    expect(DATA_MODE_INFO.demo.warning).toMatch(/not the shop/i);
    expect(DATA_MODE_INFO.local.warning).toMatch(/lost on refresh/i);
  });

  it('marks the one mode that keeps nothing', () => {
    expect(DATA_MODE_INFO.local.persists).toBe(false);
    expect(DATA_MODE_INFO.demo.persists).toBe(true);
    expect(DATA_MODE_INFO.live.persists).toBe(true);
  });
});
