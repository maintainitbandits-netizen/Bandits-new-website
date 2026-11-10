import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package, Check } from 'lucide-react';
import { BUNDLES } from '../data/bundles';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const Bundles = () => (
  <div>
    <SEO
      title="Service Bundles & Combos | Maintain It Bandits LLC Austin TX"
      description="Explore service combinations and request a custom quote for your Austin-area property, including rental make-ready and turnover work."
      keywords="lawn care bundle Austin, landscape bundle Austin TX, home service combo, custom property service quote"
      path="/bundles"
    />
    <Breadcrumbs items={[{ name: 'Bundles', path: '/bundles' }]}/>

    <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><Package size={14}/> Bundles &amp; Combos</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Explore Service Combinations</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Explore ways to combine work for your property. Scope, pricing and scheduling are confirmed for each project.</p>
      </div>
    </section>

    <section className="py-16">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {BUNDLES.map(bundle => (
          <Link to={`/bundles/${bundle.slug}`} key={bundle.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
            <div className="aspect-[16/9] overflow-hidden relative">
              <img src={bundle.image} alt={bundle.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
            </div>
            <div className="p-6">
              <h2 className="font-serif text-2xl text-white">{bundle.name}</h2>
              <p className="text-green-400 text-sm italic mt-1">{bundle.tagline}</p>
              <p className="text-neutral-400 text-sm mt-3 leading-relaxed line-clamp-2">{bundle.description}</p>

              <div className="mt-5 flex items-baseline gap-3">
                <span className="text-green-400 font-bold text-2xl">Custom quote</span>
                <span className="text-neutral-500 text-xs">{bundle.duration}</span>
              </div>

              <div className="text-neutral-500 text-xs mt-4">Examples to discuss:</div>
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {bundle.includes.slice(0, 3).map(item => (
                  <span key={item} className="text-xs text-neutral-400 flex items-center gap-1"><Check size={12} className="text-green-400"/> {item}</span>
                ))}
                {bundle.includes.length > 3 && <span className="text-xs text-neutral-500">+{bundle.includes.length - 3} more</span>}
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
