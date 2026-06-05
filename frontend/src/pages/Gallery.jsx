import React, { useState } from 'react';
import { MapPin, Camera } from 'lucide-react';
import { GALLERY, GALLERY_CATEGORIES } from '../data/gallery';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const BeforeAfter = ({ before, after, alt }) => {
  const [pos, setPos] = useState(50);
  const handleMove = (clientX, target) => {
    const rect = target.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, x)));
  };
  return (
    <div
      className="relative aspect-[4/3] overflow-hidden rounded-xl select-none cursor-ew-resize"
      onMouseMove={(e) => handleMove(e.clientX, e.currentTarget)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget)}
    >
      <img src={after} alt={`${alt} – after`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
      <img
        src={before}
        alt={`${alt} – before`}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        loading="lazy"
      />
      <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90" />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-white shadow-2xl grid place-items-center text-neutral-900 font-bold">↔</div>
      </div>
      <span className="absolute top-3 left-3 bg-black/70 text-white text-[10px] px-2 py-1 rounded-full tracking-widest uppercase z-10">Before</span>
      <span className="absolute top-3 right-3 bg-green-500 text-[#0a0a0a] text-[10px] px-2 py-1 rounded-full tracking-widest uppercase font-bold z-10">After</span>
    </div>
  );
};

const Showcase = ({ image, alt }) => (
  <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#0a0a0a]">
    <img
      src={image}
      alt={alt}
      className="absolute inset-0 w-full h-full object-contain transition-transform duration-700 hover:scale-105"
      loading="lazy"
    />
    <span className="absolute top-3 right-3 bg-green-500 text-[#0a0a0a] text-[10px] px-2 py-1 rounded-full tracking-widest uppercase font-bold z-10">
      Recent Job
    </span>
  </div>
);

const Gallery = () => {
  const [filter, setFilter] = useState('All');
  const filtered = filter === 'All' ? GALLERY : GALLERY.filter(g => g.category === filter);

  return (
    <div>
      <SEO
        title="Before & After Photo Gallery | Lawn Care & Landscaping Austin TX | Maintain It Bandits LLC"
        description="See real before-and-after results from our lawn care, landscaping, and home services projects across Austin, Round Rock, Cedar Park, and the surrounding Texas metro."
        keywords="lawn care before after Austin, landscaping photos Austin, lawn transformation gallery Texas"
        path="/gallery"
      />
      <Breadcrumbs items={[{ name: 'Gallery', path: '/gallery' }]} />

      <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
        <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
          <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase"><Camera size={14}/> Project Gallery</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Real Results in <span className="text-green-400 italic">Austin TX</span></h1>
          <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Real customer properties, real results. Drag the slider on before/after photos to see the transformation, or browse recent jobs from across the Austin metro.</p>
        </div>
      </section>

      {/* Filter */}
      <section className="py-8 sticky top-20 bg-[#0a0a0a]/90 backdrop-blur z-30 border-b border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 flex flex-wrap gap-2 justify-center">
          {GALLERY_CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilter(c)} className={`px-4 py-2 rounded-full text-sm transition-colors ${filter === c ? 'btn-green' : 'bg-[#111] border border-[#222] text-neutral-300 hover:text-green-400 hover:border-green-500/40'}`}>
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {filtered.map(g => (
            <div key={g.id} className={`bg-[#0f0f0f] border ${g.featured ? 'border-green-500/40 shadow-xl shadow-green-500/10' : 'border-[#1c1c1c]'} rounded-2xl overflow-hidden`}>
              {g.type === 'showcase' ? (
                <Showcase image={g.image} alt={g.title} />
              ) : (
                <BeforeAfter before={g.before} after={g.after} alt={g.title}/>
              )}
              <div className="p-6">
                <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                  {g.featured && <span className="chip px-2 py-0.5 rounded-full text-green-400 font-semibold">★ Featured Project</span>}
                  <span className="chip px-2 py-0.5 rounded-full">{g.category}</span>
                  <span className="flex items-center gap-1"><MapPin size={11}/> {g.location}</span>
                </div>
                <h3 className="text-white font-semibold text-lg mt-3">{g.title}</h3>
                <p className="text-neutral-400 text-sm mt-2 leading-relaxed">{g.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <CTASection />
    </div>
  );
};

export default Gallery;
