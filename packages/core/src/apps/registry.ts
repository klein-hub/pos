/**
 * The apps the launcher offers, and where they live.
 *
 * One definition shared by the hub that links out and by the apps that link
 * back, so the two cannot disagree about what an app is called or where it is.
 *
 * URLs are per-environment. Today every app runs on localhost on its own port;
 * the plan is to split them onto their own hosts, which is why nothing here
 * hardcodes a port at the point of use — `resolveAppUrls` takes overrides.
 */
export type AppId =
  | 'sales'
  | 'inventory'
  | 'pos'
  | 'payroll'
  | 'employee'
  | 'attendance'
  | 'expense';

export type AppStatus = 'ready' | 'planned';

export interface LaunchableApp {
  id: AppId;
  name: string;
  /** One line, shown under the tile name on hover and in the list view. */
  summary: string;
  /** lucide-react icon name; the UI maps it to a component. */
  icon: string;
  /** Tile colour, as a theme-independent hex. */
  colour: string;
  status: AppStatus;
  /** Where it runs. Null until the app exists. */
  url: string | null;
  /**
   * Sales and Inventory are two doors into the same admin app today. The path
   * sends each tile to its own screen, and keeping them separate here means
   * splitting them into their own deployments later changes a URL, not the UI.
   */
  path?: string;
}

const DEFAULT_URLS: Record<AppId, string | null> = {
  sales: 'http://localhost:5174',
  inventory: 'http://localhost:5174',
  pos: 'http://localhost:8081',
  payroll: 'http://localhost:5173',
  employee: null,
  attendance: null,
  expense: null,
};

const CATALOG: readonly Omit<LaunchableApp, 'url'>[] = [
  {
    id: 'sales',
    name: 'Sales',
    summary: 'Monitor takings, margins and menu performance.',
    icon: 'BarChart3',
    colour: '#e8584f',
    status: 'ready',
    path: '/dashboard',
  },
  {
    id: 'inventory',
    name: 'Inventory',
    summary: 'Stock, deliveries, counts and waste, costed to the gram.',
    icon: 'Boxes',
    colour: '#7c5cff',
    status: 'ready',
    path: '/inventory',
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    summary: 'Take orders at the counter.',
    icon: 'ShoppingCart',
    colour: '#00a09d',
    status: 'ready',
  },
  {
    id: 'payroll',
    name: 'Payroll',
    summary: 'Pay runs, payslips and statutory contributions.',
    icon: 'Banknote',
    colour: '#f0a30a',
    status: 'ready',
  },
  {
    id: 'employee',
    name: 'Employees',
    summary: 'People, contracts and departments.',
    icon: 'Users',
    colour: '#2b8aef',
    status: 'planned',
  },
  {
    id: 'attendance',
    name: 'Attendance',
    summary: 'Time in and out, breaks and approvals.',
    icon: 'Clock',
    colour: '#00b074',
    status: 'planned',
  },
  {
    id: 'expense',
    name: 'Expenses',
    summary: 'Claims, receipts and reimbursements.',
    icon: 'ReceiptText',
    colour: '#d6336c',
    status: 'planned',
  },
];

/**
 * The catalog with URLs filled in. Anything in `overrides` wins, so a
 * deployment can point an app somewhere else without a code change; an
 * override of `null` marks an app unavailable in that environment.
 */
export function resolveApps(overrides: Partial<Record<AppId, string | null>> = {}): LaunchableApp[] {
  return CATALOG.map((app) => {
    const url = app.id in overrides ? (overrides[app.id] ?? null) : DEFAULT_URLS[app.id];
    return {
      ...app,
      url,
      // An app with nowhere to point cannot be opened, whatever the catalog says.
      status: url ? app.status : 'planned',
    };
  });
}

/** Full destination for a tile, including the app's landing path. */
export function appHref(app: LaunchableApp): string | null {
  if (!app.url) return null;
  return app.path ? `${app.url.replace(/\/$/, '')}${app.path}` : app.url;
}
