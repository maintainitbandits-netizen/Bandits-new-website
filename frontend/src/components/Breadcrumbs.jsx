import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumbs = ({ items = [] }) => {
  // items: [{name, path}]
  const all = [{ name: 'Home', path: '/' }, ...items];
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `https://maintainitbandits.com${it.path}`,
    })),
  };
  return (
    <>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>
      <nav aria-label="Breadcrumb" className="max-w-7xl mx-auto px-5 lg:px-8 pt-6">
        <ol className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          {all.map((it, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={12} className="text-neutral-600" />}
              {i === all.length - 1 ? (
                <span className="text-neutral-200">{it.name}</span>
              ) : (
                <Link to={it.path} className="hover:text-green-400 flex items-center gap-1">
                  {i === 0 && <Home size={12} />} {it.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
};

export default Breadcrumbs;
