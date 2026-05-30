import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { SERVICE_AREAS, COMPANY } from '../mock';
import CTASection from '../components/CTASection';

const ServiceAreas = () => (
  <div>
    <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><MapPin size={14}/> Service Areas</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Serving Greater Austin TX</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Maintain It Bandits LLC proudly provides lawn care, landscaping, cleaning and home services across the Austin metro area.</p>
      </div>
    </section>

    <section className="py-20">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICE_AREAS.map(a => (
          <div key={a.slug} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 hover:border-green-500/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><MapPin size={18} className="text-green-400" /></div>
              <h3 className="text-white font-semibold text-lg">{a.name}</h3>
            </div>
            <p className="text-neutral-400 text-sm mt-4 leading-relaxed">Full-service lawn care, landscaping, and home maintenance throughout {a.name.replace(' TX','')}.</p>
            <Link to="/contact" className="mt-5 inline-flex items-center gap-2 text-green-400 text-sm font-medium">Get Estimate <ArrowRight size={16}/></Link>
          </div>
        ))}
      </div>
    </section>

    <CTASection />
  </div>
);

export default ServiceAreas;
