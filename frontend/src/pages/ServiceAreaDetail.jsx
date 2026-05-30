import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { MapPin, ArrowRight, Phone, Check, Home as HomeIcon } from 'lucide-react';
import { SERVICES, COMPANY, SERVICE_AREAS } from '../mock';
import { SERVICE_AREAS_DETAIL } from '../seo';
import SEO from '../components/SEO';
import CTASection from '../components/CTASection';

const ServiceAreaDetail = () => {
  const { slug } = useParams();
  const meta = SERVICE_AREAS_DETAIL[slug];
  const area = SERVICE_AREAS.find(a => a.slug === slug);
  if (!meta || !area) return <Navigate to="/service-areas" replace />;

  const title = `Lawn Care & Home Services in ${meta.fullName} | ${COMPANY.name}`;
  const description = `Professional lawn care, landscaping, fertilization, sod, property maintenance, and cleaning services in ${meta.fullName}. Serving ZIP codes ${meta.zips.slice(0,5).join(', ')}${meta.zips.length>5?'+':''}. Free estimates.`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': `${COMPANY.name} \u2013 ${meta.fullName}`,
    'image': 'https://maintainitbandits.com/images/hero-bg.jpg',
    'telephone': COMPANY.phone,
    'email': COMPANY.email,
    'priceRange': '$$',
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': meta.name,
      'addressRegion': 'TX',
      'addressCountry': 'US',
    },
    'areaServed': {
      '@type': 'City',
      'name': meta.fullName,
    },
  };

  return (
    <div>
      <SEO
        title={title}
        description={description}
        keywords={`lawn care ${meta.name} TX, landscaping ${meta.name}, lawn service ${meta.name} TX, home services ${meta.name}`}
        path={`/service-areas/${slug}`}
        schema={schema}
      />

      {/* HERO */}
      <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <Link to="/service-areas" className="text-green-400 text-sm hover:underline">← All Service Areas</Link>
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase mt-4"><MapPin size={14}/> Service Area</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Lawn Care & Home Services<br/><span className="text-green-400 italic">in {meta.fullName}</span></h1>
          <p className="text-neutral-300 mt-6 max-w-3xl mx-auto leading-relaxed text-lg">{meta.intro}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-9">
            <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get Free Estimate <ArrowRight size={18}/></Link>
            <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400"/> {COMPANY.phone}</a>
          </div>
        </div>
      </section>

      {/* SERVICES IN THIS CITY */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl text-white">Our Services in {meta.name}</h2>
            <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">{meta.landmarks}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map(s => (
              <Link key={s.slug} to={`/services/${s.slug}/${slug}`} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={s.image} alt={`${s.title} in ${meta.name} TX`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                </div>
                <div className="p-6">
                  <h3 className="text-white font-semibold text-lg">{s.title} in {meta.name}</h3>
                  <p className="text-neutral-400 text-sm mt-3 leading-relaxed">{s.short}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-green-400 font-medium text-sm">Learn More <ArrowRight size={16} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ZIP CODES */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl text-white">ZIP Codes We Service in {meta.name}</h2>
            <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">We proudly serve all {meta.zips.length} ZIP code{meta.zips.length>1?'s':''} in the {meta.fullName} area. If you don&apos;t see your ZIP listed, give us a call \u2014 we likely service your area.</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {meta.zips.map(z => (
              <div key={z} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-lg py-3 text-center text-neutral-300 font-mono text-sm hover:border-green-500/40 transition-colors">
                {z}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEIGHBORHOODS */}
      {meta.neighborhoods && meta.neighborhoods.length > 0 && (
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-5 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="font-serif text-3xl md:text-4xl text-white">Neighborhoods We Serve in {meta.name}</h2>
              <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">From master-planned communities to long-established neighborhoods, we keep yards across {meta.name} looking their best.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {meta.neighborhoods.map(n => (
                <div key={n} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-xl px-5 py-4 flex items-center gap-3 hover:border-green-500/30 transition-colors">
                  <HomeIcon size={18} className="text-green-400"/>
                  <span className="text-neutral-200">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LOCAL FACTS */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
            <h3 className="font-serif text-2xl text-white">Why {meta.name} Homeowners Choose Us</h3>
            <ul className="mt-5 space-y-3">
              {[
                `Local crews familiar with ${meta.name} soil & grass types`,
                'Licensed, insured, and trusted by 500+ Austin-area customers',
                'Reliable, on-time service \u2014 same crew when possible',
                'Eco-friendly, water-wise practices for Central Texas',
                'One company for lawn care, landscaping, & cleaning',
              ].map((it, i) => (
                <li key={i} className="flex items-start gap-3 text-neutral-200"><Check size={18} className="text-green-400 mt-1 flex-shrink-0"/> {it}</li>
              ))}
            </ul>
          </div>
          <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
            <h3 className="font-serif text-2xl text-white">Service Information</h3>
            <ul className="mt-5 space-y-4 text-sm">
              <li><div className="text-neutral-400">Service Area</div><div className="text-white">{meta.fullName} & surrounding</div></li>
              <li><div className="text-neutral-400">ZIP Codes Served</div><div className="text-white">{meta.zips.join(', ')}</div></li>
              <li><div className="text-neutral-400">Business Hours</div><div className="text-white">{COMPANY.hours}</div></li>
              <li><div className="text-neutral-400">Phone</div><a href={`tel:${COMPANY.phoneRaw}`} className="text-green-400 hover:underline">{COMPANY.phone}</a></li>
            </ul>
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default ServiceAreaDetail;
