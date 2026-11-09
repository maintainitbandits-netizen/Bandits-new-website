import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY } from '../mock';
import { MAKE_READY_CHECKLIST } from '../data/makeReady';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

// Dedicated rental copy prevents the lawn-specific city template from being
// shown to people looking for make-ready or tenant turnover work.
const RentalCityDetail = ({ service, cityMeta, citySlug }) => {
  const isTurnover = service.slug === 'tenant-turnover-services';
  const label = isTurnover ? 'Tenant Turnover Services' : 'Rental Make Ready Services';
  const path = `/services/${service.slug}/${citySlug}`;
  const quote = `/contact?service=${service.slug}&city=${citySlug}`;
  const title = `${isTurnover ? 'Tenant Turnover' : 'Make Ready'} Services ${cityMeta.name}, TX | Maintain It Bandits`;
  const description = `Rental ${isTurnover ? 'turnover' : 'make-ready'} services in ${cityMeta.fullName} for property managers and landlords. Discuss your checklist, location and desired date.`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: label,
    provider: {
      '@type': 'LocalBusiness', name: COMPANY.name, telephone: COMPANY.phone,
      address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' },
    },
    areaServed: { '@type': 'City', name: cityMeta.fullName },
    description,
  };

  return (
    <div>
      <SEO title={title} description={description} path={path} image={service.image} schema={schema} />
      <Breadcrumbs items={[
        { name: 'Make Readys & Turnovers', path: '/make-ready-turnovers' },
        { name: label, path: `/services/${service.slug}` },
        { name: cityMeta.fullName, path },
      ]} />
      <section className="py-16 md:py-20 bg-[#0a0f0b] border-b border-[#1b291e]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><MapPin size={14} /> Greater Austin rental services</span>
            <h1 className="font-serif text-4xl md:text-6xl text-white mt-6 leading-tight">{label} <span className="text-green-400 italic block text-3xl md:text-4xl mt-2">in {cityMeta.fullName}</span></h1>
            <p className="text-neutral-300 mt-6 leading-relaxed text-lg">Have a rental in {cityMeta.name} that needs attention between tenants? Share your checklist, property type and desired date. We&apos;ll discuss the work and a quote with landlords and property managers.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5 text-sm text-neutral-300">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-green-400" /> Fully licensed &amp; insured</span>
              <span className="inline-flex items-center gap-2"><Clock size={16} className="text-green-400" /> Response within 24 hours</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link to={quote} className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Request a Quote <ArrowRight size={18} /></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400" /> {COMPANY.phone}</a>
            </div>
          </div>
          <img src={service.image} alt="Rental interior" className="w-full aspect-[4/3] object-cover rounded-3xl border border-[#26392a]" />
        </div>
      </section>
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="font-serif text-3xl md:text-4xl text-white">Plan your {cityMeta.name} rental turn</h2>
            <p className="text-neutral-400 mt-5 leading-relaxed">Every property needs a different scope. Cleaning, paint touch-ups, minor repairs, debris haul-off and exterior work can be discussed as part of your request. Pricing and scheduling depend on the property, scope and availability.</p>
            <p className="text-neutral-400 mt-4 leading-relaxed">For a property management request, include the number of units, access details, your checklist and any reporting requirements. If you own one rental, tell us what needs attention and when you&apos;d like the work completed.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {MAKE_READY_CHECKLIST.map(group => <div key={group.title} className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-6">
              <h3 className="text-white font-semibold">{group.title}</h3>
              <ul className="mt-4 space-y-3">{group.items.map(item => <li key={item} className="flex gap-2 text-neutral-400 text-sm leading-relaxed"><Check size={15} className="text-green-400 mt-0.5 shrink-0" />{item}</li>)}</ul>
            </div>)}
          </div>
          <p className="text-neutral-500 text-sm mt-5">The items above are examples to discuss, not a fixed package. Work is subject to the agreed scope.</p>
        </div>
      </section>
      <section className="py-16 bg-[#080808] border-y border-[#161616]">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white">Questions about a {cityMeta.name} make-ready?</h2>
          <div className="space-y-3 mt-8">
            {[
              { q: 'What information should I send?', a: 'Share the property location, type, number of units, work needed and your desired completion date. Your own checklist is welcome.' },
              { q: 'How much will it cost?', a: 'Pricing depends on the location, condition and requested scope. Contact us to discuss a custom quote.' },
              { q: 'How soon can you start?', a: 'Tell us your desired dates. We respond within 24 hours; the work schedule depends on scope and availability.' },
            ].map(f => <details key={f.q} className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-6 group"><summary className="text-white font-semibold cursor-pointer flex justify-between gap-4 list-none">{f.q}<span className="text-green-400 text-xl group-open:rotate-45">+</span></summary><p className="text-neutral-400 mt-4 leading-relaxed">{f.a}</p></details>)}
          </div>
        </div>
      </section>
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-white">Ready to discuss your rental?</h2>
          <p className="text-neutral-400 mt-4">Share your {cityMeta.name} property details and desired timeline.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
            <Link to={quote} className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Request a Quote <ArrowRight size={18} /></Link>
            <Link to="/make-ready-turnovers" className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Explore Make-Ready Services</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default RentalCityDetail;
