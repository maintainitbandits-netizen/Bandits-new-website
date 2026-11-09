import React from 'react';
import { ShieldCheck, Clock, ClipboardList, MapPin } from 'lucide-react';

const TrustBar = () => (
  <section className="bg-[#070707] border-y border-[#161616]">
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
      {[
        { icon: ShieldCheck, text: 'Fully licensed & insured' },
        { icon: Clock, text: 'Response within 24 hours' },
        { icon: ClipboardList, text: 'Quotes for your project' },
        { icon: MapPin, text: 'Serving greater Austin' },
      ].map(item => <div key={item.text} className="flex items-center gap-3 justify-center"><item.icon size={22} className="text-green-400 shrink-0"/><span className="text-xs md:text-sm text-neutral-200">{item.text}</span></div>)}
    </div>
  </section>
);

export default TrustBar;
