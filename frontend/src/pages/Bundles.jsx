import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, Check, Star } from 'lucide-react';
import { BUNDLES } from '../data/bundles';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const Bundles = () => (
  <div>
    <SEO
      title="Service Bundles & Combo Pricing | Save 15-20% | Maintain It Bandits LLC"
      description="Combine lawn care, landscaping, fertilization, and cleaning services to save 15-20%. Austin TX bundle pricing for homeowners who want one company to handle it all."
      keywords="lawn care bundle Austin, landscape bundle Austin TX, home service combo, save on lawn care Austin"
      path="/bundles"
    />
    <Breadcrumbs items={[{ name: 'Bundles', path: '/bundles' }]}/>

    <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><Package size={14}/> Bundles & Combos</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Save by Bundling Services</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Combine the services you need into one package and save 15–20% vs booking individually. One company, one quote, one schedule — your Austin home, fully handled.</p>
      </div>
    </section>

    <section className="py-16">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {BUNDLES.map(b => (
          <Link to={`/bundles/${b.slug}`} key={b.slug} className={`svc-card bg-[#0f0f0f] border rounded-2xl overflow-hidden group ${b.featured ? 'border-green-500/40 shadow-xl shadow-green-500/10' : 'border-[#1c1c1c]'}`}>
            <div className="aspect-[16/9] overflow-hidden relative">
              <img src={b.image} alt={b.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
              {b.featured && (
                <span className="absolute top-3 left-3 btn-green px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-1"><Star size={10}/> Most Popular</span>
              )}
              <span className="absolute top-3 right-3 bg-[#0a0a0a]/85 backdrop-blur text-green-400 px-3 py-1.5 rounded-full text-xs font-bold border border-green-500/40">Save ${b.savings}</span>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-2xl text-white">{b.name}</h2>
              </div>
              <p className="text-green-400 text-sm italic mt-1">{b.tagline}</p>
              <p className="text-neutral-400 text-sm mt-3 leading-relaxed line-clamp-2">{b.description}</p>

              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-green-400 font-bold text-3xl">${b.bundlePrice.toLocaleString()}</span>
                <span className="text-neutral-500 line-through text-sm">${b.regularPrice.toLocaleString()}</span>
                <span className="text-neutral-500 text-xs">{b.duration}</span>
              </div>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {b.includes.slice(0, 3).map((it, i) => (
                  <span key={i} className="text-xs text-neutral-400 flex items-center gap-1"><Check size={12} className="text-green-400"/> {it.split('(')[0].trim()}</span>
                ))}
                {b.includes.length > 3 && <span className="text-xs text-neutral-500">+{b.includes.length - 3} more</span>}
              </div>

              <span className="mt-5 inline-flex items-center gap-2 text-green-400 font-medium text-sm group-hover:gap-3 transition-all">View Bundle Details <ArrowRight size={16}/></span>
            </div>
          </Link>
        ))}
      </div>
    </section>

    <CTASection />
  </div>
);

export default Bundles;
