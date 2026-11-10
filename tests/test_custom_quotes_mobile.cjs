// Test a locally built site only. All non-local requests and every write are
// blocked; no real quote requests or other data are sent.
// Set NODE_PATH and SITE_BUILD_DIR to external browser dependencies and build.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, chromium;
try {
  playwright = require('playwright-core');
  const packagedChromium = require('@sparticuz/chromium');
  chromium = packagedChromium.default || packagedChromium;
} catch (_) {}
const build = process.env.SITE_BUILD_DIR && path.resolve(process.env.SITE_BUILD_DIR);
const skip = { skip: !(playwright && chromium && build && fs.existsSync(path.join(build, 'index.html'))) && 'Set NODE_PATH and SITE_BUILD_DIR to a local build and browser dependencies' };
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'frontend/src/mock.js'), 'utf8')
  .split('export const SERVICES = [')[1].split('export const SERVICE_AREAS')[0];
const services = [...source.matchAll(/slug:\s*'([^']+)',\s*title:\s*'([^']+)'/g)].map(match => ({ slug: match[1], title: match[2] }));
const aliases = { 'lawn-mowing': 'Lawn Mowing', landscaping: 'Landscape Design', mulching: 'Mulch Refresh', 'make-ready-services': 'Make Ready / Turnover' };
const bundles = [
  { slug: 'healthy-lawn', service: 'lawn-mowing' },
  { slug: 'complete-yard', service: 'landscaping' },
  { slug: 'full-yard-makeover', service: 'sod-installation' },
  { slug: 'property-refresh', service: 'cleaning' },
  { slug: 'spring-starter', service: 'property-maintenance' },
  { slug: 'rapid-turnover', service: 'make-ready-services' },
];

async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  for (let attempt = 0;; attempt++) {
    try { return await playwright.chromium.launch({ executablePath, args: chromium.args.filter(a => a !== '--single-process'), headless: true }); }
    catch (error) { if (attempt >= 2 || !String(error).includes('SIGSEGV')) throw error; }
  }
}

async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: width < 600, hasTouch: width < 600 });
  const page = await context.newPage(), errors = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) { writes.push(`${request.method()} ${url.href}`); return route.abort(); }
    if (url.origin !== 'https://site.test') return route.abort();
    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// local analytics stub' });
    let filename = path.join(build, decodeURIComponent(url.pathname).replace(/^\/+/, ''));
    if (!filename.startsWith(build + path.sep) || !fs.existsSync(filename) || fs.statSync(filename).isDirectory()) filename = path.join(build, 'index.html');
    const ext = path.extname(filename);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(filename) });
  });
  return { context, page, errors, writes };
}
async function goto(page, url) {
  await page.goto('https://site.test' + url, { waitUntil: 'domcontentloaded' });
  await page.locator('.App h1').waitFor();
}
async function noOverflow(page, label) {
  const dims = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dims.width <= dims.viewport, `${label} overflows: ${JSON.stringify(dims)}`);
}
async function quoteOnly(page, label) {
  const body = await page.locator('body').innerText();
  assert.doesNotMatch(body, /\$\s*\d|\b(?:save|saving|discount)\s+(?:up to\s+)?\d+\s*%/i, label);
  assert.doesNotMatch(body, /instant (?:quote|estimate)|ballpark/i, label);
  await page.waitForFunction(() => document.querySelector('link[rel="canonical"]')?.getAttribute('href')?.startsWith('https://www.maintainitbandits.com/'));
  const metadata = await page.evaluate(() => [document.title, ...Array.from(document.querySelectorAll('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]')).map(tag => tag.content)].join(' '));
  assert.doesNotMatch(metadata, /\$\s*\d|\b(?:save|saving|discount)\s+(?:up to\s+)?\d+\s*%/i, `${label} metadata`);
  const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(tags => tags.map(tag => JSON.parse(tag.textContent)));
  const nested = value => {
    if (!value || typeof value !== 'object') return [];
    return [value, ...Object.values(value).flatMap(nested)];
  };
  for (const object of schemas.flatMap(nested)) {
    assert.ok(!['Offer', 'AggregateOffer', 'PriceSpecification'].includes(object['@type']), `${label} has priced schema`);
    for (const key of ['price', 'priceRange', 'priceCurrency', 'lowPrice', 'highPrice', 'priceSpecification']) {
      assert.equal(object[key], undefined, `${label} schema contains ${key}`);
    }
  }
}
async function selectedService(page, slug) {
  const service = services.find(s => s.slug === slug);
  assert.ok(service, `Known service ${slug}`);
  const button = page.getByRole('button', { name: service.title, exact: true });
  assert.equal(await button.getAttribute('aria-pressed'), 'true', `preselected ${slug}`);
  assert.equal(await page.locator('h1').innerText(), 'Request a Free Estimate');
  assert.match(await page.locator('body').innerText(), /Service pricing depends on the work requested/i);
}

test('every homepage service option links to a correctly preselected quote, including both rental choices', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, errors, writes } = await setup(browser, 390);
  try {
    assert.ok(services.length >= 16);
    await goto(page, '/');
    const optionValues = await page.locator('#quote-service option').evaluateAll(options => options.map(option => option.value));
    assert.equal(optionValues.length, services.length);
    assert.equal(new Set(optionValues).size, services.length);
    for (const service of services) {
      await page.locator('#quote-service').selectOption(aliases[service.slug] || service.title);
      const card = page.locator('#quote-service').locator('..').locator('..');
      assert.match(await card.innerText(), /Estimates are free\. Service pricing and scheduling/i);
      const link = card.getByRole('link', { name: 'Request a Quote', exact: true });
      assert.equal(await link.getAttribute('href'), `/contact?service=${service.slug}`);
      await quoteOnly(page, `home: ${service.slug}`);
      await noOverflow(page, `home: ${service.slug}`);
      await link.click();
      await selectedService(page, service.slug);
      await noOverflow(page, `contact: ${service.slug}`);
      await goto(page, '/');
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('pricing, bundle and article pages stay quote-only and fit narrow and desktop screens', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 768, 1280]) {
      const { context, page, errors, writes } = await setup(browser, width);
      try {
        await goto(page, '/pricing');
        assert.match(await page.locator('body').innerText(), /Make Ready & Turnover Quotes/);
        assert.match(await page.locator('body').innerText(), /Estimates are free for every service/i);
        await quoteOnly(page, `pricing ${width}`);
        await noOverflow(page, `pricing ${width}`);
        const pricingLinks = await page.locator('a[href^="/contact?service="]').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href')))]);
        assert.ok(pricingLinks.length >= 8);
        for (const href of pricingLinks) {
          const slug = new URL('https://site.test' + href).searchParams.get('service');
          await goto(page, href);
          await selectedService(page, slug);
        }
        await goto(page, '/bundles');
        await quoteOnly(page, `bundles ${width}`);
        await noOverflow(page, `bundles ${width}`);
        for (const bundle of bundles) {
          await goto(page, `/bundles/${bundle.slug}`);
          assert.match(await page.locator('body').innerText(), /custom quote/i);
          assert.match(await page.locator('body').innerText(), /examples only/i);
          const rentalCta = page.getByRole('heading', { name: 'Ready to discuss your rental?' });
          assert.equal(await rentalCta.count(), bundle.slug === 'rapid-turnover' ? 1 : 0);
          await quoteOnly(page, `bundle ${bundle.slug} ${width}`);
          await noOverflow(page, `bundle ${bundle.slug} ${width}`);
          const quote = page.locator('section').filter({ has: page.locator('h1') }).getByRole('link', { name: 'Request a Quote', exact: true });
          assert.equal(await quote.getAttribute('href'), `/contact?service=${bundle.service}`);
          assert.ok(await page.locator(`a[href="/contact?service=${bundle.service}"]`).count() >= 2);
          await quote.click();
          await selectedService(page, bundle.service);
        }
        for (const slug of ['how-much-does-lawn-care-cost-austin-tx', 'how-much-does-house-cleaning-cost-austin-tx', 'move-out-cleaning-checklist-austin-tx']) {
          await goto(page, `/blog/${slug}`);
          assert.ok(await page.locator('article').count(), slug);
          await quoteOnly(page, `article ${slug} ${width}`);
          await noOverflow(page, `article ${slug} ${width}`);
          if (slug === 'how-much-does-house-cleaning-cost-austin-tx') {
            await page.locator('article a[href="/contact?service=cleaning"]').click();
            await selectedService(page, 'cleaning');
          }
        }
        await goto(page, '/faq');
        const freeEstimateFaq = page.locator('details').filter({ hasText: 'Are estimates free?' });
        await freeEstimateFaq.locator('summary').click();
        assert.match(await freeEstimateFaq.innerText(), /Estimates are free for every service, including make-ready and tenant turnover work/i);
        assert.match(await freeEstimateFaq.innerText(), /Service pricing depends on your property/i);
        const faqSchemas = await page.locator('script[type="application/ld+json"]').evaluateAll(tags => tags.map(tag => JSON.parse(tag.textContent)));
        const faqSchema = faqSchemas.find(schema => schema['@type'] === 'FAQPage');
        const freeQuestion = faqSchema?.mainEntity.find(item => item.name === 'Are estimates free?');
        assert.match(freeQuestion?.acceptedAnswer?.text || '', /including make-ready and tenant turnover work/i);
        await noOverflow(page, `FAQ ${width}`);
        assert.deepEqual(writes, []);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
