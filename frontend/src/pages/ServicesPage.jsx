import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { SERVICES, COMPANY } from '../mock';
import CTASection from '../components/CTASection';

const ServicesPage = () => (
  <div>
    <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Our Services</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Complete Home Services in Austin TX</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">From weekly lawn mowing to deep cleaning, Maintain It Bandits LLC is your one-stop shop for everything your Austin TX property needs.</p>
      </div>
    </section>

    <section className="py-20">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SERVICES.map(s => (
          <Link to={`/services/${s.slug}`} key={s.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
            <div className="aspect-[4/3] overflow-hidden">
              <img src={s.image} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="p-6">
              <h3 className="text-white font-semibold text-xl">{s.title}</h3>
              <p className="text-neutral-400 text-sm mt-3 leading-relaxed">{s.short}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-green-400 font-medium text-sm">Learn More <ArrowRight size={16} /></span>
            </div>
          </Link>
        ))}
      </div>
    </section>

    <CTASection />
  </div>
);

export default ServicesPage;
