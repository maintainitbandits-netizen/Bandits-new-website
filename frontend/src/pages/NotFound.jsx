import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Phone } from 'lucide-react';
import SEO from '../components/SEO';
import { COMPANY } from '../mock';

const NotFound = () => {
  // Tell search engines this page should not be indexed (since the SPA returns
  // HTTP 200 for unknown routes, we need a meta tag to flag this as a soft 404).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, follow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-[70vh] flex items-center">
      <SEO
        title="Page Not Found | Maintain It Bandits LLC"
        description="The page you were looking for doesn’t exist."
        path="/404"
      />
      <div className="max-w-2xl mx-auto px-5 text-center py-20">
        <div className="text-green-400 font-mono text-7xl md:text-9xl font-bold">404</div>
        <h1 className="font-serif text-3xl md:text-5xl text-white mt-4">Page Not Found</h1>
        <p className="text-neutral-400 mt-4 leading-relaxed">
          Sorry, the page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back to something useful.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link to="/" className="btn-green inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold">
            <Home size={16}/> Go Home
          </Link>
          <Link to="/services" className="btn-dark inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold">
            <ArrowLeft size={16}/> Browse Services
          </Link>
          <a href={`tel:${COMPANY.phoneRaw}`} className="btn-dark inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold">
            <Phone size={16} className="text-green-400"/> {COMPANY.phone}
          </a>
        </div>

        {/* Helpful links */}
        <div className="mt-12 pt-8 border-t border-[#1c1c1c]">
          <p className="text-neutral-500 text-sm uppercase tracking-widest mb-4">Popular pages</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { label: 'Lawn Mowing', path: '/services/lawn-mowing' },
              { label: 'Landscaping', path: '/services/landscaping' },
              { label: 'Pricing', path: '/pricing' },
              { label: 'Gallery', path: '/gallery' },
              { label: 'Contact', path: '/contact' },
              { label: 'About', path: '/about' },
            ].map((p) => (
              <Link
                key={p.path}
                to={p.path}
                className="px-4 py-2 rounded-full bg-[#0f0f0f] border border-[#1f1f1f] text-neutral-300 hover:text-green-400 hover:border-green-500/40 transition-colors text-sm"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
