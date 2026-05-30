import React from 'react';
import { Heart, Award, Users, Sprout, Recycle, Zap } from 'lucide-react';
import { VALUES, STATS, TEAM_IMAGE } from '../mock';
import SEO from '../components/SEO';
import CTASection from '../components/CTASection';

const VALUE_ICONS = {
  'Reliability': Award,
  'Quality': Heart,
  'Customer Focus': Users,
  'Community': Sprout,
  'Sustainability': Recycle,
  'Efficiency': Zap,
};

const About = () => (
  <div>
    <SEO
      title="About Maintain It Bandits LLC | Austin TX Lawn Care & Home Services"
      description="Learn about Maintain It Bandits LLC \u2013 Austin\u2019s trusted lawn care and home services company. Licensed, insured, locally owned. 500+ happy customers."
      keywords="about Maintain It Bandits, Austin lawn care company, lawn care Austin TX, home services company Austin"
      path="/about"
    />
    <section className="py-20 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">About Us</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">About Maintain It Bandits</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Austin&apos;s trusted lawn care and home services company, dedicated to keeping your property beautiful year-round.</p>
      </div>
    </section>

    <section className="py-20">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="font-serif text-3xl md:text-5xl text-white">Our Story</h2>
          <div className="space-y-5 mt-6 text-neutral-300 leading-relaxed">
            <p>Maintain It Bandits LLC was founded with a simple mission: to provide exceptional lawn care and home maintenance services to the Austin community. What started as a passion for beautiful landscapes has grown into a full-service property maintenance company.</p>
            <p>We understand that your home is your biggest investment, and maintaining it shouldn&apos;t be a hassle. That&apos;s why we offer comprehensive services that cover everything from lawn mowing to deep cleaning, all with the same commitment to quality and customer satisfaction.</p>
            <p>As a locally owned and operated business, we take pride in serving our neighbors across the Austin metro area. Every property we service is treated as if it were our own, ensuring attention to detail and lasting results.</p>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-3 bg-green-500/10 rounded-3xl blur-xl" />
          <img src={TEAM_IMAGE} alt="Maintain It Bandits team" className="relative w-full rounded-2xl border border-[#1a1a1a] aspect-[4/3] object-cover" />
        </div>
      </div>
    </section>

    <section className="py-20 bg-[#080808]">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-serif text-3xl md:text-5xl text-white">Our Values</h2>
          <p className="text-neutral-400 mt-4 max-w-2xl mx-auto">These core principles guide everything we do at Maintain It Bandits.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {VALUES.map(v => {
            const Icon = VALUE_ICONS[v.title] || Award;
            return (
              <div key={v.title} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-7 hover:border-green-500/30 transition-colors">
                <div className="h-12 w-12 rounded-full bg-green-500/10 border border-green-500/30 grid place-items-center"><Icon size={20} className="text-green-400" /></div>
                <h3 className="text-white font-semibold text-xl mt-5">{v.title}</h3>
                <p className="text-neutral-400 text-sm mt-3 leading-relaxed">{v.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>

    <section className="py-20">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {STATS.map((s, i) => (
          <div key={i} className="text-center bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl p-8">
            <div className="text-green-400 font-bold text-4xl md:text-5xl">{s.value}</div>
            <div className="text-neutral-400 mt-2 text-sm uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>
    </section>

    <CTASection />
  </div>
);

export default About;
