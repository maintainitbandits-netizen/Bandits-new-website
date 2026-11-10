// Create a crawlable snapshot of the make-ready hub after the CRA build.
// Content is shared with the React page; JavaScript replaces this fallback UI.
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const buildDir = path.resolve(process.env.MAKE_READY_BUILD_DIR || path.join(appRoot, 'build'));
const content = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/data/makeReadyContent.json'), 'utf8'));
const roomCleanupPost = JSON.parse(fs.readFileSync(path.join(appRoot, 'src/data/roomCleanupPost.json'), 'utf8'));
const site = 'https://www.maintainitbandits.com';
const url = `${site}/make-ready-turnovers`;
const image = new URL(content.meta.image, site).href;
const quote = '/contact?service=make-ready-services';
let html = fs.readFileSync(path.join(buildDir, 'index.html'), 'utf8');
const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function replaceMeta(attribute, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${escapedKey}")[^>]*>`, 'g');
  const matches = html.match(matcher) || [];
  if (matches.length !== 1) throw new Error(`Expected one ${attribute}=${key} tag, found ${matches.length}`);
  html = html.replace(matcher, () => value === null ? '' : `<meta data-rh="true" ${attribute}="${key}" content="${esc(value)}"/>`);
}

replaceMeta('name', 'description', content.meta.description);
replaceMeta('property', 'og:type', 'website');
replaceMeta('property', 'og:title', content.meta.title);
replaceMeta('property', 'og:description', content.meta.description);
replaceMeta('property', 'og:url', url);
replaceMeta('property', 'og:image', image);
replaceMeta('property', 'og:image:width', null);
replaceMeta('property', 'og:image:height', null);
replaceMeta('property', 'og:image:alt', content.meta.imageAlt);
replaceMeta('name', 'twitter:title', content.meta.title);
replaceMeta('name', 'twitter:description', content.meta.description);
replaceMeta('name', 'twitter:image', image);
replaceMeta('name', 'twitter:image:alt', content.meta.imageAlt);

const schemas = [
  {
    '@context': 'https://schema.org', '@type': 'Service', '@id': `${url}#service`,
    name: 'Rental Make Ready & Tenant Turnover Services', serviceType: 'Rental Make Ready & Tenant Turnover Services',
    provider: { '@type': 'LocalBusiness', name: 'Maintain It Bandits LLC', telephone: '(512) 518-1558', email: 'info@maintainitbandits.com', address: { '@type': 'PostalAddress', addressLocality: 'Austin', addressRegion: 'TX', addressCountry: 'US' } },
    areaServed: content.areas.map(area => ({ '@type': 'City', name: `${area.name}, TX` })), description: content.meta.description,
  },
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: content.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
    { '@type': 'ListItem', position: 2, name: 'Make Ready & Turnovers', item: url },
  ] },
];
const head = [
  `<meta data-rh="true" name="keywords" content="${esc(content.meta.keywords)}"/>`,
  `<link data-rh="true" rel="canonical" href="${esc(url)}"/>`,
  ...schemas.map(schema => `<script data-rh="true" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`),
].join('');
if ((html.match(/<title>[^<]*<\/title>/g) || []).length !== 1 || !html.includes('</head>')) throw new Error('Built index.html is missing its expected head or title');
html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(content.meta.title)}</title>`).replace('</head>', `${head}</head>`);

const list = items => `<ul class="mt-4 space-y-3">${items.map(item => `<li class="text-neutral-300">${esc(item)}</li>`).join('')}</ul>`;
const cards = (items, inner) => `<div class="grid md:grid-cols-2 gap-5 mt-10">${items.map(item => `<div class="bg-[#0f0f0f] border border-[#242a24] rounded-2xl p-7">${inner(item)}</div>`).join('')}</div>`;
const action = `<a href="${esc(quote)}" class="btn-green inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-semibold">Request a Make Ready Quote</a>`;
const page = [
  '<header class="max-w-6xl mx-auto px-5 py-6"><a href="/" class="text-green-400 font-semibold">Maintain It Bandits LLC</a> <span class="text-neutral-500"> / </span> <a href="/make-ready-turnovers" class="text-neutral-300">Make Ready &amp; Turnovers</a></header>',
  '<main>',
  '<section class="bg-[#080c09] border-b border-[#1b291e]"><div class="max-w-6xl mx-auto px-5 py-16 grid lg:grid-cols-2 gap-10 items-center">',
  `<div><p class="text-green-400 text-sm">For landlords &amp; property managers</p><h1 class="font-serif text-4xl md:text-5xl text-white mt-5">${esc(content.headline)}</h1><p class="text-neutral-300 mt-6 leading-relaxed">${esc(content.intro)}</p><p class="text-neutral-300 mt-5">Fully licensed &amp; insured · Response within 24 hours</p><div class="mt-8">${action} <a href="tel:5125181558" class="text-green-400 ml-3">(512) 518-1558</a></div></div>`,
  `<div><figure><div class="relative overflow-hidden rounded-xl border border-white/10 bg-[#111]"><img src="${esc(roomCleanupPost.image)}" alt="${esc(roomCleanupPost.imageAlt)}" width="1448" height="1086" class="block h-auto w-full"/><span aria-hidden="true" class="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Before</span><span aria-hidden="true" class="absolute left-1/2 top-2 ml-2 rounded bg-[#76B900] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-black">After</span></div><figcaption class="mt-3 text-xs leading-relaxed text-neutral-400">${esc(roomCleanupPost.imageCaption)}</figcaption></figure><div class="mt-5"><p class="text-green-400 text-xs uppercase tracking-widest font-semibold">${esc(content.spotlight.eyebrow)}</p><h2 class="font-serif text-2xl text-white mt-2">${esc(content.spotlight.heading)}</h2><p class="text-neutral-300 text-sm mt-3 leading-relaxed">${esc(content.spotlight.description)}</p><p class="text-neutral-400 text-sm mt-2 leading-relaxed">${esc(content.spotlight.planning)}</p><p class="mt-4"><a href="/blog/${esc(roomCleanupPost.slug)}" class="text-green-400">${esc(content.spotlight.guideLabel)}</a> · <a href="/gallery" class="text-neutral-300">${esc(content.spotlight.galleryLabel)}</a></p></div></div></div></section>`,
  '<section class="max-w-6xl mx-auto px-5 py-16"><h2 class="font-serif text-3xl text-white">A smoother start for your next tenant</h2>',
  cards(content.audiences, item => `<h3 class="text-white text-xl font-semibold">${esc(item.title)}</h3><p class="text-neutral-400 mt-3">${esc(item.text)}</p>`), '</section>',
  '<section class="bg-[#080808] py-16"><div class="max-w-6xl mx-auto px-5"><h2 class="font-serif text-3xl text-white">Tell us what your rental needs</h2><p class="text-neutral-400 mt-4">Every property is different. These are examples of needs we can discuss; the work and price are confirmed for your project.</p>',
  cards(content.packages, item => `<h3 class="text-white text-xl font-semibold">${esc(item.name)}</h3><p class="text-neutral-400 mt-2">${esc(item.tagline)}</p>${list(item.features)}`), '</div></section>',
  '<section class="max-w-6xl mx-auto px-5 py-16"><h2 class="font-serif text-3xl text-white">A practical make-ready checklist</h2><p class="text-neutral-400 mt-4">Use your own checklist or tell us which items you need. Work is subject to the agreed scope.</p>',
  cards(content.checklist, item => `<h3 class="text-white text-xl font-semibold">${esc(item.title)}</h3>${list(item.items)}`), '</section>',
  '<section class="bg-[#080808] py-16"><div class="max-w-6xl mx-auto px-5"><h2 class="font-serif text-3xl text-white">A clear plan for your next turn</h2>',
  cards(content.timeline, item => `<h3 class="text-white text-xl font-semibold">${esc(item.step)}. ${esc(item.title)}</h3><p class="text-neutral-400 mt-3">${esc(item.text)}</p>`), '</div></section>',
  `<section class="max-w-6xl mx-auto px-5 py-16"><h2 class="font-serif text-3xl text-white">Make-readys across greater Austin</h2><p class="text-neutral-400 mt-4">${esc(content.areaIntro)}</p><div class="flex flex-wrap gap-3 mt-8">${content.areas.map(a => a.hasPage ? `<a href="/services/make-ready-services/${esc(a.slug)}" class="text-green-400">${esc(a.name)}, TX</a>` : `<span class="text-neutral-300">${esc(a.name)}, TX</span>`).join(' · ')}</div></section>`,
  '<section class="bg-[#080808] py-16"><div class="max-w-4xl mx-auto px-5"><h2 class="font-serif text-3xl text-white">Make-ready questions, answered</h2>',
  content.faqs.map(f => `<div class="mt-7"><h3 class="text-white font-semibold">${esc(f.q)}</h3><p class="text-neutral-400 mt-2">${esc(f.a)}</p></div>`).join(''), '</div></section>',
  `<section class="max-w-4xl mx-auto px-5 py-16 text-center"><h2 class="font-serif text-3xl text-white">Have a rental that needs attention?</h2><p class="text-neutral-400 mt-4">Tell us the city, property type, work needed and your target date. We'll respond within 24 hours.</p><div class="mt-8">${action}</div><p class="mt-6"><a href="/services/make-ready-services" class="text-green-400">Rental make-ready services</a> · <a href="/services/tenant-turnover-services" class="text-green-400">Tenant turnover services</a></p></section>`,
  '</main>',
].join('');
const root = '<div id="root"></div>';
if (!html.includes(root)) throw new Error('Built index.html is missing the expected React root');
html = html.replace(root, `<div id="root">${page}</div>`).replace('<noscript>You need to enable JavaScript to run this app.</noscript>', '<noscript>Some navigation and forms require JavaScript.</noscript>');
const output = path.join(buildDir, '_prerendered', 'make-ready-turnovers.html');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, html);
console.log('Prerendered /make-ready-turnovers for search and social crawlers.');
