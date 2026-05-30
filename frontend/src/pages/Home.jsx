import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, ArrowRight, Link as LinkIcon, ShieldCheck, Clock, Star, DollarSign, Check, Quote, MapPin } from 'lucide-react';
import { HERO_IMAGE, AUSTIN_SKYLINE, SERVICES, TESTIMONIALS, SERVICE_AREAS, WHY_CHOOSE, COMPANY } from '../mock';
import SEO from '../components/SEO';
import TrustBar from '../components/TrustBar';

const Badge = ({ children, icon: Icon }) => (
  <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">
    {Icon && <Icon size={14} />} {children}
  </span>
);

const Home = () => {
  const homeSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': COMPANY.name,
    'image': 'https://maintainitbandits.com/images/hero-bg.jpg',
    'telephone': COMPANY.phone,
    'email': COMPANY.email,
    'priceRange': '$$',
    'address': { '@type': 'PostalAddress', 'addressLocality': 'Austin', 'addressRegion': 'TX', 'addressCountry': 'US' },
    'areaServed': SERVICE_AREAS.map(a => a.name),
    'aggregateRating': { '@type': 'AggregateRating', 'ratingValue': '5', 'reviewCount': '500' },
  };
  return (
    <div>
      <SEO
        title="Lawn Care, Landscaping & Home Services Austin TX | Maintain It Bandits LLC"
        description="Austin TX's one-stop shop for lawn care, landscaping, cleaning, and home services. Licensed & insured. Free estimates. Serving Austin, Round Rock, Cedar Park & surrounding areas."
        keywords="lawn care Austin TX, landscaping Austin, home services Austin, lawn mowing Austin, Austin landscaper"
        path="/"
        image="https://maintainitbandits.com/images/hero-bg.jpg"
        schema={homeSchema}
      />
      {/* HERO */}
      <section className="relative overflow-hidden hero-gradient">
        <div className="absolute inset-0">
          <img src={HERO_IMAGE} alt="Professional lawn care Austin TX" className="w-full h-full object-cover opacity-70" />
        </div>
        <div className="relative max-w-6xl mx-auto px-5 lg:px-8 py-32 md:py-44 z-10">
          <div className="flex flex-col items-center text-center fade-in">
            <Badge icon={LinkIcon}>Austin TX&apos;s One-Stop Home Service Shop</Badge>
            <h1 className="font-serif text-5xl md:text-7xl text-white mt-7 leading-[1.05]">
              One Call for<br />
              <span className="text-green-400 italic">All Your Home Needs</span>
            </h1>
            <p className="text-neutral-300 max-w-2xl mt-7 text-base md:text-lg leading-relaxed">
              From lawn care and landscaping to deep cleaning services — Maintain It Bandits LLC is your Austin TX one-stop shop for everything your home needs. Licensed, insured, and committed to making your property the best on the block.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">
                Get Free Estimate <ArrowRight size={18} />
              </Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">
                <Phone size={18} className="text-green-400" /> {COMPANY.phone}
              </a>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 lg:px-8 pb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { icon: ShieldCheck, label: 'Licensed & Insured' },
              { icon: Clock, label: 'Same Week Service' },
              { icon: Star, label: '5-Star Rated' },
              { icon: DollarSign, label: 'Free Estimates' },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-10 w-10 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center">
                  <t.icon size={18} className="text-green-400" />
                </div>
                <span className="text-neutral-200 text-sm md:text-base font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <TrustBar />

      {/* SERVICES */}
      <section className="py-24 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-14">
            <Badge>Our Services</Badge>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-5">Your One-Stop Shop for Home Services</h2>
            <p className="text-neutral-400 max-w-2xl mx-auto mt-5">
              From weekly lawn mowing to deep cleaning services, Maintain It Bandits LLC handles it all. One company, one call, every service your Austin TX home needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <Link to={`/services/${s.slug}`} key={s.slug} className="svc-card group bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden flex flex-col">
                <div className="aspect-[4/3] overflow-hidden bg-[#111]">
                  <img src={s.image} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-white font-semibold text-xl">{s.title}</h3>
                  <p className="text-neutral-400 text-sm mt-3 flex-1 leading-relaxed">{s.short}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-green-400 font-medium text-sm group-hover:gap-3 transition-all">
                    Learn More <ArrowRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="py-24 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <Badge>Why Choose Us</Badge>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-5 leading-tight">Austin TX&apos;s One-Stop Home Service Company</h2>
            <p className="text-neutral-400 mt-5 leading-relaxed">
              Maintain It Bandits LLC is not just another lawn service — we are your one-stop shop for everything your Austin TX home needs. Lawn care, landscaping, cleaning, and property maintenance all under one roof.
            </p>
            <ul className="mt-8 space-y-3">
              {WHY_CHOOSE.map((w, i) => (
                <li key={i} className="flex items-start gap-3 text-neutral-200">
                  <span className="mt-0.5 h-6 w-6 rounded-full bg-green-500/15 border border-green-500/30 grid place-items-center flex-shrink-0"><Check size={14} className="text-green-400" /></span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl" />
            <img src={AUSTIN_SKYLINE} alt="Austin Texas skyline" className="relative w-full rounded-2xl border border-[#1a1a1a]" />
            <div className="absolute -bottom-6 -right-6 bg-[#0c0c0c] border border-green-500/30 rounded-2xl px-6 py-4 shadow-xl">
              <div className="text-green-400 font-bold text-3xl">500+</div>
              <div className="text-neutral-400 text-xs uppercase tracking-wider">Happy Customers</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-24 bg-[#0a0a0a]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="text-center mb-14">
            <Badge icon={Star}>Testimonials</Badge>
            <h2 className="font-serif text-4xl md:text-5xl text-white mt-5">What Austin Homeowners Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 hover:border-green-500/30 transition-colors">
                <Quote className="text-green-400" size={28} />
                <div className="flex gap-1 mt-4">
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

      {/* SERVICE AREAS */}
      <section className="py-24 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 text-center">
          <Badge icon={MapPin}>Service Areas</Badge>
          <h2 className="font-serif text-4xl md:text-5xl text-white mt-5">Serving Greater Austin TX</h2>
          <p className="text-neutral-400 max-w-2xl mx-auto mt-5">
            Maintain It Bandits LLC provides lawn care, landscaping, cleaning, and home services throughout the Austin metro area.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            {SERVICE_AREAS.map(a => (
              <Link key={a.slug} to={`/service-areas/${a.slug}`} className="px-5 py-2.5 rounded-full bg-[#0f0f0f] border border-[#1f1f1f] text-neutral-300 hover:text-green-400 hover:border-green-500/40 transition-colors text-sm">{a.name}</Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
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
    </div>
  );
};

export default Home;
