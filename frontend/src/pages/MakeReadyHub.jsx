import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Building2, Check, ClipboardList, Clock, Home, KeyRound,
  MapPin, MessageSquare, Phone, ShieldCheck,
} from 'lucide-react';
import { COMPANY } from '../mock';
import {
  MAKE_READY_META, MAKE_READY_HEADLINE, MAKE_READY_INTRO, MAKE_READY_AREAS,
  MAKE_READY_AREA_INTRO, MAKE_READY_PACKAGES, MAKE_READY_CHECKLIST,
  TURN_TIMELINE, MAKE_READY_AUDIENCES, MAKE_READY_FAQS,
} from '../data/makeReady';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';

const QUOTE_LINK = '/contact?service=make-ready-services';
const Badge = ({ children, icon: Icon }) => (
  <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">
    {Icon && <Icon size={14} />} {children}
  </span>
);

const MakeReadyHub = () => {
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://www.maintainitbandits.com/make-ready-turnovers#service',
      name: 'Rental Make Ready & Tenant Turnover Services',
      serviceType: 'Rental Make Ready & Tenant Turnover Services',
      provider: {
        '@type': 'LocalBusiness',
        name: COMPANY.name,
        telephone: COMPANY.phone,
        email: COMPANY.email,
        address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' },
      },
      areaServed: MAKE_READY_AREAS.map(area => ({ '@type': 'City', name: `${area.name}, TX` })),
      description: MAKE_READY_META.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: MAKE_READY_FAQS.map(f => ({
        '@type': 'Question', name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ];

  return (
    <div>
      <SEO
        title={MAKE_READY_META.title}
        description={MAKE_READY_META.description}
        keywords={MAKE_READY_META.keywords}
        path="/make-ready-turnovers"
        image={MAKE_READY_META.image}
        imageAlt={MAKE_READY_META.imageAlt}
        schema={schemas}
      />
      <Breadcrumbs items={[{ name: 'Make Ready & Turnovers', path: '/make-ready-turnovers' }]} />

      <section className="relative overflow-hidden bg-[#080c09] border-b border-[#1b291e]">
        <div className="absolute -top-32 -left-28 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-5 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <Badge icon={KeyRound}>For landlords &amp; property managers</Badge>
            <h1 className="font-serif text-4xl sm:text-5xl text-white mt-7 leading-[1.08]">{MAKE_READY_HEADLINE}</h1>
            <p className="text-neutral-300 max-w-xl mt-6 text-base md:text-lg leading-relaxed">{MAKE_READY_INTRO}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-3 mt-6 text-sm text-neutral-200">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-green-400" /> Fully licensed &amp; insured</span>
              <span className="inline-flex items-center gap-2"><Clock size={17} className="text-green-400" /> Response within 24 hours</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-9">
              <Link to={QUOTE_LINK} className="btn-green inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full font-semibold text-sm sm:text-base whitespace-nowrap">Request a Make Ready Quote <ArrowRight size={18} /></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full font-semibold whitespace-nowrap"><Phone size={18} className="text-green-400" /> {COMPANY.phone}</a>
            </div>
            <p className="text-neutral-400 text-sm mt-5">Prefer to text? <a href={`sms:${COMPANY.phoneRaw}`} className="text-green-400 hover:underline">Send us a message</a>.</p>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl" />
            <img src={MAKE_READY_META.image} alt={MAKE_READY_META.imageAlt} className="relative w-full aspect-[4/3] object-cover rounded-3xl border border-[#314135]" />
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto bg-[#0b130d]/95 border border-green-500/30 rounded-2xl px-5 py-4 shadow-xl">
              <div className="text-green-400 text-xs uppercase tracking-widest font-semibold">Your property. Your checklist.</div>
              <div className="text-white font-medium mt-1">A quote built around the work you need.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Badge icon={Home}>Who we help</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">A smoother start for your next tenant</h2>
            <p className="text-neutral-400 mt-5 leading-relaxed">From a single rental to a list of units, start with the work that matters to you.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 mt-10">
            {MAKE_READY_AUDIENCES.map((audience, i) => {
              const Icon = i === 0 ? Building2 : Home;
              return <div key={audience.title} className="bg-[#0f0f0f] border border-[#242a24] rounded-2xl p-7 md:p-8">
                <div className="h-12 w-12 rounded-xl bg-green-500/10 border border-green-500/25 grid place-items-center"><Icon className="text-green-400" size={22} /></div>
                <h3 className="font-serif text-2xl text-white mt-5">{audience.title}</h3>
                <p className="text-neutral-400 mt-3 leading-relaxed">{audience.text}</p>
              </div>;
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#080808] border-y border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="max-w-2xl">
            <Badge icon={ClipboardList}>Make-ready work</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Tell us what your rental needs</h2>
            <p className="text-neutral-400 mt-5 leading-relaxed">Every property is different. These are examples of needs we can discuss; the work and price are confirmed for your project.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {MAKE_READY_PACKAGES.map((item, i) => (
              <div key={item.slug} className={`rounded-2xl p-7 flex flex-col border ${i === 1 ? 'bg-[#101a12] border-green-500/35' : 'bg-[#0f0f0f] border-[#242a24]'}`}>
                <span className="text-green-400 text-xs tracking-widest uppercase">0{i + 1} / Scope</span>
                <h3 className="font-serif text-2xl text-white mt-4">{item.name}</h3>
                <p className="text-neutral-400 text-sm mt-2">{item.tagline}</p>
                <ul className="space-y-3 mt-6 flex-1">
                  {item.features.map(feature => <li key={feature} className="flex gap-3 text-neutral-200 text-sm leading-relaxed"><Check size={16} className="text-green-400 mt-0.5 shrink-0" />{feature}</li>)}
                </ul>
                <Link to={QUOTE_LINK} className="mt-7 inline-flex items-center gap-2 text-green-400 font-semibold text-sm hover:text-green-300">Discuss this work <ArrowRight size={15} /></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Badge>Build your scope</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">A practical make-ready checklist</h2>
            <p className="text-neutral-400 mt-5 leading-relaxed">Use your own checklist or tell us which items you need. Work is subject to the agreed scope.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-10">
            {MAKE_READY_CHECKLIST.map(group => (
              <div key={group.title} className="bg-[#0f0f0f] border border-[#222] rounded-2xl p-6">
                <h3 className="text-white font-semibold text-lg">{group.title}</h3>
                <ul className="mt-4 space-y-3">{group.items.map(item => <li key={item} className="flex gap-2 text-neutral-400 text-sm leading-relaxed"><Check size={15} className="text-green-400 mt-0.5 shrink-0" />{item}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="text-neutral-500 text-sm mt-6 text-center">Have specialized or licensed-trade work? Include it in your request so the requirements can be discussed.</p>
        </div>
      </section>

      <section className="py-20 bg-[#080808] border-y border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-10 lg:gap-16">
          <div>
            <Badge icon={Clock}>How it works</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">A clear plan for your next turn</h2>
            <p className="text-neutral-400 mt-5 leading-relaxed">Send the details you have, including your requested deadline. We&apos;ll discuss the scope and availability before work is scheduled.</p>
            <Link to={QUOTE_LINK} className="mt-8 inline-flex items-center gap-2 text-green-400 font-semibold hover:text-green-300">Start your request <ArrowRight size={16} /></Link>
          </div>
          <div className="space-y-4">
            {TURN_TIMELINE.map(step => (
              <div key={step.step} className="flex gap-5 p-5 sm:p-6 rounded-2xl bg-[#0f0f0f] border border-[#242a24]">
                <span className="text-green-400 font-mono text-sm pt-1">{step.step}</span>
                <div><h3 className="text-white font-semibold">{step.title}</h3><p className="text-neutral-400 text-sm leading-relaxed mt-2">{step.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20" id="service-areas">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 text-center">
          <Badge icon={MapPin}>Service area</Badge>
          <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Make-readys across greater Austin</h2>
          <p className="text-neutral-400 max-w-2xl mx-auto mt-5 leading-relaxed">{MAKE_READY_AREA_INTRO}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            {MAKE_READY_AREAS.map(area => area.hasPage ? (
              <Link key={area.slug} to={`/services/make-ready-services/${area.slug}`} className="px-4 py-2.5 rounded-full bg-[#0f0f0f] border border-[#292929] text-neutral-200 hover:text-green-400 hover:border-green-500/40 transition-colors text-sm">{area.name}, TX</Link>
            ) : <span key={area.slug} className="px-4 py-2.5 rounded-full bg-[#0f0f0f] border border-[#292929] text-neutral-200 text-sm">{area.name}, TX</span>)}
          </div>
          <p className="text-neutral-400 text-sm mt-6">Nearby but not listed? <Link to={QUOTE_LINK} className="text-green-400 hover:underline">Ask us about your location.</Link></p>
        </div>
      </section>

      <section className="py-20 bg-[#080808] border-y border-[#161616]">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <div className="text-center"><Badge>Common questions</Badge><h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Make-ready questions, answered</h2></div>
          <div className="space-y-3 mt-10">
            {MAKE_READY_FAQS.map(f => (
              <details key={f.q} className="bg-[#0f0f0f] border border-[#242a24] rounded-2xl p-6 group">
                <summary className="cursor-pointer text-white font-semibold flex justify-between items-start gap-4 list-none"><span>{f.q}</span><span className="text-green-400 group-open:rotate-45 transition-transform text-2xl leading-none">+</span></summary>
                <p className="mt-4 text-neutral-400 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="grid md:grid-cols-2 gap-5">
            {[{ title: 'Rental make-ready services', to: '/services/make-ready-services', text: 'Explore work that can help prepare a rental between tenants.' }, { title: 'Tenant turnover services', to: '/services/tenant-turnover-services', text: 'Discuss a turnover for a single property or several units.' }].map(item => (
              <Link to={item.to} key={item.to} className="bg-[#0f0f0f] border border-[#242a24] rounded-2xl p-7 hover:border-green-500/40 transition-colors">
                <h3 className="font-serif text-2xl text-white">{item.title}</h3><p className="text-neutral-400 text-sm mt-3">{item.text}</p><span className="inline-flex gap-2 items-center text-green-400 text-sm font-semibold mt-5">Learn more <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
          <div className="mt-12 bg-gradient-to-br from-[#122217] to-[#0a0a0a] border border-green-500/25 rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="font-serif text-3xl md:text-5xl text-white">Have a rental that needs attention?</h2>
            <p className="text-neutral-400 max-w-xl mx-auto mt-4 leading-relaxed">Tell us the city, property type, work needed and your target date. We&apos;ll respond within 24 hours.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-8">
              <Link to={QUOTE_LINK} className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Request a Quote <ArrowRight size={18} /></Link>
              <a href={`sms:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><MessageSquare size={18} className="text-green-400" /> Text Us</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MakeReadyHub;
