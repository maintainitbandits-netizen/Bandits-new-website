import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { COMPANY } from '../mock';

const CTASection = () => (
  <section className="py-24 bg-[#0a0a0a]">
    <div className="max-w-4xl mx-auto px-5 lg:px-8">
      <div className="bg-gradient-to-br from-[#0f1d12] to-[#0a0a0a] border border-green-500/20 rounded-3xl p-10 md:p-14 text-center">
        <h2 className="font-serif text-3xl md:text-5xl text-white">Ready for the Best Home Services in Austin TX?</h2>
        <p className="text-neutral-400 mt-5 max-w-2xl mx-auto">Get your free, no-obligation estimate today. Maintain It Bandits LLC is your one-stop shop for lawn care, landscaping, cleaning, and more in Austin TX.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get Free Estimate <ArrowRight size={18}/></Link>
          <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400"/> {COMPANY.phone}</a>
        </div>
      </div>
    </div>
  </section>
);

export default CTASection;
