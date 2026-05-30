import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, Phone, Check, ShieldCheck, Clock, Star, DollarSign, MapPin } from 'lucide-react';
import { SERVICES, COMPANY, SERVICE_AREAS } from '../mock';
import { SERVICE_SEO } from '../seo';
import SEO from '../components/SEO';
import CTASection from '../components/CTASection';

const ServiceDetail = () => {
  const { slug } = useParams();
  const svc = SERVICES.find(s => s.slug === slug);
  if (!svc) return <Navigate to="/services" replace />;
  const seo = SERVICE_SEO[slug] || {};

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    'serviceType': svc.title,
    'provider': {
      '@type': 'LocalBusiness',
      'name': COMPANY.name,
      'telephone': COMPANY.phone,
      'email': COMPANY.email,
      'areaServed': 'Austin TX',
    },
    'description': svc.description,
    'areaServed': SERVICE_AREAS.map(a => a.name),
  };

  return (
    <div>
      <SEO
        title={seo.metaTitle}
        description={seo.metaDesc}
        keywords={seo.keywords}
        path={`/services/${slug}`}
        image={svc.image}
        schema={schema}
      />

      {/* HERO */}
      <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <Link to="/services" className="text-green-400 text-sm hover:underline">← All Services</Link>
            <h1 className="font-serif text-4xl md:text-6xl text-white mt-4 leading-tight">{svc.title} <span className="text-green-400 italic block text-3xl md:text-4xl mt-2">in Austin, TX</span></h1>
            <p className="text-neutral-400 mt-5 leading-relaxed text-lg">{svc.short}</p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get Free Estimate <ArrowRight size={18}/></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400"/> {COMPANY.phone}</a>
            </div>
          </div>
          <div className="relative">
            <img src={svc.image} alt={`${svc.title} in Austin TX`} className="w-full rounded-2xl border border-[#1a1a1a] aspect-[4/3] object-cover" />
          </div>
        </div>
      </section>

      {/* OVERVIEW */}
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

      {/* SEO LONG-FORM CONTENT */}
      {seo.longContent && (
        <section className="py-20 bg-[#080808]">
          <div className="max-w-4xl mx-auto px-5 lg:px-8 space-y-12">
            {seo.longContent.map((block, i) => (
              <article key={i} className="prose-invert">
                <h2 className="font-serif text-3xl md:text-4xl text-white">{block.heading}</h2>
                <p className="text-neutral-300 mt-4 leading-relaxed text-lg">{block.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* SERVICE AREA CHIPS */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">{svc.title} Across Greater Austin</h2>
          <p className="text-neutral-400 mt-4 max-w-2xl mx-auto text-center">We provide {svc.title.toLowerCase()} services throughout the Austin metro area:</p>
          <div className="flex flex-wrap justify-center gap-3 mt-9">
            {SERVICE_AREAS.map(a => (
              <Link key={a.slug} to={`/service-areas/${a.slug}`} className="px-5 py-2.5 rounded-full bg-[#0f0f0f] border border-[#1f1f1f] text-neutral-300 hover:text-green-400 hover:border-green-500/40 transition-colors text-sm inline-flex items-center gap-2">
                <MapPin size={14}/> {a.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      {seo.faqs && (
        <section className="py-20 bg-[#080808]">
          <div className="max-w-4xl mx-auto px-5 lg:px-8">
            <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Frequently Asked Questions</h2>
            <div className="mt-10 space-y-4">
              {seo.faqs.map((f, i) => (
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
      )}

      {/* WHY CHOOSE */}
      <section className="py-20">
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

      {/* RELATED SERVICES */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Explore Our Other Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {SERVICES.filter(s => s.slug !== slug).slice(0, 3).map(s => (
              <Link to={`/services/${s.slug}`} key={s.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={s.image} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                </div>
                <div className="p-6">
                  <h3 className="text-white font-semibold text-lg">{s.title}</h3>
                  <span className="mt-3 inline-flex items-center gap-2 text-green-400 font-medium text-sm">Learn More <ArrowRight size={16} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default ServiceDetail;
