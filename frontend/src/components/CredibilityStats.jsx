import React from 'react';
import { Award, Users, Briefcase, Star } from 'lucide-react';
import { COMPANY } from '../mock';
import { REVIEW_STATS } from '../config/social';

const CredibilityStats = () => {
  const yearsInBusiness = new Date().getFullYear() - COMPANY.founded;
  const items = [
    { icon: Award, value: `${yearsInBusiness}+`, label: 'Years in Business' },
    { icon: Briefcase, value: COMPANY.jobsCompleted, label: 'Jobs Completed' },
    { icon: Users, value: '500+', label: 'Happy Customers' },
    { icon: Star, value: `${REVIEW_STATS.rating.toFixed(1)}★`, label: `${REVIEW_STATS.count}+ Google Reviews` },
  ];
  return (
    <section className="py-16 bg-[#070707] border-y border-[#161616]">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((it, i) => (
          <div key={i} className="text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center">
              <it.icon className="text-green-400" size={20}/>
            </div>
            <div className="text-green-400 font-bold text-3xl md:text-4xl mt-4">{it.value}</div>
            <div className="text-neutral-400 text-xs uppercase tracking-widest mt-1">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CredibilityStats;
