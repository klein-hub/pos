/**
 * Plans and prices.
 *
 * DRAFT NUMBERS — set by product/finance before launch. They live here, alone,
 * so changing a price is a one-line edit that cannot break the layout.
 *
 * Amounts are integer centavos, like every money value in the platform.
 */

export type BillingCycle = 'monthly' | 'annual';

export interface Plan {
  id: 'starter' | 'growth' | 'scale' | 'enterprise';
  name: string;
  tagline: string;
  /** Per month, billed monthly. Null = custom quote. */
  monthly: number | null;
  /** Per month, billed annually. */
  annualPerMonth: number | null;
  highlight?: boolean;
  limits: string[];
  includes: string[];
  cta: string;
}

/** Annual billing: two months free. */
const annual = (monthly: number) => Math.round((monthly * 10) / 12);

export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For a single café, stall or shop getting off spreadsheets.',
    monthly: 149_000,
    annualPerMonth: annual(149_000),
    limits: ['1 branch', 'Up to 3 users'],
    includes: ['Point of Sale', 'Inventory & Costing', 'Sales Insights', 'Email support'],
    cta: 'Start with Starter',
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'For growing teams that need payroll and attendance handled.',
    monthly: 399_000,
    annualPerMonth: annual(399_000),
    highlight: true,
    limits: ['Up to 3 branches', 'Up to 15 users'],
    includes: [
      'Everything in Starter',
      'Payroll',
      'Time & Attendance',
      'Expense Management',
      'Priority email & chat support',
    ],
    cta: 'Choose Growth',
  },
  {
    id: 'scale',
    name: 'Scale',
    tagline: 'For multi-branch businesses selling online and on social.',
    monthly: 799_000,
    annualPerMonth: annual(799_000),
    limits: ['Unlimited branches', 'Up to 50 users'],
    includes: [
      'Everything in Growth',
      'Online Store',
      'Social Media Studio with AI agents',
      'Early access to new AI agents',
      'Onboarding specialist',
    ],
    cta: 'Choose Scale',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For industrial, multi-entity and field-service operations.',
    monthly: null,
    annualPerMonth: null,
    limits: ['Custom branches & users', 'Multiple companies'],
    includes: [
      'Everything in Scale',
      'Custom integrations',
      'Hardware sourcing & deployment',
      'Dedicated success manager',
      'Service-level agreement',
    ],
    cta: 'Talk to sales',
  },
];

export interface AddOn {
  name: string;
  price: string;
  note: string;
}

export const addOns: AddOn[] = [
  { name: 'Additional branch', price: '₱990 / month', note: 'Each extra location on Starter or Growth.' },
  { name: 'Additional users', price: '₱149 / user / month', note: 'Beyond your plan’s included users.' },
  { name: 'POS hardware bundle', price: 'Quoted', note: 'Terminal, printer, cash drawer and scanner, configured.' },
  { name: 'Data migration', price: 'Quoted', note: 'We move your existing records in for you.' },
];

export function planPrice(plan: Plan, cycle: BillingCycle): number | null {
  return cycle === 'annual' ? plan.annualPerMonth : plan.monthly;
}

export function formatPeso(centavos: number): string {
  return `₱${Math.round(centavos / 100).toLocaleString('en-PH')}`;
}

/** What is actually charged up front for the chosen cycle. */
export function chargeFor(plan: Plan, cycle: BillingCycle): number | null {
  if (plan.monthly === null) return null;
  return cycle === 'annual' ? plan.monthly * 10 : plan.monthly;
}
