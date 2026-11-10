import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import { MAKE_READY_PACKAGES } from '../data/makeReady';

// These are conversation starters, not fixed plans or promised inclusions.
const LAWN_OPTIONS = [
  {
    name: 'Basic Mow',
    desc: 'Discuss mowing and upkeep for a residential lawn.',
    service: 'lawn-mowing',
    examples: ['Mowing and edging', 'Trimming and cleanup needs', 'Preferred service frequency'],
  },
  {
    name: 'Full Yard',
    desc: 'Discuss lawn and yard work together for your property.',
    service: 'yard-work',
    examples: ['Mowing, trimming and yard care', 'Bed and shrub maintenance', 'Treatment and schedule options'],
  },
  {
    name: 'Estate',
    desc: 'Discuss maintenance needs for a larger property.',
    service: 'property-maintenance',
    examples: ['Lawn and landscape maintenance', 'Seasonal cleanup needs', 'Scope and timing for the property'],
  },
];

const PROJECT_SERVICES = [
  { name: 'Sod Installation', slug: 'sod-installation' },
  { name: 'Landscape Design', slug: 'landscaping' },
  { name: 'Mulch Refresh', slug: 'mulching' },
  { name: 'Move-Out Cleaning', slug: 'cleaning' },
  { name: 'Fertilization', slug: 'fertilization' },
  { name: 'Rental Make Ready', slug: 'make-ready-services' },
  { name: 'Tenant Turnover', slug: 'tenant-turnover-services' },
  { name: 'Property Maintenance', slug: 'property-maintenance' },
];

const Pricing = () => (
  <div>
    <SEO
      title="Lawn Care & Make Ready Pricing Austin TX | Custom Quotes | Maintain It Bandits LLC"
      description="Request a custom quote for lawn care, landscaping, cleaning, rental make-readys and tenant turnovers in greater Austin."
      keywords="lawn care pricing Austin TX, lawn mowing cost Austin, sod installation cost Austin, landscaping prices Austin, make ready cost Austin, turnover cost Austin TX"
      path="/pricing"
    />
    <Breadcrumbs items={[{ name: 'Pricing', path: '/pricing' }]}/>

    <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Pricing</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Quotes for Your Property</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Every property is different. Tell us about the location, condition, work needed and preferred timing so we can discuss a custom quote.</p>
      </div>
    </section>

    <section className="py-16">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="font-serif text-3xl md:text-4xl text-white">Mowing &amp; Yard Care</h2>
          <p className="text-neutral-400 mt-3 max-w-2xl mx-auto">These are examples to discuss, not fixed plans. The work, frequency and price are confirmed for your property.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {LAWN_OPTIONS.map(option => (
            <div key={option.name} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 flex flex-col">
              <h3 className="font-serif text-2xl text-white">{option.name}</h3>
              <p className="text-neutral-400 text-sm mt-2 leading-relaxed">{option.desc}</p>
              <div className="text-green-400 font-bold text-2xl mt-5">Custom quote</div>
              <div className="text-neutral-500 text-xs mt-5">Work to discuss:</div>
              <ul className="mt-3 space-y-2 flex-1">
                {option.examples.map(example => (
                  <li key={example} className="flex items-start gap-2 text-neutral-200 text-sm"><Check size={16} className="text-green-400 mt-0.5 flex-shrink-0"/> {example}</li>
                ))}
              </ul>
              <Link to={`/contact?service=${option.service}`} className="mt-6 w-full btn-green inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm">Request a Quote <ArrowRight size={14}/></Link>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 bg-[#080808]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Project &amp; Property Services</h2>
        <p className="text-neutral-400 text-center mt-3 max-w-2xl mx-auto">Choose a service and share your project details. Pricing depends on the property and the work requested.</p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {PROJECT_SERVICES.map(service => (
            <Link key={service.slug} to={`/contact?service=${service.slug}`} className="bg-[#0f0f0f] border border-[#1c1c1c] hover:border-green-500/40 rounded-xl p-5 flex justify-between items-center gap-4">
              <span className="text-white font-semibold">{service.name}</span>
              <span className="text-green-400 font-bold text-sm text-right">Custom quote <ArrowRight size={14} className="inline"/></span>
            </Link>
          ))}
        </div>
      </div>
    </section>

    {/* MAKE READY PRICING */}
    <section className="py-16">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <div className="text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Landlords &amp; Property Managers</span>
          <h2 className="font-serif text-3xl md:text-4xl text-white mt-5">Make Ready &amp; Turnover Quotes</h2>
          <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">There is no one-size-fits-all make-ready price. Tell us the property location, condition, work needed, number of units and desired date for a custom quote.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {MAKE_READY_PACKAGES.map(item => <div key={item.slug} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 flex flex-col">
            <h3 className="font-serif text-2xl text-white">{item.name}</h3>
            <div className="text-green-400 font-bold text-xl mt-4">Custom quote</div>
            <p className="text-neutral-400 text-sm mt-4 leading-relaxed">{item.tagline}. The scope is confirmed for your property.</p>
            <Link to="/contact?service=make-ready-services" className="btn-green mt-6 w-full inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm">Request a Quote <ArrowRight size={14}/></Link>
          </div>)}
        </div>
        <div className="text-center mt-6"><Link to="/make-ready-turnovers" className="text-green-400 text-sm hover:underline">Learn about make-ready services</Link></div>
      </div>
    </section>

    <CTASection />
  </div>
);

export default Pricing;
