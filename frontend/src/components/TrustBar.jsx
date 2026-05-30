import React from 'react';
import { ShieldCheck, Star, Award, Leaf, Clock } from 'lucide-react';

const TrustBar = () => (
  <section className="bg-[#070707] border-y border-[#161616]">
    <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-5 gap-6 items-center">
      <div className="flex items-center gap-3 justify-center md:justify-start">
        <ShieldCheck size={22} className="text-green-400"/>
        <div className="text-xs md:text-sm text-neutral-200"><b>Licensed</b> & Insured</div>
      </div>
      <div className="flex items-center gap-3 justify-center">
        <div className="flex">{[...Array(5)].map((_,i)=><Star key={i} size={16} className="text-green-400 fill-green-400"/>) }</div>
        <div className="text-xs md:text-sm text-neutral-200"><b>5-Star</b> Rated</div>
      </div>
      <div className="flex items-center gap-3 justify-center">
        <Award size={22} className="text-green-400"/>
        <div className="text-xs md:text-sm text-neutral-200"><b>500+</b> Happy Customers</div>
      </div>
      <div className="flex items-center gap-3 justify-center">
        <Leaf size={22} className="text-green-400"/>
        <div className="text-xs md:text-sm text-neutral-200"><b>Eco-Friendly</b> Practices</div>
      </div>
      <div className="flex items-center gap-3 justify-center md:justify-end col-span-2 md:col-span-1">
        <Clock size={22} className="text-green-400"/>
        <div className="text-xs md:text-sm text-neutral-200"><b>Same Week</b> Service</div>
      </div>
    </div>
  </section>
);

export default TrustBar;
