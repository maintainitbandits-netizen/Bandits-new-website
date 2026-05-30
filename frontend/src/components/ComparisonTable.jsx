import React from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

const ROWS = [
  { label: 'Same-week service', us: true, diy: 'Whenever you have time', others: 'Usually 2-3 weeks' },
  { label: 'Licensed & insured', us: true, diy: false, others: 'Maybe' },
  { label: 'No long-term contracts', us: true, diy: 'N/A', others: 'Usually required' },
  { label: 'One company for all home needs', us: true, diy: false, others: false },
  { label: 'Professional-grade equipment', us: true, diy: false, others: true },
  { label: 'Free, no-pressure estimates', us: true, diy: 'N/A', others: 'Sometimes' },
  { label: '5-star Google reviews', us: true, diy: 'N/A', others: 'Varies' },
  { label: 'Eco-friendly practices', us: true, diy: 'Depends', others: 'Rare' },
  { label: 'Local Austin crew', us: true, diy: 'You', others: 'Varies' },
];

const Cell = ({ value, isUs }) => {
  if (value === true) {
    return <div className={`flex justify-center ${isUs ? 'text-green-400' : 'text-neutral-400'}`}><Check size={20}/></div>;
  }
  if (value === false) {
    return <div className="flex justify-center text-neutral-700"><X size={20}/></div>;
  }
  return <div className="text-center text-xs text-neutral-500">{value}</div>;
};

const ComparisonTable = () => (
  <section className="py-24 bg-[#0a0a0a]">
    <div className="max-w-5xl mx-auto px-5 lg:px-8">
      <div className="text-center mb-12">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Why Choose Us</span>
        <h2 className="font-serif text-4xl md:text-5xl text-white mt-5">See How We Compare</h2>
        <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">A clear, honest comparison — because you deserve to know what you&apos;re paying for.</p>
      </div>

      <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-4 gap-2 p-5 border-b border-[#1c1c1c] bg-[#0a0a0a]">
          <div></div>
          <div className="text-center">
            <div className="text-green-400 font-serif text-lg md:text-xl">Maintain It Bandits</div>
            <div className="text-[10px] text-green-400/60 uppercase tracking-widest mt-1">★ Recommended</div>
          </div>
          <div className="text-center text-neutral-400 font-medium text-sm md:text-base">DIY</div>
          <div className="text-center text-neutral-400 font-medium text-sm md:text-base">Other Lawn Services</div>
        </div>
        {ROWS.map((r, i) => (
          <div key={i} className={`grid grid-cols-4 gap-2 px-5 py-4 items-center ${i % 2 === 0 ? 'bg-[#0c0c0c]' : ''}`}>
            <div className="text-neutral-300 text-sm flex items-center gap-2">
              <AlertCircle size={12} className="text-green-400/60 flex-shrink-0"/>
              <span>{r.label}</span>
            </div>
            <Cell value={r.us} isUs/>
            <Cell value={r.diy}/>
            <Cell value={r.others}/>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default ComparisonTable;
