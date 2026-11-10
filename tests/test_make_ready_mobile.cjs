// Browser tests use only local build files and intercepted fictional requests.
// Install playwright-core and @sparticuz/chromium externally; set NODE_PATH
// and SITE_BUILD_DIR to a locally built frontend. No real forms are submitted.
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
const build = process.env.SITE_BUILD_DIR;
const skip = { skip: !(playwright && chromium && build && fs.existsSync(path.join(build, 'index.html'))) && 'Set NODE_PATH and SITE_BUILD_DIR to external browser dependencies and a local frontend build' };

async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  for (let attempt = 0;; attempt++) {
    try { return await playwright.chromium.launch({ executablePath, args: chromium.args.filter(a => a !== '--single-process'), headless: true }); }
    catch (error) { if (attempt >= 2 || !String(error).includes('SIGSEGV')) throw error; }
  }
}

async function setup(browser, width, respond = 200) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: width < 600, hasTouch: width < 600 });
  const page = await context.newPage(), calls = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://formspree.io') {
      calls.push({ method: route.request().method(), url: url.href, body: route.request().postDataJSON() });
      return route.fulfill({ status: respond, contentType: 'application/json', body: respond === 200 ? '{}' : '{"errors":[{"message":"Fictional failure"}]}' });
    }
    if (url.origin !== 'https://site.test') return route.abort();
    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Local analytics stub; no network.' });
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/make-ready-turnovers' || pathname === '/make-ready-turnovers/') pathname = '/_prerendered/make-ready-turnovers.html';
    else if (pathname === '/blog/fall-cleanup-austin-rental-properties' || pathname === '/blog/fall-cleanup-austin-rental-properties/') pathname = '/_prerendered/fall-cleanup-austin-rental-properties.html';
    let file = path.join(build, pathname.replace(/^\/+/, ''));
    if (!file.startsWith(path.resolve(build) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const ext = path.extname(file);
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(file) });
  });
  return { context, page, calls, errors };
}

async function goto(page, url) {
  await page.goto('https://site.test' + url, { waitUntil: 'domcontentloaded' });
  await page.locator('.App').waitFor(); // Snapshot has been replaced by React.
}
async function noOverflow(page, label) {
  const dims = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dims.width <= dims.viewport, `${label} overflows: ${JSON.stringify(dims)}`);
}
async function continueStep(page) { await page.getByRole('button', { name: 'Continue', exact: true }).click(); }
async function fillContact(page) {
  await page.getByLabel('Full name *').fill('Fictional Manager');
  await page.getByLabel('Email *').fill('manager@example.invalid');
  await page.getByLabel('Phone *').fill('512-555-0100');
  await page.getByLabel(/What work is needed/).fill('Fictional checklist: clean the unit.');
}

test('rental hub and existing city pages fit narrow screens and lead to preselected quote requests', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 768, 1024, 1280, 1365]) {
      const { context, page, errors } = await setup(browser, width);
      try {
        await goto(page, '/make-ready-turnovers');
        assert.match(await page.locator('h1').innerText(), /Make Ready.*Tenant Turnover.*Austin/i);
        for (const city of ['Austin', 'Hutto', 'Taylor', 'Round Rock', 'Pflugerville', 'Manor', 'Jarrell']) {
          assert.ok(await page.getByText(`${city}, TX`, { exact: true }).count() > 0, city);
        }
        assert.match(await page.locator('body').innerText(), /about 50 miles/i);
        await page.waitForFunction(() => document.querySelector('link[rel="canonical"]')?.href === 'https://www.maintainitbandits.com/make-ready-turnovers');
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
        assert.equal(await page.locator('meta[property="og:title"]').count(), 1);
        assert.match(await page.title(), /Austin Make Ready & Turnover Services/);
        await page.waitForFunction(() => Array.from(document.querySelectorAll('script[type="application/ld+json"]')).some(tag => { try { return JSON.parse(tag.textContent)['@type'] === 'FAQPage'; } catch (_) { return false; } }));
        const schemaTypes = await page.locator('script[type="application/ld+json"]').evaluateAll(tags => tags.map(tag => { try { return JSON.parse(tag.textContent)['@type']; } catch (_) { return null; } }));
        assert.ok(schemaTypes.includes('Service'));
        assert.ok(schemaTypes.includes('FAQPage'));
        assert.equal(schemaTypes.filter(type => type === 'BreadcrumbList').length, 1);
        assert.match(await page.locator('body').innerText(), /response within 24 hours/i);
        assert.doesNotMatch(await page.locator('body').innerText(), /48.?72|127\+|net.terms|COI available/i);
        await page.getByText('How much does a make-ready cost?', { exact: true }).click();
        await noOverflow(page, `hub ${width}`);
        if (width < 1280) {
          await page.getByRole('button', { name: 'Open menu' }).click();
          assert.ok(await page.getByRole('link', { name: 'Make Readys', exact: true }).count() > 0);
          await noOverflow(page, `navigation ${width}`);
          await page.getByRole('button', { name: 'Close menu' }).click();
        }
        await page.getByRole('link', { name: 'Request a Make Ready Quote' }).first().click();
        assert.match(page.url(), /\/contact\?service=make-ready-services$/);
        assert.equal(await page.getByRole('button', { name: 'Rental Make Ready Services', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.waitForFunction(() => document.querySelector('link[rel="canonical"]')?.href === 'https://www.maintainitbandits.com/contact');
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
        await noOverflow(page, `quote ${width}`);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    for (const service of ['make-ready-services', 'tenant-turnover-services']) {
      const { context, page, errors } = await setup(browser, 390);
      try {
        await goto(page, `/services/${service}/round-rock`);
        assert.match(await page.locator('h1').innerText(), /Round Rock, TX/);
        assert.match(await page.locator('body').innerText(), /landlords and property managers/i);
        assert.doesNotMatch(await page.locator('body').innerText(), /local soil|grass types|500\+|same week service/i);
        await page.getByRole('link', { name: 'Request a Quote', exact: true }).first().click();
        assert.match(page.url(), new RegExp(`service=${service}&city=round-rock`));
        await continueStep(page);
        assert.equal(await page.getByRole('button', { name: 'Round Rock TX', exact: true }).getAttribute('aria-pressed'), 'true');
        await noOverflow(page, `city ${service}`);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('rental quote captures an other city, optional project details and a fictional Formspree payload', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, calls, errors } = await setup(browser, 320);
  try {
    await goto(page, '/contact?service=tenant-turnover-services');
    assert.equal(await page.getByRole('button', { name: 'Tenant Turnover Services', exact: true }).getAttribute('aria-pressed'), 'true');
    await continueStep(page);
    for (const name of ['Manor TX', 'Jarrell TX']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Other nearby city' }).click();
    assert.equal(await page.getByRole('button', { name: 'Continue', exact: true }).isDisabled(), true);
    await page.getByLabel('Your city *').fill('Fictional Nearby City');
    await continueStep(page);
    await page.getByRole('button', { name: 'Apartment / Multi-Unit', exact: true }).click();
    await page.getByLabel(/Property address or name/).fill('123 Fictional Avenue');
    await page.getByLabel(/I'm a/).selectOption({ label: 'Property manager' });
    await page.getByLabel(/Number of units/).fill('3');
    await page.getByLabel(/Desired completion date/).fill('2027-02-15');
    await noOverflow(page, 'rental details');
    await continueStep(page);
    await fillContact(page);
    await page.getByRole('button', { name: 'Send Request' }).click();
    await page.getByRole('heading', { name: 'Thanks, Fictional!' }).waitFor();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://formspree.io/f/maqkbaql');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].body.service, 'Tenant Turnover Services');
    assert.equal(calls[0].body.city, 'Fictional Nearby City');
    assert.equal(calls[0].body.propertyType, 'Apartment / Multi-Unit');
    assert.equal(calls[0].body.propertyAddress, '123 Fictional Avenue');
    assert.equal(calls[0].body.customerRole, 'Property manager');
    assert.equal(calls[0].body.units, '3');
    assert.equal(calls[0].body.desiredDate, '2027-02-15');
    assert.equal(calls[0].body.message, 'Fictional checklist: clean the unit.');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('switching request tabs keeps rental details; non-rental choices and payload remain unchanged', skip, async () => {
  const browser = await makeBrowser();
  try {
    {
      const { context, page, calls, errors } = await setup(browser, 390);
      try {
        await goto(page, '/contact?service=make-ready-services&city=hutto');
        await continueStep(page);
        assert.equal(await page.getByRole('button', { name: 'Hutto TX', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.getByRole('button', { name: 'Jarrell TX', exact: true }).click();
        await continueStep(page);
        await page.getByRole('button', { name: 'Residential Home', exact: true }).click();
        await page.getByLabel(/Property address or name/).fill('456 Fictional Street');
        await page.getByLabel(/I'm a/).selectOption({ label: 'Landlord / rental owner' });
        await page.getByLabel(/Number of units/).fill('2');
        await page.getByRole('button', { name: 'Detailed Message' }).click();
        assert.equal(await page.locator('select[name="service"]').inputValue(), 'Rental Make Ready Services');
        assert.equal(await page.locator('select[name="city"]').inputValue(), 'Jarrell TX');
        assert.equal(await page.locator('input[name="propertyAddress"]').inputValue(), '456 Fictional Street');
        assert.equal(await page.locator('select[name="customerRole"]').inputValue(), 'Landlord / rental owner');
        assert.equal(await page.locator('input[name="units"]').inputValue(), '2');
        await page.locator('input[name="name"]').fill('Fictional Owner');
        await page.locator('input[name="email"]').fill('owner@example.invalid');
        await page.locator('textarea[name="message"]').fill('Fictional rental.');
        await page.getByRole('button', { name: 'Send Request' }).click();
        await page.getByText(/Your request was received/).waitFor();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].body.city, 'Jarrell TX');
        assert.equal(calls[0].body.propertyAddress, '456 Fictional Street');
        assert.equal(calls[0].body.customerRole, 'Landlord / rental owner');
        assert.equal(calls[0].body.units, '2');
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
    {
      const { context, page, calls, errors } = await setup(browser, 390);
      try {
        await goto(page, '/contact');
        await page.getByRole('button', { name: 'Lawn Mowing & Maintenance', exact: true }).click();
        await continueStep(page);
        assert.equal(await page.getByRole('button', { name: 'Manor TX', exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: 'Jarrell TX', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Austin TX', exact: true }).click();
        await continueStep(page);
        assert.equal(await page.getByRole('button', { name: 'Apartment / Multi-Unit', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Residential Home', exact: true }).click();
        await continueStep(page);
        await fillContact(page);
        await page.getByRole('button', { name: 'Send Request' }).click();
        await page.getByRole('heading', { name: 'Thanks, Fictional!' }).waitFor();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].body.service, 'Lawn Mowing & Maintenance');
        assert.equal(calls[0].body.city, 'Austin TX');
        assert.equal(calls[0].body.propertyType, 'Residential Home');
        assert.ok(!('customerRole' in calls[0].body));
        assert.ok(!('units' in calls[0].body));
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('bundle, pricing, calculator and rental articles use custom quotes and functional links', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, errors } = await setup(browser, 390);
  try {
    await goto(page, '/bundles');
    const card = page.getByRole('link', { name: /Rapid Turnover Bundle/ });
    assert.match(await card.innerText(), /Custom quote/);
    assert.doesNotMatch(await card.innerText(), /\$|48.?72|photo report/i);
    await card.click();
    await page.locator('h1').filter({ hasText: 'Rapid Turnover Bundle' }).waitFor();
    assert.match(await page.locator('h1').innerText(), /Rapid Turnover Bundle/);
    assert.doesNotMatch(await page.locator('body').innerText(), /undefined|\$895|48.?72|500\+/i);
    assert.equal(await page.getByRole('link', { name: 'Request a Quote', exact: true }).first().getAttribute('href'), '/contact?service=make-ready-services');
    await noOverflow(page, 'turnover bundle');

    await goto(page, '/pricing');
    assert.match(await page.locator('body').innerText(), /Make Ready & Turnover Quotes/);
    assert.doesNotMatch(await page.locator('body').innerText(), /\$295|\$550|\$950|\$2,500/i);
    assert.ok(await page.locator('a[href="/contact?service=make-ready-services"]').count() >= 1);

    await goto(page, '/');
    await page.locator('select').selectOption('Make Ready / Turnover');
    assert.match(await page.locator('body').innerText(), /Custom Make-Ready Quote/);
    const quoteBox = page.getByText('Custom Make-Ready Quote', { exact: true }).locator('..');
    assert.doesNotMatch(await quoteBox.innerText(), /\$\d/);
    assert.equal(await page.getByRole('link', { name: 'Request a Quote', exact: true }).first().getAttribute('href'), '/contact?service=make-ready-services');

    await goto(page, '/blog/tenant-turnover-timeline-austin-tx');
    assert.match(await page.locator('h1').innerText(), /Plan a Tenant Turnover/);
    assert.equal(await page.getByRole('link', { name: 'Request a Quote', exact: true }).first().getAttribute('href'), '/contact?service=tenant-turnover-services');
    assert.doesNotMatch(await page.locator('article').innerText(), /2.?4 business days|48.?72|photo report on every/i);
    await noOverflow(page, 'rental blog');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

test('failed fictional quote request remains editable and is not shown as sent', skip, async () => {
  const browser = await makeBrowser();
  const { context, page, calls, errors } = await setup(browser, 390, 422);
  try {
    await goto(page, '/contact?service=make-ready-services&city=manor');
    await continueStep(page);
    assert.equal(await page.getByRole('button', { name: 'Manor TX', exact: true }).getAttribute('aria-pressed'), 'true');
    await continueStep(page);
    await page.getByRole('button', { name: 'Residential Home', exact: true }).click();
    await continueStep(page);
    await fillContact(page);
    await page.getByRole('button', { name: 'Send Request' }).click();
    await page.getByText('Submission failed', { exact: true }).waitFor();
    assert.equal(calls.length, 1);
    assert.equal(await page.getByLabel('Full name *').inputValue(), 'Fictional Manager');
    assert.equal(await page.getByRole('heading', { name: 'Thanks, Fictional!' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Send Request' }).isEnabled(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});
