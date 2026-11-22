import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CreditCard, ShieldCheck, Smartphone } from 'lucide-react';
import { CONTACT_EMAIL } from '../components/Layout';
import { addOns, formatPeso, planPrice, plans, type BillingCycle } from '../data/pricing';

export function Pricing() {
  const [cycle, setCycle] = useState<BillingCycle>('annual');

  return (
    <div className="py-16">
      <div className="container-x">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Pricing</p>
          <h1 className="h-display mt-3 text-4xl sm:text-5xl">Simple plans that grow with you.</h1>
          <p className="mt-4 text-ink-soft">Start with the essentials. Add branches, people and apps when you need them.</p>

          <div className="mt-8 inline-flex rounded-xl border border-ink/10 bg-white p-1 shadow-card" role="tablist">
            {(['monthly', 'annual'] as const).map((c) => (
              <button key={c} role="tab" aria-selected={cycle === c} onClick={() => setCycle(c)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${cycle === c ? 'bg-brand-600 text-white' : 'text-ink-soft hover:text-ink'}`}>
                {c === 'monthly' ? 'Monthly' : 'Annual'}
                {c === 'annual' && <span className={`ml-2 text-xs ${cycle === c ? 'text-white/80' : 'text-brand-600'}`}>2 months free</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {plans.map((p) => {
            const price = planPrice(p, cycle);
            return (
              <div key={p.id}
                className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-card ${p.highlight ? 'border-2 border-brand-600' : 'border border-ink/5'}`}>
                {p.highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">Most popular</span>
                )}
                <h2 className="font-display text-xl font-bold">{p.name}</h2>
                <p className="mt-1 min-h-[40px] text-sm text-ink-mute">{p.tagline}</p>

                <div className="mt-5 min-h-[64px]">
                  {price === null ? (
                    <p className="font-display text-3xl font-extrabold">Custom</p>
                  ) : (
                    <>
                      <p className="font-display text-4xl font-extrabold">
                        {formatPeso(price)}<span className="text-base font-medium text-ink-mute"> /mo</span>
                      </p>
                      <p className="text-xs text-ink-mute">
                        {cycle === 'annual' ? `${formatPeso(price * 12)} billed yearly` : 'billed monthly'}
                      </p>
                    </>
                  )}
                </div>

                <ul className="mt-4 space-y-1 text-xs font-medium text-ink-soft">
                  {p.limits.map((l) => <li key={l}>{l}</li>)}
                </ul>

                <ul className="mt-5 flex-1 space-y-2.5 border-t border-ink/5 pt-5">
                  {p.includes.map((i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 flex-none text-brand-600" />{i}
                    </li>
                  ))}
                </ul>

                {p.monthly === null ? (
                  <a href={`mailto:${CONTACT_EMAIL}?subject=Enterprise%20enquiry`} className="btn-outline mt-6">{p.cta}</a>
                ) : (
                  <Link to={`/checkout?plan=${p.id}&cycle=${cycle}`} className={`mt-6 ${p.highlight ? 'btn-primary' : 'btn-outline'}`}>
                    {p.cta}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-2"><CreditCard className="h-4 w-4 text-brand-600" /> Visa · Mastercard</span>
          <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand-600" /> GCash · Maya</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-600" /> Secure hosted checkout</span>
        </div>

        <div className="mt-20">
          <h2 className="h-display text-2xl sm:text-3xl">Add-ons</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {addOns.map((a) => (
              <div key={a.name} className="rounded-2xl border border-ink/5 bg-white p-5 shadow-card">
                <p className="font-semibold">{a.name}</p>
                <p className="mt-1 font-display text-lg font-bold text-brand-700">{a.price}</p>
                <p className="mt-1 text-xs text-ink-mute">{a.note}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-ink-mute">
          Prices in Philippine pesos. Need something different?{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-brand-700">Talk to us</a>.
        </p>
      </div>
    </div>
  );
}
