import React from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft, User } from 'lucide-react';
import { BLOG_POSTS } from '../data/blog';
import SEO from '../components/SEO';
import Breadcrumbs from '../components/Breadcrumbs';
import CTASection from '../components/CTASection';
import { COMPANY } from '../mock';

const renderBlock = (b, i) => {
  if (b.type === 'h2') return <h2 key={i} className="font-serif text-2xl md:text-3xl text-white mt-10 mb-3">{b.text}</h2>;
  if (b.type === 'list') return (
    <ul key={i} className="space-y-2 my-4">
      {b.items.map((it, j) => (
        <li key={j} className="text-neutral-300 leading-relaxed flex gap-3">
          <span className="text-green-400 mt-1">•</span>
          <span dangerouslySetInnerHTML={{ __html: it.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
        </li>
      ))}
    </ul>
  );
  return <p key={i} className="text-neutral-300 leading-relaxed my-4" dangerouslySetInnerHTML={{ __html: b.text.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>') }} />;
};

const BlogPost = () => {
  const { slug } = useParams();
  const post = BLOG_POSTS.find(p => p.slug === slug);
  if (!post) return <Navigate to="/blog" replace />;
  const related = BLOG_POSTS.filter(p => p.slug !== slug).slice(0, 3);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    image: post.image,
    datePublished: post.date,
    author: { '@type': 'Organization', name: COMPANY.name },
    publisher: { '@type': 'Organization', name: COMPANY.name },
    description: post.excerpt,
  };

  return (
    <div>
      <SEO
        title={`${post.title} | Maintain It Bandits LLC`}
        description={post.excerpt}
        keywords={post.keywords}
        path={`/blog/${slug}`}
        image={post.image}
        schema={schema}
      />
      <Breadcrumbs items={[{ name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${slug}` }]} />

      <article className="max-w-3xl mx-auto px-5 lg:px-8 py-12">
        <Link to="/blog" className="text-green-400 text-sm inline-flex items-center gap-2 hover:underline"><ArrowLeft size={14}/> Back to Blog</Link>
        <h1 className="font-serif text-4xl md:text-5xl text-white mt-6 leading-tight">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 mt-6">
          <span className="flex items-center gap-2"><User size={12}/> {post.author}</span>
          <span className="flex items-center gap-2"><Calendar size={12}/> {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span className="flex items-center gap-2"><Clock size={12}/> {post.readTime}</span>
        </div>
        <img src={post.image} alt={post.title} className="w-full rounded-2xl border border-[#1a1a1a] mt-8 aspect-[16/9] object-cover" />
        <div className="mt-8">
          {post.content.map(renderBlock)}
        </div>

        <div className="mt-12 p-6 bg-[#0f0f0f] border border-green-500/20 rounded-2xl">
          <h3 className="font-serif text-2xl text-white">Need help with your Austin lawn?</h3>
          <p className="text-neutral-400 mt-2 text-sm">Get a free estimate from Austin&apos;s trusted lawn care professionals.</p>
          <Link to="/contact" className="btn-green inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold mt-5 text-sm">Get Free Estimate</Link>
        </div>
      </article>

      <section className="py-16 bg-[#080808] border-t border-[#161616]">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <h2 className="font-serif text-2xl md:text-3xl text-white text-center">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {related.map(p => (
              <Link to={`/blog/${p.slug}`} key={p.slug} className="bg-[#0f0f0f] border border-[#1c1c1c] rounded-2xl overflow-hidden group hover:border-green-500/30 transition-colors">
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy"/>
                </div>
                <div className="p-5">
                  <h3 className="text-white font-semibold text-base group-hover:text-green-400 transition-colors">{p.title}</h3>
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

export default BlogPost;
