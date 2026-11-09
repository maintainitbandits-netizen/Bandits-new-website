import React from 'react';
import { ClipboardList, Home, KeyRound, MapPin } from 'lucide-react';

// No invented customer counts, dates, ratings or job totals.
const CredibilityStats = () => {
  const items = [
    { icon: Home, value: 'Home', label: 'Property Services' },
    { icon: KeyRound, value: 'Rental', label: 'Make Readys & Turnovers' },
    { icon: ClipboardList, value: 'Your Scope', label: 'Custom Quotes' },
    { icon: MapPin, value: 'Austin', label: 'And Nearby Communities' },
  ];
  return <section className="py-16 bg-[#070707] border-y border-[#161616]">
    <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
      {items.map(item => <div key={item.value} className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><item.icon className="text-green-400" size={20}/></div>
        <div className="text-green-400 font-bold text-2xl md:text-3xl mt-4">{item.value}</div>
        <div className="text-neutral-400 text-xs uppercase tracking-widest mt-1">{item.label}</div>
      </div>)}
    </div>
  </section>;
};

export default CredibilityStats;
