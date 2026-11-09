// Browser regressions use local build files only. Install playwright-core and
// @sparticuz/chromium outside the repository; set NODE_PATH and SITE_BUILD_DIR.
// Every external request is aborted; no quote or CRM data is submitted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, chromium;
try { playwright = require('playwright-core'); chromium = require('@sparticuz/chromium').default; } catch (_) {}
const build = process.env.SITE_BUILD_DIR && path.resolve(process.env.SITE_BUILD_DIR);
const skip = { skip: !(playwright && chromium && build && fs.existsSync(path.join(build, 'index.html'))) && 'Set NODE_PATH and SITE_BUILD_DIR for a local frontend build' };
const origin = 'https://www.maintainitbandits.com';
const businessId = `${origin}/#business`;
const cities = [
  ['austin', 'Austin'], ['round-rock', 'Round Rock'], ['cedar-park', 'Cedar Park'],
  ['georgetown', 'Georgetown'], ['pflugerville', 'Pflugerville'], ['leander', 'Leander'],
  ['bee-cave', 'Bee Cave'], ['west-lake-hills', 'West Lake Hills'], ['lakeway', 'Lakeway'],
  ['dripping-springs', 'Dripping Springs'], ['hutto', 'Hutto'], ['taylor', 'Taylor'],
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

async function setup(browser, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: width < 600, hasTouch: width < 600 });
  const page = await context.newPage(), forms = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://formspree.io') forms.push(route.request().url());
    if (url.origin !== 'https://site.test') return route.abort();
    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Local analytics stub.' });
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/make-ready-turnovers' || pathname === '/make-ready-turnovers/') pathname = '/_prerendered/make-ready-turnovers.html';
    let file = path.resolve(build, '.' + pathname);
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const ext = path.extname(file);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(file) });
  });
  return { context, page, forms, errors };
}

async function goto(page, url) {
  await page.goto('https://site.test' + url, { waitUntil: 'domcontentloaded' });
  await page.locator('.App').waitFor();
}
async function schemas(page) {
  return page.locator('script[type="application/ld+json"]').evaluateAll(tags => tags.map(tag => JSON.parse(tag.textContent)));
}
async function canonical(page, expected) {
  await page.waitForFunction(url => document.querySelector('link[rel="canonical"]')?.href === url, expected);
  assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
}
async function noOverflow(page) {
  const dims = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dims.width <= dims.viewport, `Horizontal overflow: ${JSON.stringify(dims)}`);
}
async function continueStep(page) { await page.getByRole('button', { name: 'Continue', exact: true }).click(); }

const unsupportedCounts = /500\+|2,500\+ jobs|6\+ years|hundreds of (?:Round Rock homeowners|yards)/i;

test('homepage points social metadata and both business schemas at the same existing image and identity', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, forms, errors } = await setup(browser);
  try {
    await goto(page, '/');
    await canonical(page, `${origin}/`);
    const image = `${origin}/gallery/lush-lawn-after.jpg`;
    assert.ok(fs.existsSync(path.join(build, 'gallery/lush-lawn-after.jpg')));
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), image);
    assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), image);
    const businesses = (await schemas(page)).filter(s => s['@type'] === 'LocalBusiness');
    assert.ok(businesses.length >= 2, 'Static and rendered homepage business schemas should both be present');
    for (const business of businesses) {
      assert.equal(business['@id'], businessId);
      assert.equal(business.image, image);
      const sunday = business.openingHoursSpecification.find(day => day.dayOfWeek === 'Sunday');
      assert.equal(sunday.opens, '09:00');
      assert.equal(sunday.closes, '17:00');
    }
    assert.deepEqual(forms, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('all existing city pages retain their links and refer to the same business without city-office addresses', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, forms, errors } = await setup(browser);
  try {
    for (const [slug, name] of cities) {
      await goto(page, `/service-areas/${slug}`);
      await canonical(page, `${origin}/service-areas/${slug}`);
      assert.match(await page.locator('h1').innerText(), new RegExp(name, 'i'));
      const found = await schemas(page);
      const businesses = found.filter(s => s['@type'] === 'LocalBusiness');
      assert.ok(businesses.length >= 1);
      assert.ok(businesses.every(s => s['@id'] === businessId));
      const service = found.find(s => s['@type'] === 'Service' && s.areaServed?.name === `${name}, TX`);
      assert.ok(service, `${name}: service schema missing`);
      assert.equal(service.provider['@id'], businessId);
      assert.equal(service.provider.name, 'Maintain It Bandits LLC');
      assert.equal(service.provider.address, undefined);
      assert.equal(service.priceRange, undefined);
      assert.ok(await page.locator(`a[href="/services/make-ready-services/${slug}"]`).count() > 0);
      assert.ok(await page.locator(`a[href="/contact?city=${slug}"]`).count() >= 2);
      assert.match(await page.locator('body').innerText(), /Sat–Sun: 9:00 AM – 5:00 PM/);
      assert.doesNotMatch(await page.locator('body').innerText(), unsupportedCounts);
      await noOverflow(page);
    }
    for (const [index, [slug, name]] of cities.entries()) {
      const serviceSlug = ['lawn-mowing', 'cleaning', 'landscaping'][index % 3];
      await goto(page, `/services/${serviceSlug}/${slug}`);
      await canonical(page, `${origin}/services/${serviceSlug}/${slug}`);
      const service = (await schemas(page)).find(s => s['@type'] === 'Service');
      assert.equal(service.areaServed.name, `${name}, TX`);
      assert.equal(service.provider['@id'], businessId);
      assert.equal(service.provider.address, undefined);
      assert.ok(await page.locator(`a[href="/contact?service=${serviceSlug}&city=${slug}"]`).count() >= 2);
      assert.doesNotMatch(await page.locator('body').innerText(), unsupportedCounts);
      await noOverflow(page);
    }
    assert.deepEqual(forms, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('city and service-city quote buttons preselect editable choices without submitting', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, forms, errors } = await setup(browser);
  try {
    await goto(page, '/service-areas/hutto');
    await page.locator('a[href="/contact?city=hutto"]').first().click();
    assert.match(page.url(), /\/contact\?city=hutto$/);
    await page.getByRole('button', { name: 'Lawn Mowing & Maintenance', exact: true }).click();
    await continueStep(page);
    assert.equal(await page.getByRole('button', { name: 'Hutto TX', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Austin TX', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Austin TX', exact: true }).getAttribute('aria-pressed'), 'true');

    await goto(page, '/services/cleaning/round-rock');
    await canonical(page, `${origin}/services/cleaning/round-rock`);
    const service = (await schemas(page)).find(s => s['@type'] === 'Service');
    assert.equal(service.areaServed.name, 'Round Rock, TX');
    assert.equal(service.provider['@id'], businessId);
    assert.equal(service.provider.address, undefined);
    assert.ok(await page.locator('a[href="/contact?service=cleaning&city=round-rock"]').count() >= 2);
    assert.doesNotMatch(await page.locator('body').innerText(), unsupportedCounts);
    await page.locator('a[href="/contact?service=cleaning&city=round-rock"]').first().click();
    assert.equal(await page.getByRole('button', { name: 'Cleaning Services', exact: true }).getAttribute('aria-pressed'), 'true');
    await continueStep(page);
    assert.equal(await page.getByRole('button', { name: 'Round Rock TX', exact: true }).getAttribute('aria-pressed'), 'true');

    await goto(page, '/services/make-ready-services/round-rock');
    assert.ok(await page.locator('a[href="/contact?service=make-ready-services&city=round-rock"]').count() >= 1);
    assert.match(await page.locator('body').innerText(), /landlords and property managers/i);
    assert.doesNotMatch(await page.locator('body').innerText(), unsupportedCounts);
    await noOverflow(page);
    assert.deepEqual(forms, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});
