import { useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Lock, Mail, Smartphone } from 'lucide-react';
import { CONTACT_EMAIL } from '../components/Layout';
import { chargeFor, formatPeso, planPrice, plans, type BillingCycle } from '../data/pricing';
import { paymentMethods, paymentProvider, paymentsEnabled, type PaymentMethod } from '../payments';

const methodIcon = { card: CreditCard, gcash: Smartphone, maya: Smartphone } as const;

export function Checkout() {
  const [params, setParams] = useSearchParams();
  const plan = plans.find((p) => p.id === params.get('plan') && p.monthly !== null) ?? plans[1]!;
  const cycle: BillingCycle = params.get('cycle') === 'monthly' ? 'monthly' : 'annual';

  const [method, setMethod] = useState<PaymentMethod>('card');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const perMonth = planPrice(plan, cycle) ?? 0;
  const dueToday = chargeFor(plan, cycle) ?? 0;
  const enabled = paymentsEnabled();

  const mailto = useMemo(() => {
    const body = [
      `Plan: ${plan.name} (${cycle})`,
      `Company: ${company}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Preferred payment: ${paymentMethods.find((m) => m.id === method)?.label}`,
    ].join('\n');
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Sign up — ${plan.name}`)}&body=${encodeURIComponent(body)}`;
  }, [plan, cycle, company, name, phone, method]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await paymentProvider().createCheckout({
        plan, cycle, method, amountCentavos: dueToday,
        customer: { name, email, company, phone },
      });
      if (result.status === 'redirect') {
        // The provider's own page takes the card or the wallet approval.
        window.location.href = result.url;
        return;
      }
      setNotice(result.reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-12">
      <div className="container-x">
        <Link to="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to plans
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <form onSubmit={(e) => void submit(e)} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-card sm:p-8">
            <h1 className="h-display text-2xl">Set up your account</h1>
            <p className="mt-1 text-sm text-ink-mute">A few details, then you choose how to pay.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                { label: 'Full name', value: name, set: setName, type: 'text', req: true, ac: 'name' },
                { label: 'Work email', value: email, set: setEmail, type: 'email', req: true, ac: 'email' },
                { label: 'Business name', value: company, set: setCompany, type: 'text', req: true, ac: 'organization' },
                { label: 'Mobile number', value: phone, set: setPhone, type: 'tel', req: false, ac: 'tel' },
              ].map((f) => (
                <label key={f.label} className="block">
                  <span className="text-sm font-medium">{f.label}{f.req && <span className="text-rose-500"> *</span>}</span>
                  <input type={f.type} required={f.req} value={f.value} autoComplete={f.ac}
                    onChange={(e) => f.set(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
                </label>
              ))}
            </div>

            <fieldset className="mt-8">
              <legend className="text-sm font-semibold">Payment method</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {paymentMethods.map((m) => {
                  const IconCmp = methodIcon[m.id];
                  const on = method === m.id;
                  return (
                    <label key={m.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${on ? 'border-brand-600 bg-brand-50/60 ring-1 ring-brand-600' : 'border-ink/15 hover:border-ink/30'}`}>
                      <input type="radio" name="method" value={m.id} checked={on} onChange={() => setMethod(m.id)} className="sr-only" />
                      <IconCmp className={`mt-0.5 h-5 w-5 ${on ? 'text-brand-700' : 'text-ink-mute'}`} />
                      <span>
                        <span className="block text-sm font-semibold">{m.label}</span>
                        <span className="block text-xs text-ink-mute">{m.detail}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-mute">
                <Lock className="h-3.5 w-3.5" />
                You will finish on our payment partner’s secure page. Digita never sees or stores your card number.
              </p>
            </fieldset>

            {notice && (
              <div className="mt-6 rounded-xl border border-harvest-400/40 bg-harvest-300/15 p-4 text-sm">
                <p className="font-semibold">Online payment is coming soon</p>
                <p className="mt-1 text-ink-soft">{notice}</p>
                <a href={mailto} className="btn-primary mt-4"><Mail className="h-4 w-4" /> Email us these details</a>
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-primary mt-8 w-full disabled:opacity-60">
              {busy ? 'Preparing…' : enabled ? `Continue to payment · ${formatPeso(dueToday)}` : 'Continue'}
            </button>
          </form>

          <aside className="h-fit rounded-2xl border border-ink/5 bg-white p-6 shadow-card">
            <p className="eyebrow">Your plan</p>
            <h2 className="mt-2 font-display text-2xl font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-ink-mute">{plan.tagline}</p>

            <div className="mt-5 inline-flex rounded-lg border border-ink/10 p-1 text-xs">
              {(['monthly', 'annual'] as const).map((c) => (
                <button key={c} type="button"
                  onClick={() => setParams({ plan: plan.id, cycle: c })}
                  className={`rounded-md px-3 py-1.5 font-semibold ${cycle === c ? 'bg-ink text-white' : 'text-ink-soft'}`}>
                  {c === 'monthly' ? 'Monthly' : 'Annual'}
                </button>
              ))}
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-mute">Price</dt><dd className="font-semibold">{formatPeso(perMonth)} / month</dd></div>
              <div className="flex justify-between"><dt className="text-ink-mute">Billing</dt><dd>{cycle === 'annual' ? 'Yearly' : 'Monthly'}</dd></div>
              {cycle === 'annual' && plan.monthly !== null && (
                <div className="flex justify-between text-brand-700">
                  <dt>You save</dt><dd className="font-semibold">{formatPeso(plan.monthly * 2)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-ink/10 pt-3 text-base">
                <dt className="font-semibold">Due today</dt><dd className="font-display font-extrabold">{formatPeso(dueToday)}</dd>
              </div>
            </dl>

            <ul className="mt-6 space-y-1.5 border-t border-ink/5 pt-5 text-xs text-ink-soft">
              {plan.limits.concat(plan.includes).map((i) => <li key={i}>• {i}</li>)}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
