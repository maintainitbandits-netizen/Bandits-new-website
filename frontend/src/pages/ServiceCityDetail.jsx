import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, Phone, Check, MapPin, ShieldCheck, Clock, Star, DollarSign } from 'lucide-react';
import { SERVICES, SERVICE_AREAS, COMPANY } from '../mock';
import { SERVICE_AREAS_DETAIL, SERVICE_SEO } from '../seo';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

// Combined Service x City page — e.g. /services/lawn-mowing/round-rock
const ServiceCityDetail = () => {
  const { slug, city } = useParams();
  const svc = SERVICES.find(s => s.slug === slug);
  const cityMeta = SERVICE_AREAS_DETAIL[city];
  if (!svc || !cityMeta) return <Navigate to="/services" replace />;

  const seo = SERVICE_SEO[slug] || {};
  const title = `${svc.title} in ${cityMeta.fullName} | ${COMPANY.name}`;
  const description = `Professional ${svc.title.toLowerCase()} in ${cityMeta.fullName}. Licensed, insured, 5-star rated. Serving ZIPs ${cityMeta.zips.slice(0,3).join(', ')}${cityMeta.zips.length>3?'+':''}. Free estimates.`;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: svc.title,
    provider: {
      '@type': 'LocalBusiness',
      name: COMPANY.name,
      telephone: COMPANY.phone,
      address: { '@type': 'PostalAddress', addressLocality: cityMeta.name, addressRegion: 'TX', addressCountry: 'US' },
    },
    areaServed: { '@type': 'City', name: cityMeta.fullName },
    description,
  };

  return (
    <div>
      <SEO
        title={title}
        description={description}
        keywords={`${svc.title.toLowerCase()} ${cityMeta.name} TX, ${slug} ${cityMeta.name}, lawn service ${cityMeta.name}, ${svc.title} near me`}
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
            <p className="text-neutral-300 mt-6 leading-relaxed text-lg">Reliable, professional {svc.title.toLowerCase()} for {cityMeta.fullName} homeowners. {cityMeta.intro}</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get Free Estimate <ArrowRight size={18}/></Link>
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
          <p className="text-neutral-300 mt-4 leading-relaxed text-lg">{cityMeta.landmarks} Our crews know the local soil, climate, and grass types unique to {cityMeta.name} — which means better results from day one.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
              <h3 className="font-serif text-xl text-white">What&apos;s Included</h3>
              <ul className="mt-4 space-y-2">
                {svc.included.map((it, i) => <li key={i} className="flex items-start gap-3 text-neutral-200 text-sm"><Check size={16} className="text-green-400 mt-1 flex-shrink-0"/> {it}</li>)}
              </ul>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
              <h3 className="font-serif text-xl text-white">Why {cityMeta.name} Picks Us</h3>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  `Local crews familiar with ${cityMeta.name}`,
                  `Licensed, insured, & 5-star rated`,
                  `Same-week scheduling`,
                  `Eco-friendly, water-wise approach`,
                  `Trusted by 500+ Austin-area customers`,
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
          <p className="text-neutral-400 mt-4 text-center max-w-2xl mx-auto">We provide {svc.title.toLowerCase()} throughout {cityMeta.fullName}. Don’t see your area listed? Give us a call.</p>

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
            <h3 className="text-neutral-300 text-sm uppercase tracking-widest text-center">ZIP Codes Served</h3>
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

      <CTASection />
    </div>
  );
};

export default ServiceCityDetail;
