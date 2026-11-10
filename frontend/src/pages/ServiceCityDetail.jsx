import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, Phone, Check } from 'lucide-react';
import { SERVICES, COMPANY } from '../mock';
import { SERVICE_AREAS_DETAIL, SERVICE_SEO } from '../seo';
import { serviceCityIntro } from '../data/serviceCity';
import { BUSINESS_SCHEMA_ID } from '../config/site';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import RentalCityDetail from './RentalCityDetail';
import CTASection from '../components/CTASection';

// Combined Service x City page — e.g. /services/lawn-mowing/round-rock
const ServiceCityDetail = () => {
  const { slug, city } = useParams();
  const svc = SERVICES.find(s => s.slug === slug);
  const cityMeta = SERVICE_AREAS_DETAIL[city];
  if (!svc || !cityMeta) return <Navigate to="/services" replace />;
  if (svc.slug === 'make-ready-services' || svc.slug === 'tenant-turnover-services') {
    return <RentalCityDetail service={svc} cityMeta={cityMeta} citySlug={city} />;
  }

  const seo = SERVICE_SEO[slug] || {};
  const title = `${svc.title} in ${cityMeta.fullName} | ${COMPANY.name}`;
  const description = `Explore ${svc.title.toLowerCase()} in ${cityMeta.fullName}. Fully licensed and insured. Request an estimate and confirm availability for your property.`;
  const quoteLink = `/contact?service=${slug}&city=${city}`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: svc.title,
    provider: {
      '@type': 'LocalBusiness',
      '@id': BUSINESS_SCHEMA_ID,
      name: COMPANY.name,
      telephone: COMPANY.phone,
    },
    areaServed: { '@type': 'City', name: cityMeta.fullName },
    description,
  };

  return (
    <div>
      <SEO
        title={title}
        description={description}
        keywords={`${svc.title.toLowerCase()} ${cityMeta.name} TX, ${svc.title.toLowerCase()} ${cityMeta.name}, ${svc.title.toLowerCase()} near ${cityMeta.name}`}
        path={`/services/${slug}/${city}`}
        image={svc.image}
        schema={schema}
      />
      <Breadcrumbs items={[
        { name: 'Services', path: '/services' },
        { name: svc.title, path: `/services/${slug}` },
        { name: cityMeta.fullName, path: `/services/${slug}/${city}` },
      ]}/>

      {/* HERO */}
      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="font-serif text-4xl md:text-6xl text-white leading-tight">{svc.title}<br/><span className="text-green-400 italic block text-3xl md:text-4xl mt-2">in {cityMeta.fullName}</span></h1>
            <p className="text-neutral-300 mt-6 leading-relaxed text-lg">{serviceCityIntro(svc, cityMeta)}</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to={quoteLink} className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Request an Estimate <ArrowRight size={18}/></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400"/> {COMPANY.phone}</a>
            </div>
          </div>
          <div>
            <img src={svc.image} alt={`${svc.title} in ${cityMeta.fullName}`} className="w-full aspect-[4/3] object-cover rounded-2xl border border-[#1a1a1a]"/>
          </div>
        </div>
      </section>

      {/* LOCAL CONTEXT */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white">{svc.title} — Done Right for {cityMeta.name}</h2>
          <p className="text-neutral-300 mt-5 leading-relaxed text-lg">{svc.description}</p>
          <p className="text-neutral-300 mt-4 leading-relaxed text-lg">Share your property location in {cityMeta.name} and any scheduling needs so we can confirm availability and discuss your project.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
              <h3 className="font-serif text-xl text-white">Work to Discuss</h3>
              <p className="mt-3 text-neutral-400 text-sm">These are examples; the work is confirmed for your property.</p>
              <ul className="mt-4 space-y-2">
                {svc.included.map((it, i) => <li key={i} className="flex items-start gap-3 text-neutral-200 text-sm"><Check size={16} className="text-green-400 mt-1 flex-shrink-0"/> {it}</li>)}
              </ul>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
              <h3 className="font-serif text-xl text-white">Working With Maintain It Bandits</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  'Fully licensed and insured',
                  'Response within 24 hours',
                  'Quotes based on your property and work',
                  'Scheduling depends on scope and availability',
                  `Ask us to confirm service in ${cityMeta.name}`,
                ].map((it, i) => <li key={i} className="flex items-start gap-3 text-neutral-200"><Check size={16} className="text-green-400 mt-1 flex-shrink-0"/> {it}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* NEIGHBORHOODS + ZIPS */}
      <section className="py-16 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">{svc.title} Across {cityMeta.name}</h2>
          <p className="text-neutral-400 mt-4 text-center max-w-2xl mx-auto">Looking for {svc.title.toLowerCase()} in {cityMeta.fullName}? Share your property location so we can confirm availability, including for areas not listed.</p>

          {cityMeta.neighborhoods && (
            <div className="mt-8">
              <h3 className="text-neutral-300 text-sm uppercase tracking-widest text-center">Neighborhoods</h3>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {cityMeta.neighborhoods.map(n => (
                  <span key={n} className="px-4 py-2 rounded-full bg-[#0f0f0f] border border-[#1f1f1f] text-neutral-300 text-sm">{n}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-10">
            <h3 className="text-neutral-300 text-sm uppercase tracking-widest text-center">ZIP Codes in the Area</h3>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2 mt-4">
              {cityMeta.zips.map(z => (
                <div key={z} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-lg py-2 text-center text-neutral-400 font-mono text-xs">{z}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      {seo.faqs && (
        <section className="py-16">
          <div className="max-w-3xl mx-auto px-5 lg:px-8">
            <h2 className="font-serif text-3xl md:text-4xl text-white text-center">FAQs about {svc.title} in {cityMeta.name}</h2>
            <div className="mt-8 space-y-3">
              {seo.faqs.map((f, i) => (
                <details key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-5 group">
                  <summary className="cursor-pointer text-white font-medium flex justify-between items-start gap-4 list-none">
                    <span>{f.q}</span>
                    <span className="text-green-400 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
                  </summary>
                  <p className="mt-3 text-neutral-300 leading-relaxed text-sm">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* OTHER SERVICES IN THIS CITY */}
      <section className="py-16 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Other Services in {cityMeta.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {SERVICES.filter(s => s.slug !== slug).map(s => (
              <Link to={`/services/${s.slug}/${city}`} key={s.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-5 hover:border-green-500/30 transition-colors">
                <h3 className="text-white font-semibold">{s.title} in {cityMeta.name}</h3>
                <span className="mt-3 inline-flex items-center gap-2 text-green-400 text-sm">Learn More <ArrowRight size={14}/></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTASection quoteLink={quoteLink} />
    </div>
  );
};

export default ServiceCityDetail;
