import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, Phone, Check, ShieldCheck, Clock, Star, DollarSign } from 'lucide-react';
import { SERVICES, COMPANY } from '../mock';
import CTASection from '../components/CTASection';

const ServiceDetail = () => {
  const { slug } = useParams();
  const svc = SERVICES.find(s => s.slug === slug);
  if (!svc) return <Navigate to="/services" replace />;

  return (
    <div>
      <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <Link to="/services" className="text-green-400 text-sm hover:underline">← All Services</Link>
            <h1 className="font-serif text-4xl md:text-6xl text-white mt-4 leading-tight">{svc.title}</h1>
            <p className="text-neutral-400 mt-5 leading-relaxed text-lg">{svc.short}</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get Free Estimate <ArrowRight size={18}/></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400"/> {COMPANY.phone}</a>
            </div>
          </div>
          <div className="relative">
            <img src={svc.image} alt={svc.title} className="w-full rounded-2xl border border-[#1a1a1a] aspect-[4/3] object-cover" />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white">About This Service</h2>
          <p className="text-neutral-300 mt-5 leading-relaxed text-lg">{svc.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-14">
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
              <h3 className="font-serif text-2xl text-white">What&apos;s Included</h3>
              <ul className="mt-5 space-y-3">
                {svc.included.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 text-neutral-200"><Check size={18} className="text-green-400 mt-1 flex-shrink-0" /> {it}</li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
              <h3 className="font-serif text-2xl text-white">Benefits</h3>
              <ul className="mt-5 space-y-3">
                {svc.benefits.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 text-neutral-200"><Check size={18} className="text-green-400 mt-1 flex-shrink-0" /> {it}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-white">Why Choose Maintain It Bandits?</h2>
            <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">Experience the difference of working with Austin&apos;s trusted lawn care and home services company.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: 'Licensed & Insured', text: 'Full coverage for your peace of mind' },
              { icon: Clock, title: 'Same Week Service', text: 'Fast scheduling when you need it' },
              { icon: Star, title: '5-Star Rated', text: 'Trusted by 500+ happy customers' },
              { icon: DollarSign, title: 'Free Estimates', text: 'No obligation quotes' },
            ].map((b, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 text-center hover:border-green-500/30 transition-colors">
                <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><b.icon className="text-green-400" size={20} /></div>
                <div className="text-white font-semibold mt-4">{b.title}</div>
                <div className="text-neutral-400 text-sm mt-2">{b.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default ServiceDetail;
