import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ArrowRight, Sparkles } from 'lucide-react';

const SERVICE_RATES = {
  'Lawn Mowing': { base: 0.012, min: 45, label: 'per visit' },
  'Sod Installation': { base: 3.25, min: 800, label: 'one-time install' },
  'Mulch Refresh': { base: 0.35, min: 150, label: 'all beds installed' },
  'Landscape Design': { base: 0.85, min: 1500, label: 'project starting at' },
  'Property Maintenance': { base: 0.018, min: 95, label: 'per visit' },
};

const QuoteCalculator = () => {
  const [service, setService] = useState('Lawn Mowing');
  const [sqft, setSqft] = useState(5000);
  const [frequency, setFrequency] = useState('weekly');

  const estimate = useMemo(() => {
    const rate = SERVICE_RATES[service];
    const base = Math.max(rate.min, sqft * rate.base);
    let low = base * 0.9;
    let high = base * 1.25;
    if (service === 'Lawn Mowing' && frequency === 'bi-weekly') {
      low *= 1.15; high *= 1.15;
    }
    return {
      low: Math.round(low / 5) * 5,
      high: Math.round(high / 5) * 5,
      label: rate.label,
    };
  }, [service, sqft, frequency]);

  return (
    <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-3xl p-7 md:p-10">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-green-500/15 border border-green-500/40 grid place-items-center"><Calculator className="text-green-400" size={22}/></div>
        <div>
          <h3 className="font-serif text-2xl md:text-3xl text-white">Instant Quote Calculator</h3>
          <p className="text-neutral-400 text-sm mt-1">Get a ballpark price in 10 seconds. No email required.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-7">
        <div>
          <label className="block text-xs text-neutral-400 uppercase tracking-widest mb-2">Service</label>
          <select value={service} onChange={e => setService(e.target.value)} className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500/60">
            {Object.keys(SERVICE_RATES).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-400 uppercase tracking-widest mb-2">Lot Size: <span className="text-white">{sqft.toLocaleString()} sq ft</span></label>
          <input type="range" min="1000" max="30000" step="500" value={sqft} onChange={e => setSqft(Number(e.target.value))} className="w-full accent-green-500"/>
          <div className="flex justify-between text-[10px] text-neutral-500 mt-1"><span>1,000</span><span>30,000+</span></div>
        </div>
      </div>

      {service === 'Lawn Mowing' && (
        <div className="mt-5">
          <label className="block text-xs text-neutral-400 uppercase tracking-widest mb-2">Frequency</label>
          <div className="flex gap-2">
            {['weekly', 'bi-weekly'].map(f => (
              <button key={f} onClick={() => setFrequency(f)} className={`px-5 py-2 rounded-full text-sm transition-colors ${frequency === f ? 'btn-green' : 'bg-[#111] border border-[#222] text-neutral-300'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 p-6 rounded-2xl bg-gradient-to-br from-[#0f1d12] to-[#0a0a0a] border border-green-500/30">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-neutral-400 text-xs uppercase tracking-widest">Estimated Range</div>
            <div className="text-green-400 text-3xl md:text-4xl font-bold mt-1">${estimate.low}–${estimate.high}</div>
            <div className="text-neutral-500 text-sm mt-1">{estimate.label}</div>
          </div>
          <Link to="/contact" className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold">Get Exact Quote <ArrowRight size={16}/></Link>
        </div>
        <p className="text-neutral-500 text-xs mt-4 flex items-start gap-2"><Sparkles size={12} className="text-green-400 mt-0.5 flex-shrink-0"/> Estimate based on typical Austin TX pricing. Final quote may vary based on property condition, accessibility, and specific requirements.</p>
      </div>
    </div>
  );
};

export default QuoteCalculator;
