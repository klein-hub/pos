/**
 * Payments, ready for a provider to be plugged in.
 *
 * The design is hosted checkout: we create a session with the provider and
 * redirect the buyer to the provider's own page, where they enter card details
 * or approve in GCash or Maya. No card number ever touches this site. That
 * keeps Digita out of PCI-DSS card-data scope — collecting card numbers on our
 * own form would make us responsible for securing them.
 *
 * In the Philippines, PayMongo and Xendit both support Visa/Mastercard, GCash
 * and Maya through a single hosted checkout, so one adapter covers every
 * method listed here. Creating the session must happen server-side (it needs
 * the provider's secret key): a Supabase Edge Function is the natural home.
 *
 * To go live: implement PaymentProvider for the chosen gateway, deploy the
 * session-creating function, and set VITE_PAYMENT_PROVIDER.
 */

import type { BillingCycle, Plan } from '../data/pricing';

export type PaymentMethod = 'card' | 'gcash' | 'maya';

export interface PaymentMethodInfo {
  id: PaymentMethod;
  label: string;
  detail: string;
}

export const paymentMethods: PaymentMethodInfo[] = [
  { id: 'card', label: 'Credit or debit card', detail: 'Visa · Mastercard' },
  { id: 'gcash', label: 'GCash', detail: 'Approve in the GCash app' },
  { id: 'maya', label: 'Maya', detail: 'Approve in the Maya app' },
];

export interface CheckoutRequest {
  plan: Plan;
  cycle: BillingCycle;
  method: PaymentMethod;
  amountCentavos: number;
  customer: { name: string; email: string; company: string; phone?: string };
}

export type CheckoutResult =
  | { status: 'redirect'; url: string }
  | { status: 'unavailable'; reason: string };

export interface PaymentProvider {
  name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

/**
 * The placeholder until a gateway is chosen. It never pretends to take money:
 * a checkout that appears to succeed and charges nothing is worse than one
 * that says plainly it is not open yet.
 */
const unconfigured: PaymentProvider = {
  name: 'none',
  async createCheckout() {
    return {
      status: 'unavailable',
      reason:
        'Online payment is not switched on yet. Your details are not sent anywhere — email us and we will set up your account and invoice you directly.',
    };
  },
};

/**
 * Registry of adapters. A real one looks like:
 *
 *   paymongo: {
 *     name: 'PayMongo',
 *     async createCheckout(req) {
 *       const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify(req),
 *       });
 *       const { checkout_url } = await res.json();
 *       return { status: 'redirect', url: checkout_url };
 *     },
 *   },
 */
const providers: Record<string, PaymentProvider> = {
  none: unconfigured,
};

export function paymentProvider(): PaymentProvider {
  const key = import.meta.env.VITE_PAYMENT_PROVIDER ?? 'none';
  return providers[key] ?? unconfigured;
}

export function paymentsEnabled(): boolean {
  return paymentProvider() !== unconfigured;
}
