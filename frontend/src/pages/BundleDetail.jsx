import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Phone, Check, Package, Star, ShieldCheck, Clock } from 'lucide-react';
import { BUNDLES } from '../data/bundles';
import { SERVICES, COMPANY } from '../mock';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const BundleDetail = () => {
  const { slug } = useParams();
  const bundle = BUNDLES.find(b => b.slug === slug);
  if (!bundle) return <Navigate to="/bundles" replace />;

  const includedServices = bundle.services.map(s => SERVICES.find(svc => svc.slug === s)).filter(Boolean);
  const otherBundles = BUNDLES.filter(b => b.slug !== slug).slice(0, 2);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: bundle.name,
    description: bundle.description,
    image: bundle.image,
    brand: { '@type': 'Brand', name: COMPANY.name },
    offers: {
      '@type': 'Offer',
      price: bundle.bundlePrice,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <div>
      <SEO
        title={`${bundle.name} | Save $${bundle.savings} | Maintain It Bandits LLC Austin TX`}
        description={`${bundle.description.slice(0, 155)}...`}
        keywords={`${bundle.name.toLowerCase()} Austin TX, lawn care bundle, save on lawn service`}
        path={`/bundles/${slug}`}
        image={bundle.image}
        schema={schema}
      />
      <Breadcrumbs items={[
        { name: 'Bundles', path: '/bundles' },
        { name: bundle.name, path: `/bundles/${slug}` },
      ]}/>

      {/* HERO */}
      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <Link to="/bundles" className="text-green-400 text-sm inline-flex items-center gap-2 hover:underline"><ArrowLeft size={14}/> All Bundles</Link>
            <div className="flex items-center gap-2 mt-4">
              <span className="chip inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs tracking-widest font-medium uppercase"><Package size={12}/> Bundle</span>
              {bundle.featured && <span className="btn-green px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-1"><Star size={10}/> Most Popular</span>}
            </div>
            <h1 className="font-serif text-4xl md:text-6xl text-white mt-5 leading-tight">{bundle.name}</h1>
            <p className="text-green-400 italic text-lg mt-2">{bundle.tagline}</p>
            <p className="text-neutral-300 mt-5 leading-relaxed">{bundle.description}</p>

            <div className="mt-7 p-6 bg-[#0f0f0f] border border-green-500/30 rounded-2xl">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-green-400 font-bold text-4xl md:text-5xl">${bundle.bundlePrice.toLocaleString()}</span>
                <span className="text-neutral-500 line-through text-lg">${bundle.regularPrice.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span className="chip px-3 py-1 rounded-full text-green-400 font-semibold">Save ${bundle.savings}</span>
                <span className="text-neutral-500">{bundle.duration}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Link to="/contact" className="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Get This Bundle <ArrowRight size={18}/></Link>
              <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold"><Phone size={18} className="text-green-400"/> {COMPANY.phone}</a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl"/>
            <img src={bundle.image} alt={bundle.name} className="relative w-full aspect-[4/3] object-cover rounded-2xl border border-[#1a1a1a]"/>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-5 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
              <h2 className="font-serif text-2xl md:text-3xl text-white">Everything Included</h2>
              <ul className="mt-5 space-y-3">
                {bundle.includes.map((it, i) => (
                  <li key={i} className="flex items-start gap-3 text-neutral-200"><Check size={18} className="text-green-400 mt-1 flex-shrink-0"/> {it}</li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7">
              <h2 className="font-serif text-2xl md:text-3xl text-white">Ideal For</h2>
              <p className="text-neutral-300 mt-4 leading-relaxed">{bundle.idealFor}</p>

              <h3 className="text-white font-semibold mt-7">Why Bundle?</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-start gap-2 text-neutral-300"><Check size={14} className="text-green-400 mt-1 flex-shrink-0"/> Save ${bundle.savings} vs booking services separately</li>
                <li className="flex items-start gap-2 text-neutral-300"><Check size={14} className="text-green-400 mt-1 flex-shrink-0"/> One coordinated schedule, one invoice</li>
                <li className="flex items-start gap-2 text-neutral-300"><Check size={14} className="text-green-400 mt-1 flex-shrink-0"/> Priority booking & dedicated crew</li>
                <li className="flex items-start gap-2 text-neutral-300"><Check size={14} className="text-green-400 mt-1 flex-shrink-0"/> Cancel or pause anytime — no long contracts</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES IN THIS BUNDLE */}
      <section className="py-20 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Services in This Bundle</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            {includedServices.map(s => (
              <Link to={`/services/${s.slug}`} key={s.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={s.image} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy"/>
                </div>
                <div className="p-5">
                  <h3 className="text-white font-semibold">{s.title}</h3>
                  <span className="mt-3 inline-flex items-center gap-2 text-green-400 text-sm">Learn More <ArrowRight size={14}/></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: ShieldCheck, title: 'Licensed & Insured', text: 'Full coverage for every job' },
            { icon: Clock, title: 'Flexible Scheduling', text: 'Pause, cancel, or adjust anytime' },
            { icon: Star, title: '5-Star Rated', text: 'Trusted by 500+ Austin homeowners' },
          ].map((t, i) => (
            <div key={i} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-6 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><t.icon className="text-green-400" size={20}/></div>
              <div className="text-white font-semibold mt-4">{t.title}</div>
              <div className="text-neutral-400 text-sm mt-1">{t.text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* OTHER BUNDLES */}
      <section className="py-16 bg-[#080808]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-3xl md:text-4xl text-white text-center">Explore Other Bundles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
            {otherBundles.map(b => (
              <Link to={`/bundles/${b.slug}`} key={b.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group hover:border-green-500/30 transition-colors">
                <div className="aspect-[16/9] overflow-hidden">
                  <img src={b.image} alt={b.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy"/>
                </div>
                <div className="p-5">
                  <h3 className="text-white font-semibold">{b.name}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-green-400 font-bold text-xl">${b.bundlePrice.toLocaleString()}</span>
                    <span className="text-neutral-500 line-through text-sm">${b.regularPrice.toLocaleString()}</span>
                  </div>
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

export default BundleDetail;
