// Run against an isolated local build. All off-site requests are aborted; no
// quote, newsletter, CRM, or AI request is submitted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
let playwright, chromium;
try {
  playwright = require('playwright-core');
  const packagedChromium = require('@sparticuz/chromium');
  chromium = packagedChromium.default || packagedChromium;
} catch (_) {}
const build = process.env.SITE_BUILD_DIR && path.resolve(process.env.SITE_BUILD_DIR);
const skip = { skip: !(playwright && chromium && build && fs.existsSync(path.join(build, 'index.html'))) && 'Set NODE_PATH and SITE_BUILD_DIR for a local frontend build' };
const services = [
  ['lawn-mowing', 'Lawn Mowing & Maintenance'], ['landscaping', 'Landscaping & Design'],
  ['fertilization', 'Fertilization & Weed Control'], ['sod-installation', 'Sod Installation'],
  ['property-maintenance', 'Property Maintenance'], ['cleaning', 'Cleaning Services'],
  ['mulching', 'Mulching'], ['shrub-trimming', 'Shrub & Hedge Trimming'],
  ['flower-bed-planting', 'Flower Bed Design & Planting'], ['seasonal-cleanup', 'Seasonal Yard Cleanups'],
  ['yard-work', 'Yard Work'], ['mulch-rock-installation', 'Mulch & Rock Installation'],
  ['junk-haul-off', 'Junk & Brush Haul-Off'], ['pressure-washing', 'Pressure Washing'],
];
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

async function startReadOnlyServer() {
  const server = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = new URL(req.url, 'http://local.test').pathname;
    let file = path.resolve(build, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': mime });
    if (req.method === 'HEAD') res.end(); else res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function setup(browser, width = 390, realOrigin = null) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: width < 600, hasTouch: width < 600, acceptDownloads: true });
  const page = await context.newPage(), writes = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== 'GET') writes.push(`${request.method()} ${url.href}`);
    if (url.origin !== (realOrigin || 'https://site.test')) return route.abort();
    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Local analytics stub.' });
    if (realOrigin) return route.continue();
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/make-ready-turnovers' || pathname === '/make-ready-turnovers/') pathname = '/_prerendered/make-ready-turnovers.html';
    let file = path.resolve(build, '.' + pathname);
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(file) });
  });
  return { context, page, writes, errors };
}
async function gotoApp(page, url, origin = 'https://site.test') {
  await page.goto(origin + url, { waitUntil: 'domcontentloaded' });
  await page.locator('.App h1').waitFor();
}
async function noOverflow(page) {
  const dims = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dims.width <= dims.viewport, `Horizontal overflow: ${JSON.stringify(dims)}`);
}

test('homepage downloads the actual PDF immediately without an email or external request', skip, async () => {
  const browser = await makeBrowser();
  const { server, origin } = await startReadOnlyServer();
  const { context, page, writes, errors } = await setup(browser, 390, origin);
  try {
    await gotoApp(page, '/', origin);
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'The Austin Lawn Care Calendar', exact: true }) });
    assert.equal(await section.count(), 1);
    assert.match(await section.innerText(), /No email address required/i);
    assert.equal(await section.locator('input, form').count(), 0);
    const pdfLink = section.getByRole('link', { name: 'Download Free Calendar' });
    assert.equal(await pdfLink.getAttribute('href'), '/guides/austin-lawn-care-calendar.pdf');
    assert.equal(await section.getByRole('link', { name: 'Read Online' }).getAttribute('href'), '/guides/austin-lawn-care-calendar.html');
    const [download] = await Promise.all([page.waitForEvent('download'), pdfLink.click()]);
    assert.equal(download.suggestedFilename(), 'austin-lawn-care-calendar.pdf');
    const bytes = fs.readFileSync(await download.path());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.deepEqual(bytes, fs.readFileSync(path.join(build, 'guides/austin-lawn-care-calendar.pdf')));
    await noOverflow(page);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
});

test('online calendar is readable on small phones and includes all months and official links', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 768, 1440]) {
      const { context, page, writes, errors } = await setup(browser, width);
      try {
        const response = await page.goto('https://site.test/guides/austin-lawn-care-calendar.html', { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        assert.match(response.headers()['content-type'], /text\/html/);
        assert.equal(await page.locator('h1').innerText(), 'Austin Lawn Care Calendar');
        assert.deepEqual(await page.locator('.month h3').allTextContents(), [
          'January','February','March','April','May','June','July','August','September','October','November','December',
        ]);
        assert.equal(await page.locator('form, input').count(), 0);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), 'https://www.maintainitbandits.com/guides/austin-lawn-care-calendar.html');
        assert.equal(await page.getByRole('link', { name: 'Austin Water: current watering days and restrictions' }).getAttribute('href'), 'https://www.austintexas.gov/water/find-your-watering-day');
        assert.equal(await page.getByRole('link', { name: 'Download the printable PDF' }).getAttribute('href'), '/guides/austin-lawn-care-calendar.pdf');
        await noOverflow(page);
        assert.deepEqual(writes, []);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('every non-rental service-city combination uses the right service and keeps its quote link', { ...skip, timeout: 240000 }, async () => {
  const browser = await makeBrowser();
  const { context, page, writes, errors } = await setup(browser, 390);
  try {
    for (const [slug, title] of services) {
      for (const [city, name] of cities) {
        await gotoApp(page, `/services/${slug}/${city}`);
        const heading = await page.locator('.App h1').innerText();
        assert.ok(heading.includes(title) && heading.includes(name), `${slug}/${city}: ${heading}`);
        const hero = page.locator('section').filter({ has: page.locator('h1') });
        const intro = await hero.locator('p').first().innerText();
        assert.match(intro, /^Looking for /);
        assert.ok(intro.toLowerCase().includes(title.toLowerCase()), `${slug}/${city}: ${intro}`);
        assert.match(intro, /We can discuss the work, a quote, and availability\./);
        if (['cleaning','pressure-washing','junk-haul-off'].includes(slug)) {
          assert.doesNotMatch(intro, /lawn mowing|sod installation|weekly mowing/i);
        }
        assert.ok(await page.locator(`a[href="/contact?service=${slug}&city=${city}"]`).count() >= 2);
        await noOverflow(page);
      }
    }
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('revised public FAQs and articles expose conditional safety guidance', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, writes, errors } = await setup(browser, 390);
  try {
    await gotoApp(page, '/faq');
    assert.match(await page.locator('body').textContent(), /Do not sweep or vacuum rodent droppings/);
    assert.doesNotMatch(await page.locator('body').textContent(), /HEPA vacuums/);
    await gotoApp(page, '/services/fertilization');
    assert.match(await page.locator('body').textContent(), /Re-entry times vary by product/);
    assert.match(await page.locator('body').textContent(), /Examples only; the work is confirmed for your property/);
    await gotoApp(page, '/services/sod-installation');
    assert.match(await page.locator('body').textContent(), /check current local watering rules/i);
    assert.doesNotMatch(await page.locator('body').textContent(), /typically twice daily/i);
    await gotoApp(page, '/blog/austin-lawn-watering-schedule-monthly-guide');
    assert.equal(await page.getByRole('link', { name: 'check their current watering day and restrictions' }).getAttribute('href'), 'https://www.austintexas.gov/water/find-your-watering-day');
    await gotoApp(page, '/blog/rodent-feces-cleanup-austin-tx-what-to-know');
    assert.equal(await page.getByRole('link', { name: 'CDC instructions for cleaning up after rodents' }).getAttribute('href'), 'https://www.cdc.gov/healthy-pets/rodent-control/clean-up.html');
    assert.match(await page.locator('body').innerText(), /Do Not Sweep or Vacuum Droppings/);
    await noOverflow(page);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});
