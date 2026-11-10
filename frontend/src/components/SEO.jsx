import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_ORIGIN as ORIGIN } from '../config/site';

const SITE = 'Maintain It Bandits LLC';
const DEFAULT_OG_IMAGE = `${ORIGIN}/gallery/lush-lawn-after.jpg`;

const SEO = ({ title, description, keywords, path = '/', image, imageAlt, type = 'website', schema }) => {
  const fullTitle = title ? `${title}` : `${SITE} | Lawn Care & Home Services Austin TX`;
  const desc = description || 'Home and property services in greater Austin. Fully licensed and insured.';
  const url = `${ORIGIN}${path}`;
  const ogImage = image ? new URL(image, ORIGIN).href : DEFAULT_OG_IMAGE;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={url} />
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
      {imageAlt && <meta name="twitter:image:alt" content={imageAlt} />}
      {/* Geo */}
      <meta name="geo.region" content="US-TX" />
      <meta name="geo.placename" content="Austin" />
      {/* JSON-LD structured data — accepts a single schema object or an array */}
      {schema && [].concat(schema).map((s, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
      ))}
    </Helmet>
  );
};

export default SEO;
