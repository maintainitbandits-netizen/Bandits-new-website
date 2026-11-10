import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList } from 'lucide-react';
import { SERVICES } from '../mock';
import { RENTAL_SLUGS } from '../data/quote';

// Service selector only: prices are discussed for each property rather than
// calculated from unverified rates. Keep the selected service in the request.
const OPTION_LABELS = {
  'lawn-mowing': 'Lawn Mowing',
  landscaping: 'Landscape Design',
  mulching: 'Mulch Refresh',
  'make-ready-services': 'Make Ready / Turnover',
};
const QUOTE_OPTIONS = SERVICES.map(service => ({
  slug: service.slug,
  label: OPTION_LABELS[service.slug] || service.title,
}));

const QuoteCalculator = () => {
  const [label, setLabel] = useState(QUOTE_OPTIONS[0].label);
  const selected = QUOTE_OPTIONS.find(option => option.label === label) || QUOTE_OPTIONS[0];
  const rental = RENTAL_SLUGS.includes(selected.slug);
  const quoteTitle = selected.slug === 'make-ready-services' ? 'Custom Make-Ready Quote' : selected.slug === 'tenant-turnover-services' ? 'Custom Turnover Quote' : 'Custom Quote';
  const quoteLink = `/contact?service=${selected.slug}`;

  return (
    <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-3xl p-7 md:p-10">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center"><ClipboardList className="text-green-400" size={22}/></div>
        <div>
          <h3 className="font-serif text-2xl md:text-3xl text-white">Start Your Quote Request</h3>
          <p className="text-neutral-400 text-sm mt-1">Choose the service closest to what you need.</p>
        </div>
      </div>

      <div className="mt-7">
        <label htmlFor="quote-service" className="block text-xs text-neutral-400 uppercase tracking-widest mb-2">Service</label>
        <select id="quote-service" value={label} onChange={event => setLabel(event.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60">
          {QUOTE_OPTIONS.map(option => <option key={option.slug} value={option.label}>{option.label}</option>)}
        </select>
      </div>

      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-[#0f1d12] to-[#0a0a0a] border border-green-500/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-green-400 text-2xl font-bold">{quoteTitle}</div>
            <p className="text-neutral-400 text-sm mt-2 max-w-lg">{rental ? 'Share the property location, work needed, number of units and desired date.' : 'Share the property location, the work needed and your preferred timing.'}</p>
          </div>
          <Link to={quoteLink} className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold">Request a Quote <ArrowRight size={16}/></Link>
        </div>
        <p className="text-neutral-500 text-xs mt-4">Pricing and scheduling are discussed for your property and requested work.</p>
      </div>
    </div>
  );
};

export default QuoteCalculator;
