import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowRight, Tag } from 'lucide-react';
import { BLOG_POSTS } from '../data/blog';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';

const Blog = () => (
  <div>
    <SEO
      title="Lawn Care Blog | Tips, Guides & Local Insights | Maintain It Bandits LLC"
      description="Expert lawn care, landscaping, and home services tips for Austin TX homeowners. Seasonal guides, native plant recommendations, watering schedules and more."
      keywords="Austin lawn care blog, landscaping tips Austin, lawn care guides Texas"
      path="/blog"
    />
    <Breadcrumbs items={[{ name: 'Blog', path: '/blog' }]} />

    <section className="py-16 bg-[#0a0a0a] border-b border-[#161616]">
      <div className="max-w-5xl mx-auto px-5 lg:px-8 text-center">
        <span className="chip inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs tracking-widest font-medium uppercase">Blog</span>
        <h1 className="font-serif text-5xl md:text-6xl text-white mt-5">Lawn Care Tips & Local Guides</h1>
        <p className="text-neutral-400 mt-6 max-w-2xl mx-auto leading-relaxed">Expert advice from Austin&apos;s trusted lawn care professionals. Seasonal guides, native plants, watering schedules, and more.</p>
      </div>
    </section>

    <section className="py-16">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {BLOG_POSTS.map(p => (
          <Link to={`/blog/${p.slug}`} key={p.slug} className="svc-card bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group">
            <div className="aspect-[16/10] overflow-hidden">
              <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
            </div>
            <div className="p-6">
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="chip px-2 py-0.5 rounded-full flex items-center gap-1"><Tag size={11}/> {p.category}</span>
                <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span className="flex items-center gap-1"><Clock size={12}/> {p.readTime}</span>
              </div>
              <h2 className="text-white font-semibold text-lg mt-3 group-hover:text-green-400 transition-colors">{p.title}</h2>
              <p className="text-neutral-400 text-sm mt-3 leading-relaxed line-clamp-3">{p.excerpt}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-green-400 font-medium text-sm">Read More <ArrowRight size={14}/></span>
            </div>
          </Link>
        ))}
      </div>
    </section>

    <CTASection />
  </div>
);

export default Blog;
