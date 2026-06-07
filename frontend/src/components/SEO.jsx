import React from 'react';
import { Helmet } from 'react-helmet-async';

const SITE = 'Maintain It Bandits LLC';
const ORIGIN = 'https://www.maintainitbandits.com';
const DEFAULT_OG_IMAGE = `${ORIGIN}/gallery/lush-lawn-after.jpg`;

const SEO = ({ title, description, keywords, path = '/', image, schema }) => {
  const fullTitle = title ? `${title}` : `${SITE} | Lawn Care & Home Services Austin TX`;
  const desc = description || 'Austin TX\u2019s one-stop shop for lawn care, landscaping, cleaning, and home services. Licensed & insured. Free estimates.';
  const url = `${ORIGIN}${path}`;
  const ogImage = image || DEFAULT_OG_IMAGE;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={url} />
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
      {/* Geo */}
      <meta name="geo.region" content="US-TX" />
      <meta name="geo.placename" content="Austin" />
      {schema && (
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      )}
    </Helmet>
  );
};

export default SEO;
