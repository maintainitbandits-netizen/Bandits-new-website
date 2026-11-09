import React from 'react';
import { ClipboardList, Clock, ShieldCheck } from 'lucide-react';

const ComparisonTable = () => (
  <section className="py-20 bg-[#0a0a0a]">
    <div className="max-w-5xl mx-auto px-5 lg:px-8">
      <div className="text-center mb-10">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Your Project</span>
        <h2 className="font-serif text-4xl md:text-5xl text-white mt-5">Start with a clear conversation</h2>
        <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">Tell us what matters for your property, and we&apos;ll discuss the work and timing.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-5">
        {[
          { icon: ClipboardList, title: 'Your Checklist', text: 'Share the work you need and any project requirements.' },
          { icon: Clock, title: 'Your Timing', text: 'Let us know your preferred dates so we can discuss availability.' },
          { icon: ShieldCheck, title: 'Licensed & Insured', text: 'Maintain It Bandits LLC is fully licensed and insured.' },
        ].map(item => <div key={item.title} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6"><item.icon className="text-green-400" size={22}/><h3 className="text-white font-semibold mt-4">{item.title}</h3><p className="text-neutral-400 text-sm mt-2 leading-relaxed">{item.text}</p></div>)}
      </div>
    </div>
  </section>
);

export default ComparisonTable;
