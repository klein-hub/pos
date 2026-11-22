/**
 * What Digita offers, organised the way a buyer thinks rather than the way it
 * was built. Five suites by business function; each product marked available
 * or on the roadmap. Copy lives here so the landing page, pricing and any
 * future product pages describe things the same way.
 */

export type Availability = 'available' | 'soon';

export interface Product {
  id: string;
  name: string;
  blurb: string;
  availability: Availability;
  /** Works with an AI agent inside the product. */
  ai?: boolean;
}

export interface Suite {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  products: Product[];
}

export const suites: Suite[] = [
  {
    id: 'commerce',
    name: 'Commerce',
    tagline: 'Sell anywhere — counter, table or online — from one catalogue.',
    icon: 'ShoppingBag',
    products: [
      { id: 'pos', name: 'Point of Sale', availability: 'available',
        blurb: 'Fast counter and table service with split payments, shifts and VAT-correct receipts.' },
      { id: 'store', name: 'Online Store', availability: 'available',
        blurb: 'Take orders online with the same menu, prices and stock as your counter.' },
      { id: 'sales', name: 'Sales Insights', availability: 'available',
        blurb: 'Takings, margins and best-sellers by hour, branch and product.' },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    tagline: 'Know exactly what every product costs to make — and what you have left.',
    icon: 'Boxes',
    products: [
      { id: 'inventory', name: 'Inventory & Costing', availability: 'available',
        blurb: 'Recipe costing to the gram, batch expiry, purchasing and waste tracking.' },
      { id: 'projects', name: 'Projects', availability: 'soon',
        blurb: 'Plan installations and jobs, track hours and materials per project.' },
      { id: 'helpdesk', name: 'Helpdesk', availability: 'soon', ai: true,
        blurb: 'Service requests and maintenance tickets, triaged by an AI agent.' },
    ],
  },
  {
    id: 'people',
    name: 'People',
    tagline: 'Pay your team accurately and on time, without spreadsheets.',
    icon: 'Users',
    products: [
      { id: 'payroll', name: 'Payroll', availability: 'available',
        blurb: 'Pay runs, payslips and government contributions under Philippine labor rules.' },
      { id: 'attendance', name: 'Time & Attendance', availability: 'available',
        blurb: 'Mobile clock-in with selfie verification, breaks and approvals feeding payroll.' },
      { id: 'hr', name: 'HR', availability: 'soon',
        blurb: 'Employee records, contracts, leave and onboarding in one place.' },
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    tagline: 'Every peso in and out, accounted for and ready for the BIR.',
    icon: 'Landmark',
    products: [
      { id: 'expense', name: 'Expense Management', availability: 'available',
        blurb: 'Capture receipts, approve claims and reimburse — tied to the right branch.' },
      { id: 'tax', name: 'AI Tax Filing', availability: 'soon', ai: true,
        blurb: 'An AI agent that prepares your returns from the books you already keep.' },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    tagline: 'Stay visible and keep customers coming back.',
    icon: 'Megaphone',
    products: [
      { id: 'social', name: 'Social Media Studio', availability: 'available', ai: true,
        blurb: 'Plan, write and schedule posts across channels with AI agents doing the heavy lifting.' },
      { id: 'email', name: 'Email Marketing', availability: 'soon', ai: true,
        blurb: 'Campaigns and automated follow-ups, drafted and segmented by AI.' },
    ],
  },
];

export interface Industry {
  id: string;
  name: string;
  icon: string;
  problem: string;
  outcome: string;
  highlights: string[];
}

export const industries: Industry[] = [
  {
    id: 'cafes',
    name: 'Cafés & Restaurants',
    icon: 'Coffee',
    problem: 'Margins disappear between the supplier invoice and the cup.',
    outcome: 'See the true cost of every drink and dish, down to the gram, and price with confidence.',
    highlights: ['Recipe & modifier costing', 'Shift cash reconciliation', 'SC/PWD discounts done right'],
  },
  {
    id: 'agri',
    name: 'Farm-to-Table & Agriculture',
    icon: 'Sprout',
    problem: 'Perishable stock, seasonal labor and buyers who want it fresh.',
    outcome: 'Track harvests and batches by expiry, pay seasonal crews correctly, and sell direct.',
    highlights: ['Batch & expiry tracking', 'Seasonal payroll', 'Direct-to-customer online store'],
  },
  {
    id: 'fnb',
    name: 'Food & Beverage',
    icon: 'Package',
    problem: 'Production, distribution and retail on separate systems that never agree.',
    outcome: 'One record from raw material to sale, across every branch and channel.',
    highlights: ['Multi-branch inventory', 'Production costing', 'Channel-level sales insight'],
  },
  {
    id: 'hvac',
    name: 'Industrial HVAC',
    icon: 'Fan',
    problem: 'Field teams, spare parts and service contracts tracked on paper.',
    outcome: 'Schedule technicians, track parts and keep every maintenance contract on time.',
    highlights: ['Parts inventory', 'Technician time & payroll', 'Service desk (coming soon)'],
  },
];

export interface Service {
  name: string;
  blurb: string;
  icon: string;
}

/** Digita is an IT sourcing company as well as a software one. */
export const services: Service[] = [
  { name: 'Implementation & migration', icon: 'Rocket',
    blurb: 'We set everything up and move your existing records in, so you start on day one with real data.' },
  { name: 'Hardware sourcing', icon: 'Printer',
    blurb: 'POS terminals, tablets, receipt printers, scanners and cash drawers — specified, supplied and configured.' },
  { name: 'Managed IT & support', icon: 'LifeBuoy',
    blurb: 'Local support for your systems, devices and network, so your team can focus on customers.' },
  { name: 'Integrations', icon: 'Plug',
    blurb: 'Connect the tools you already rely on, from accounting to delivery platforms.' },
];
