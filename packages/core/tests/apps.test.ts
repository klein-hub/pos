import { describe, expect, it } from '@jest/globals';
import {
  HANDOFF_KEY, appHref, decideAccess, filterAppsByAccess, resolveApps,
  takeHandoffFromUrl, withHandoff,
  type UrlHistory, type UrlLocation,
} from '../src/index.js';

describe('app registry', () => {
  it('offers every app the launcher shows', () => {
    expect(resolveApps().map((a) => a.id)).toEqual([
      'sales', 'inventory', 'pos', 'payroll', 'employee', 'attendance', 'expense',
    ]);
  });

  it('points sales and inventory at the same app but different screens', () => {
    const apps = resolveApps();
    const sales = apps.find((a) => a.id === 'sales')!;
    const inventory = apps.find((a) => a.id === 'inventory')!;
    expect(sales.url).toBe(inventory.url);
    expect(appHref(sales)).toBe('http://localhost:5174/dashboard');
    expect(appHref(inventory)).toBe('http://localhost:5174/inventory');
  });

  it('marks an app with nowhere to point as planned, whatever the catalog says', () => {
    // Otherwise a tile would look clickable and go nowhere.
    const apps = resolveApps({ pos: null });
    expect(apps.find((a) => a.id === 'pos')?.status).toBe('planned');
    expect(appHref(apps.find((a) => a.id === 'pos')!)).toBeNull();
  });

  it('lets a deployment move an app without a code change', () => {
    const apps = resolveApps({ payroll: 'https://payroll.example.com' });
    expect(apps.find((a) => a.id === 'payroll')?.url).toBe('https://payroll.example.com');
  });

  it('leaves the apps that are not built yet without a destination', () => {
    const planned = resolveApps().filter((a) => a.status === 'planned').map((a) => a.id);
    expect(planned).toEqual(['employee', 'attendance', 'expense']);
  });
});

describe('session handoff', () => {
  const session = { access_token: 'acc.ess', refresh_token: 'ref/resh+1' };

  function fakeLocation(hash: string) {
    return { hash, pathname: '/inventory', search: '' } satisfies UrlLocation;
  }
  function fakeHistory() {
    const calls: string[] = [];
    return {
      calls,
      history: { replaceState: (_a: unknown, _b: string, url: string) => { calls.push(url); } } satisfies UrlHistory,
    };
  }

  it('round-trips a session through a URL fragment', () => {
    const href = withHandoff('http://localhost:5174/inventory', session);
    expect(href).toContain(`#${HANDOFF_KEY}=`);

    const { history } = fakeHistory();
    expect(takeHandoffFromUrl(fakeLocation(href.slice(href.indexOf('#'))), history)).toEqual(session);
  });

  it('survives tokens containing URL-significant characters', () => {
    // base64url matters: a raw '+' or '/' in a token would be mangled.
    const href = withHandoff('http://x/y', session);
    expect(href).not.toContain('+');
    const { history } = fakeHistory();
    expect(takeHandoffFromUrl(fakeLocation(href.slice(href.indexOf('#'))), history)?.refresh_token)
      .toBe('ref/resh+1');
  });

  it('strips the token from the address bar so a reload cannot replay it', () => {
    const { calls, history } = fakeHistory();
    takeHandoffFromUrl(fakeLocation(`#${HANDOFF_KEY}=abc`), history);
    expect(calls[0]).toBe('/inventory');
  });

  it('strips a malformed token too, rather than leaving it in the URL', () => {
    const { calls, history } = fakeHistory();
    expect(takeHandoffFromUrl(fakeLocation(`#${HANDOFF_KEY}=not-base64!!`), history)).toBeNull();
    expect(calls[0]).toBe('/inventory');
  });

  it('keeps any other fragment the app was relying on', () => {
    const { calls, history } = fakeHistory();
    takeHandoffFromUrl(fakeLocation(`#tab=stock&${HANDOFF_KEY}=abc`), history);
    expect(calls[0]).toBe('/inventory#tab=stock');
  });

  it('does nothing when there is no session or no fragment', () => {
    expect(withHandoff('http://x/y', null)).toBe('http://x/y');
    const { history } = fakeHistory();
    expect(takeHandoffFromUrl(fakeLocation(''), history)).toBeNull();
  });
});

describe('app access (layers 2 and 3)', () => {
  it('shows only the tiles the user can open', () => {
    const visible = filterAppsByAccess(resolveApps(), ['sales', 'payroll']);
    expect(visible.map((a) => a.id)).toEqual(['sales', 'payroll']);
  });

  it('shows nothing rather than everything when a user has no grants', () => {
    // The dangerous failure mode is treating "empty" as "unrestricted".
    expect(filterAppsByAccess(resolveApps(), [])).toEqual([]);
  });

  it('lets a user into an app they hold', () => {
    expect(decideAccess('inventory', ['sales', 'inventory'])).toEqual({ status: 'granted' });
  });

  it('refuses one they do not, and says where they can go instead', () => {
    expect(decideAccess('inventory', ['sales'])).toEqual({ status: 'denied', granted: ['sales'] });
  });
});
