// Create a crawlable HTML snapshot for the fall-cleanup article after the CRA build.
// The normal React app still runs from the same JS/CSS bundles on this URL.
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.resolve(process.env.BLOG_BUILD_DIR || path.join(appRoot, 'build'));
const post = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/data/fallCleanupPost.json'), 'utf8'));
const site = 'https://www.maintainitbandits.com';
const company = 'Maintain It Bandits LLC';
const url = `${site}/blog/${post.slug}`;
const image = new URL(post.image, site).href;
let html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

// The article data supports the same small inline-markdown subset as BlogPost.jsx.
const inline = value => escapeHtml(value)
  .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-green-400 hover:underline">$1</a>');

const renderBlock = block => {
  switch (block.type) {
    case 'h2':
      return `<h2 class="font-serif text-2xl md:text-3xl text-white mt-10 mb-3">${escapeHtml(block.text)}</h2>`;
    case 'h3':
      return `<h3 class="text-xl font-semibold text-white mt-8 mb-3">${escapeHtml(block.text)}</h3>`;
    case 'p':
      return `<p class="text-neutral-300 leading-relaxed my-4">${inline(block.text)}</p>`;
    case 'orderedList':
      return `<ol class="list-decimal pl-6 space-y-3 my-4 marker:text-green-400">${block.items.map(item => `<li class="text-neutral-300 leading-relaxed pl-1">${inline(item)}</li>`).join('')}</ol>`;
    case 'callout':
      return `<aside class="my-6 rounded-2xl border border-green-500/30 bg-neutral-900 p-5"><p class="text-neutral-300 leading-relaxed">${inline(block.text)}</p></aside>`;
    default:
      throw new Error(`Unsupported fall-cleanup block type: ${block.type}`);
  }
};

// Replace exactly one fallback tag, rather than leaving a competing home-page tag.
function replaceMeta(attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${escapedKey}")[^>]*>`, 'g');
  const matches = html.match(matcher) || [];
  if (matches.length !== 1) throw new Error(`Expected one ${attribute}=${key} meta tag, found ${matches.length}`);
  const replacement = value === null ? '' : `<meta data-rh="true" ${attribute}="${key}" content="${escapeHtml(value)}"/>`;
  html = html.replace(matcher, () => replacement);
}

replaceMeta('name', 'description', post.metaDescription);
replaceMeta('property', 'og:type', 'article');
replaceMeta('property', 'og:title', post.metaTitle);
replaceMeta('property', 'og:description', post.metaDescription);
replaceMeta('property', 'og:url', url);
replaceMeta('property', 'og:image', image);
replaceMeta('property', 'og:image:width', null);
replaceMeta('property', 'og:image:height', null);
replaceMeta('property', 'og:image:alt', post.imageAlt);
replaceMeta('name', 'twitter:title', post.metaTitle);
replaceMeta('name', 'twitter:description', post.metaDescription);
replaceMeta('name', 'twitter:image', image);
replaceMeta('name', 'twitter:image:alt', post.imageAlt);

const schema = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: post.title,
  image,
  datePublished: post.date,
  author: { '@type': 'Organization', name: company },
  publisher: { '@type': 'Organization', name: company },
  description: post.excerpt,
};
const headTags = [
  `<meta data-rh="true" name="keywords" content="${escapeHtml(post.keywords)}"/>`,
  `<link data-rh="true" rel="canonical" href="${escapeHtml(url)}"/>`,
  `<script data-rh="true" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
].join('');
if ((html.match(/<title>[^<]*<\/title>/g) || []).length !== 1 || !html.includes('</head>')) {
  throw new Error('Built index.html is missing its expected head or title');
}
html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(post.metaTitle)}</title>`);
html = html.replace('</head>', `${headTags}</head>`);

const displayDate = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(post.date));
const article = [
  '<article class="max-w-3xl mx-auto px-5 lg:px-8 py-12">',
  '<a href="/blog" class="text-green-400 text-sm hover:underline">Back to Blog</a>',
  `<h1 class="font-serif text-4xl md:text-5xl text-white mt-6 leading-tight">${escapeHtml(post.title)}</h1>`,
  `<p class="text-xs text-neutral-500 mt-6">${escapeHtml(post.author)} &middot; ${escapeHtml(displayDate)} &middot; ${escapeHtml(post.readTime)}</p>`,
  `<img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.imageAlt)}" class="w-full rounded-2xl border border-[#1a1a1a] mt-8 aspect-[16/9] object-cover"/>`,
  `<div class="mt-8">${post.content.map(renderBlock).join('')}</div>`,
  '</article>',
].join('');
const root = '<div id="root"></div>';
if (!html.includes(root)) throw new Error('Built index.html is missing the expected React root');
html = html.replace(root, `<div id="root">${article}</div>`);
html = html.replace('<noscript>You need to enable JavaScript to run this app.</noscript>',
  '<noscript>Some navigation and forms require JavaScript.</noscript>');

const output = path.join(buildDir, '_prerendered', `${post.slug}.html`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log(`Prerendered /blog/${post.slug} for search and social crawlers.`);
