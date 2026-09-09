import React from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, ArrowRight, Check, Star, ShieldCheck, Clock, Camera, FileCheck,
  Building2, KeyRound, Home as HomeIcon, CalendarCheck, Sparkles, Users,
} from 'lucide-react';
import { COMPANY, SERVICE_AREAS } from '../mock';
import {
  MAKE_READY_PACKAGES, MAKE_READY_CHECKLIST, TURN_TIMELINE,
  MAKE_READY_AUDIENCES, MAKE_READY_TESTIMONIALS, MAKE_READY_FAQS,
} from '../data/makeReady';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

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
      areaServed: SERVICE_AREAS.map(a => a.name),
      description:
        'Complete make ready and tenant turnover services for Austin TX landlords and property managers — deep cleaning, paint touch-ups, repairs, junk haul-off, and curb appeal refresh. One crew, one invoice, rent-ready in days.',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '295',
        highPrice: '2500',
        offerCount: '3',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: MAKE_READY_FAQS.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.maintainitbandits.com/' },
        { '@type': 'ListItem', position: 2, name: 'Make Ready & Turnover Services', item: 'https://www.maintainitbandits.com/make-ready-turnovers' },
      ],
    },
  ];

  return (
    <div>
      <SEO
        title="Make Ready & Tenant Turnover Services Austin TX | Landlord & Property Manager Specialists | Maintain It Bandits LLC"
        description="Austin TX's one-call make ready & tenant turnover company. Deep cleaning, paint touch-ups, repairs, haul-off & curb appeal — one crew, one invoice, rent-ready in 48–72 hours. Free estimates. Call (512) 518-1558."
        keywords="make ready services Austin TX, tenant turnover services Austin TX, make ready cleaning Austin, rental make ready company Austin, property turnover services Austin, apartment make ready Round Rock, landlord services Austin TX, turnover cleaning Austin"
        path="/make-ready-turnovers"
        image="/gallery/service-make-ready.jpg"
        schema={schemas}
      />
      <Breadcrumbs items={[{ name: 'Make Ready & Turnovers', path: '/make-ready-turnovers' }]} />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/gallery/service-make-ready.jpg" alt="Freshly completed make ready apartment in Austin TX" className="w-full h-full object-cover opacity-30" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/70 via-[#0a0a0a]/85 to-[#0a0a0a]" />
        <div className="relative max-w-6xl mx-auto px-5 lg:px-8 py-24 md:py-32">
          <div className="flex flex-col items-center text-center">
            <Badge icon={KeyRound}>For Landlords & Property Managers</Badge>
            <h1 className="font-serif text-4xl md:text-6xl text-white mt-6 leading-[1.08]">
              Make Ready & Tenant Turnover Services<br />
              <span className="text-green-400 italic">in Austin, TX</span>
            </h1>
            <p className="text-neutral-300 max-w-3xl mt-7 text-base md:text-lg leading-relaxed">
              One call turns your rental. Deep cleaning, paint touch-ups, minor repairs, junk haul-off, and full curb-appeal refresh — handled by one licensed & insured crew with photo documentation on every line item. Rent-ready in <strong className="text-green-400">as little as 48–72 hours</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get a Free Make Ready Quote <ArrowRight size={18} /></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400" /> {COMPANY.phone}</a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-14 w-full max-w-4xl">
              {[
                { icon: Clock, label: '48–72 Hr Turnarounds' },
                { icon: Camera, label: 'Photo Proof, Every Job' },
                { icon: ShieldCheck, label: 'Licensed & Insured (COI)' },
                { icon: FileCheck, label: 'One Crew, One Invoice' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 justify-center">
                  <t.icon size={18} className="text-green-400 flex-shrink-0" />
                  <span className="text-neutral-200 text-sm font-medium">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHO WE SERVE */}
      <section className="py-20 bg-[#080808] border-b border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <Badge icon={Users}>Who We Serve</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Built for People Who Own &amp; Manage Rentals</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: HomeIcon, ...MAKE_READY_AUDIENCES[0] },
              { icon: Building2, ...MAKE_READY_AUDIENCES[1] },
              { icon: KeyRound, ...MAKE_READY_AUDIENCES[2] },
              { icon: CalendarCheck, ...MAKE_READY_AUDIENCES[3] },
            ].map((a, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 hover:border-green-500/30 transition-colors">
                <div className="h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><a.icon className="text-green-400" size={20} /></div>
                <h3 className="text-white font-semibold text-lg mt-4">{a.title}</h3>
                <p className="text-neutral-400 text-sm mt-3 leading-relaxed">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <Badge icon={Sparkles}>Make Ready Packages</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Straightforward Make Ready Pricing</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto mt-5">Every property is different, so every quote is free and itemized. These are the typical ranges Austin landlords pay — no hidden fees, no surprises.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MAKE_READY_PACKAGES.map(p => (
              <div key={p.slug} className={`relative bg-[#0f0f0f] border rounded-2xl p-7 flex flex-col ${p.badge ? 'border-green-500/40 shadow-xl shadow-green-500/10' : 'border-[#1c1c1c]'}`}>
                {p.badge && <span className="absolute -top-3 left-1/2 -translate-x-1/2 btn-green px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase"><Star size={10} className="inline -mt-0.5 mr-1" />{p.badge}</span>}
                <h3 className="font-serif text-2xl text-white">{p.name}</h3>
                <p className="text-green-400 text-sm font-medium mt-1">{p.tagline}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-green-400">{p.price}</span>
                  <span className="text-neutral-500 text-sm">{p.unit}</span>
                </div>
                <p className="text-neutral-500 text-xs mt-3 leading-relaxed">{p.best}</p>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-neutral-200 text-sm"><Check size={16} className="text-green-400 mt-0.5 flex-shrink-0" /> {f}</li>
                  ))}
                </ul>
                <Link to="/contact" className="mt-7 w-full btn-green inline-flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm">Get Quote <ArrowRight size={14} /></Link>
              </div>
            ))}
          </div>
          <p className="text-center text-neutral-500 text-xs mt-6">Typical Austin-market ranges. Final pricing depends on unit size, condition, and scope — every estimate is free and itemized before any work begins.</p>
        </div>
      </section>

      {/* CHECKLIST */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <Badge icon={FileCheck}>The Full Scope</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">What&apos;s Included in a Bandits Make Ready</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto mt-5">Use our standard scope or hand us yours. Either way, every line item gets checked off — and photographed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MAKE_READY_CHECKLIST.map((group, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
                <h3 className="font-serif text-xl text-white">{group.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {group.items.map((it, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-neutral-300 text-sm leading-relaxed"><Check size={15} className="text-green-400 mt-0.5 flex-shrink-0" /> {it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TIMELINE */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <Badge icon={Clock}>Turnover Timeline</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">From Move-Out to Rent-Ready in Days</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto mt-5">The average DIY or multi-vendor turnover takes 2–3 weeks. Here&apos;s how we compress it.</p>
          </div>
          <div className="space-y-4">
            {TURN_TIMELINE.map((t, i) => (
              <div key={i} className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6">
                <div className="md:w-32 flex-shrink-0">
                  <span className="btn-green inline-block px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase">{t.step}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{t.title}</h3>
                  <p className="text-neutral-400 text-sm mt-1.5 leading-relaxed">{t.text}</p>
                </div>
                {i === TURN_TIMELINE.length - 1 && <Sparkles className="text-green-400 hidden md:block" size={28} />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY LANDLORDS CHOOSE US */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge>Why Property Managers Switch</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5 leading-tight">Stop Juggling Vendors. Start Leasing Faster.</h2>
            <ul className="mt-8 space-y-4">
              {[
                'One crew, one schedule, one invoice — cleaning, repairs, paint, haul-off, and lawn in a single coordinated turn',
                '48–72 hour turnarounds shrink vacancy loss on every unit',
                'Before-and-after photo reports on every line item — perfect for owner reporting and deposit files',
                'We work from your make-ready checklist or build one with you for consistent results',
                'COI available, net-terms invoicing, and reserved month-end capacity for portfolios',
                'Volume pricing for property managers with recurring move-outs',
              ].map((w, i) => (
                <li key={i} className="flex items-start gap-3 text-neutral-200 leading-relaxed">
                  <span className="mt-0.5 h-6 w-6 rounded-full bg-green-500/15 border border-green-500/30 grid place-items-center flex-shrink-0"><Check size={14} className="text-green-400" /></span>
                  {w}
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Schedule Your Next Turn <ArrowRight size={18} /></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400" /> {COMPANY.phone}</a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl" />
            <img src="/gallery/service-turnover.jpg" alt="Professional turnover crew deep cleaning a rental unit in Austin TX" className="relative w-full rounded-2xl border border-[#1a1a1a]" />
            <div className="absolute -bottom-6 -right-6 bg-[#0c0c0c] border border-green-500/30 rounded-2xl px-6 py-4 shadow-xl">
              <div className="text-green-400 font-bold text-3xl">2–4 Days</div>
              <div className="text-neutral-400 text-xs uppercase tracking-wider">Typical Full Turn</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-12">
            <Badge icon={Star}>Trusted By Austin Landlords & Managers</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">What Property People Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {MAKE_READY_TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 hover:border-green-500/30 transition-colors">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} size={16} className="text-green-400 fill-green-400" />)}
                </div>
                <p className="text-neutral-300 italic mt-5 leading-relaxed">&quot;{t.text}&quot;</p>
                <div className="mt-6 pt-5 border-t border-[#1c1c1c]">
                  <div className="text-white font-semibold">{t.name}</div>
                  <div className="text-neutral-500 text-sm">{t.location}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICE PAGES */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-10">
            <Badge>Explore Both Services</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Make Readys &amp; Turnovers, In Depth</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/services/make-ready-services" className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
              <div className="aspect-[16/9] overflow-hidden">
                <img src="/gallery/service-make-ready.jpg" alt="Rental make ready services Austin TX" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="p-6">
                <h3 className="text-white font-semibold text-xl">Rental Make Ready Services</h3>
                <p className="text-neutral-400 text-sm mt-3 leading-relaxed">The complete unit turn: deep cleaning, paint touch-ups, repairs, appliance detailing, haul-off, and curb appeal — with photo documentation.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-green-400 font-medium text-sm group-hover:gap-3 transition-all">Learn More <ArrowRight size={16} /></span>
              </div>
            </Link>
            <Link to="/services/tenant-turnover-services" className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
              <div className="aspect-[16/9] overflow-hidden">
                <img src="/gallery/service-turnover.jpg" alt="Tenant turnover services Austin TX" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              </div>
              <div className="p-6">
                <h3 className="text-white font-semibold text-xl">Tenant Turnover Services</h3>
                <p className="text-neutral-400 text-sm mt-3 leading-relaxed">The full move-out-to-move-in process handled by one coordinated crew — built for property managers with single units or entire portfolios.</p>
                <span className="mt-5 inline-flex items-center gap-2 text-green-400 font-medium text-sm group-hover:gap-3 transition-all">Learn More <ArrowRight size={16} /></span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* SERVICE AREAS */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 text-center">
          <Badge>Make Ready Service Areas</Badge>
          <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Make Readys Across Greater Austin</h2>
          <p className="text-neutral-400 max-w-2xl mx-auto mt-5">
            We turn rental units throughout the Austin metro — one crew covers every city, so your whole portfolio works with one vendor.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            {SERVICE_AREAS.map(a => (
              <Link key={a.slug} to={`/services/make-ready-services/${a.slug}`} className="px-5 py-2.5 rounded-full bg-[#0f0f0f] border border-[#1f1f1f] text-neutral-300 hover:text-green-400 hover:border-green-500/40 transition-colors text-sm">Make Readys in {a.name}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-4xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-10">
            <Badge>Make Ready FAQs</Badge>
            <h2 className="font-serif text-3xl md:text-5xl text-white mt-5">Make Ready &amp; Turnover Questions</h2>
          </div>
          <div className="space-y-4">
            {MAKE_READY_FAQS.map((f, i) => (
              <details key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 group">
                <summary className="cursor-pointer text-white font-semibold flex justify-between items-center list-none">
                  <span>{f.q}</span>
                  <span className="text-green-400 group-open:rotate-45 transition-transform text-2xl leading-none">+</span>
                </summary>
                <p className="mt-4 text-neutral-300 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default MakeReadyHub;
