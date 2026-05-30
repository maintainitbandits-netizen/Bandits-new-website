import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { SERVICE_AREAS, COMPANY } from '../mock';
import { SERVICE_AREAS_DETAIL } from '../seo';
import SEO from '../components/SEO';
import CTASection from '../components/CTASection';

const ServiceAreas = () => (
  <div>
    <SEO
      title="Service Areas | Lawn Care & Home Services Austin TX | Maintain It Bandits LLC"
      description="Maintain It Bandits LLC proudly serves Austin, Round Rock, Cedar Park, Georgetown, Pflugerville, Leander, Bee Cave, West Lake Hills, Lakeway, and Dripping Springs with professional lawn care and home services."
      keywords="lawn care service areas Austin TX, Round Rock lawn care, Cedar Park landscaping, Georgetown lawn service, Austin metro lawn care"
      path="/service-areas"
    />
    <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><MapPin size={14}/> Service Areas</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Serving Greater Austin TX</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Maintain It Bandits LLC proudly provides lawn care, landscaping, cleaning and home services across the Austin metro area. Click any city below to see the ZIP codes and neighborhoods we serve.</p>
      </div>
    </section>

    <section className="py-20">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICE_AREAS.map(a => {
          const detail = SERVICE_AREAS_DETAIL[a.slug];
          return (
            <Link to={`/service-areas/${a.slug}`} key={a.slug} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 hover:border-green-500/40 hover:-translate-y-1 transition-all block">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><MapPin size={18} className="text-green-400" /></div>
                <h3 className="text-white font-semibold text-lg">{a.name}</h3>
              </div>
              {detail && (
                <>
                  <p className="text-neutral-400 text-sm mt-4 leading-relaxed line-clamp-3">{detail.intro}</p>
                  <div className="mt-4 text-xs text-neutral-500 font-mono">
                    {detail.zips.slice(0, 6).join(' \u00b7 ')}{detail.zips.length > 6 && ' \u00b7 ...'}
                  </div>
                  <div className="mt-3 text-xs text-green-400/80">{detail.zips.length} ZIP code{detail.zips.length>1?'s':''} served</div>
                </>
              )}
              <span className="mt-5 inline-flex items-center gap-2 text-green-400 text-sm font-medium">View details <ArrowRight size={16}/></span>
            </Link>
          );
        })}
      </div>
    </section>

    <CTASection />
  </div>
);

export default ServiceAreas;
