import React from 'react';
import { Link } from 'react-router-dom';
import { Check, X, ArrowRight, Star } from 'lucide-react';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const PLANS = [
  {
    name: 'Basic Mow',
    price: '49',
    unit: 'per visit',
    desc: 'Perfect for smaller residential lots up to 5,000 sq ft.',
    features: [
      'Weekly or bi-weekly mowing',
      'Edging on hard surfaces',
      'Line trimming around obstacles',
      'Full blow-off cleanup',
      'Same crew when possible',
    ],
    notIncluded: ['Fertilization', 'Bed maintenance'],
  },
  {
    name: 'Full Yard',
    price: '79',
    unit: 'per visit',
    badge: 'Most Popular',
    desc: 'Our most popular plan — ideal for typical Austin yards (5,000–10,000 sq ft).',
    features: [
      'Everything in Basic Mow',
      'Detailed bed edging',
      'Light shrub trimming',
      'Hand-pull weeds in beds',
      'Quarterly fertilization included',
      'Priority scheduling',
    ],
    notIncluded: ['Major landscaping installs'],
  },
  {
    name: 'Estate',
    price: '149',
    unit: 'per visit',
    desc: 'Premium service for large lots (10,000+ sq ft) and demanding properties.',
    features: [
      'Everything in Full Yard',
      'Tree & shrub care',
      'Mulch refresh (2×/year)',
      'Seasonal cleanups included',
      'Custom landscape consultations',
      'Dedicated crew',
    ],
    notIncluded: [],
  },
];

const PROJECT_PRICING = [
  { name: 'Sod Installation', price: '$2.50–$4.50', unit: 'per sq ft installed' },
  { name: 'Landscape Design', price: '$1,500–$15,000+', unit: 'project-based' },
  { name: 'Mulch Refresh', price: '$80–$120', unit: 'per cubic yard installed' },
  { name: 'Move-Out Cleaning', price: '$250–$650', unit: 'home size dependent' },
  { name: 'Fertilization Program', price: '$45–$95', unit: 'per application' },
  { name: 'Property Maintenance', price: 'Custom', unit: 'contact for quote' },
];

const Pricing = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'PriceSpecification',
    name: 'Lawn Care Pricing Austin TX',
    priceCurrency: 'USD',
  };
  return (
    <div>
      <SEO
        title="Lawn Care Pricing Austin TX | Transparent Estimates | Maintain It Bandits LLC"
        description="Transparent lawn care pricing for Austin TX. See our weekly mowing plans, sod installation, landscaping, and cleaning service rates. Free custom estimates."
        keywords="lawn care pricing Austin TX, lawn mowing cost Austin, sod installation cost Austin, landscaping prices Austin"
        path="/pricing"
        schema={schema}
      />
      <Breadcrumbs items={[{ name: 'Pricing', path: '/pricing' }]}/>

      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Pricing</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Transparent, Honest Pricing</h1>
          <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">No hidden fees. No surprise charges. Here&apos;s what most Austin TX homeowners pay for our lawn care and home services. Every property is different — contact us for an exact quote.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map(p => (
            <div key={p.name} className={`relative bg-[#0f0f0f] border rounded-2xl p-7 ${p.badge ? 'border-green-500/40 shadow-xl shadow-green-500/10' : 'border-[#1c1c1c]'}`}>
              {p.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 btn-green px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"><Star size={10} className="inline -mt-0.5 mr-1"/>{p.badge}</span>
              )}
              <h3 className="font-serif text-2xl text-white">{p.name}</h3>
              <p className="text-neutral-400 text-sm mt-2 leading-relaxed">{p.desc}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-bold text-green-400">${p.price}</span>
                <span className="text-neutral-500 text-sm">{p.unit}</span>
              </div>
              <ul className="mt-6 space-y-2">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-neutral-200 text-sm"><Check size={16} className="text-green-400 mt-0.5 flex-shrink-0"/> {f}</li>
                ))}
                {p.notIncluded.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-neutral-600 text-sm line-through"><X size={16} className="text-neutral-700 mt-0.5 flex-shrink-0"/> {f}</li>
                ))}
              </ul>
              <Link to="/contact" className="mt-6 w-full btn-green inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm">Get Quote <ArrowRight size={14}/></Link>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Project-Based Pricing</h2>
          <p className="text-neutral-400 text-center mt-3 max-w-2xl mx-auto">For one-time projects beyond weekly maintenance, here are typical starting price ranges in the Austin market.</p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
            {PROJECT_PRICING.map((p, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-xl p-5 flex justify-between items-center">
                <div>
                  <div className="text-white font-semibold">{p.name}</div>
                  <div className="text-neutral-500 text-xs mt-1">{p.unit}</div>
                </div>
                <div className="text-green-400 font-bold text-lg">{p.price}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default Pricing;
