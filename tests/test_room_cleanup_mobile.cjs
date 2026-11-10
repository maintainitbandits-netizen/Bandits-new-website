// Visual and navigation checks use an isolated build and intercept every request.
// Set NODE_PATH and SITE_BUILD_DIR to external browser dependencies and the build.
// No live forms, CRM requests, or third-party services are contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const post = require('../frontend/src/data/roomCleanupPost.json');
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

async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: width < 600, hasTouch: width < 600 });
  const page = await context.newPage();
  const errors = [], forbidden = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === 'https://formspree.io' || (url.origin === 'https://site.test' && /^\/(?:crm(?:\/|\.|$)|api\/)/.test(url.pathname))) {
      forbidden.push(url.href);
      return route.abort();
    }
    if (url.origin !== 'https://site.test') return route.abort();
    if (url.pathname.startsWith('/_vercel/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Local analytics stub' });
    let pathname = decodeURIComponent(url.pathname);
    if (/^\/make-ready-turnovers\/?$/.test(pathname)) pathname = '/_prerendered/make-ready-turnovers.html';
    else if (pathname === `/blog/${post.slug}` || pathname === `/blog/${post.slug}/`) pathname = `/_prerendered/${post.slug}.html`;
    else if (/^\/blog\/fall-cleanup-austin-rental-properties\/?$/.test(pathname)) pathname = '/_prerendered/fall-cleanup-austin-rental-properties.html';
    let file = path.join(build, pathname.replace(/^\/+/, ''));
    if (!file.startsWith(path.resolve(build) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(file) });
  });
  return { context, page, errors, forbidden };
}

async function goto(page, url) {
  await page.goto('https://site.test' + url, { waitUntil: 'domcontentloaded' });
  await page.locator('.App').waitFor();
}
async function noOverflow(page, label) {
  const dims = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dims.width <= dims.viewport, `${label} overflows: ${JSON.stringify(dims)}`);
}
async function completeComparison(image) {
  await image.waitFor({ state: 'visible' });
  await image.evaluate(img => img.decode());
  const dimensions = await image.evaluate(img => {
    const rect = img.getBoundingClientRect();
    const figure = img.closest('figure');
    const labels = [...figure.querySelectorAll('[aria-hidden="true"]')].map(node => ({
      text: node.textContent, x: node.getBoundingClientRect().left,
    }));
    return { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, width: rect.width, height: rect.height, left: rect.left, labels };
  });
  assert.equal(dimensions.naturalWidth, 1448);
  assert.equal(dimensions.naturalHeight, 1086);
  assert.ok(Math.abs(dimensions.width / dimensions.height - 1448 / 1086) < 0.01, `Image was cropped: ${JSON.stringify(dimensions)}`);
  const before = dimensions.labels.find(label => label.text === 'Before');
  const after = dimensions.labels.find(label => label.text === 'After');
  assert.ok(before && after, 'Both comparison labels are present');
  assert.ok(before.x < dimensions.left + dimensions.width / 2, 'Before is over the left half');
  assert.ok(after.x >= dimensions.left + dimensions.width / 2, 'After is over the right half');
  assert.match(await image.locator('xpath=ancestor::figure').innerText(), /before cleanup \(left\).*afterward \(right\)/i);
}

async function checkCleanRun(errors, forbidden) {
  assert.deepEqual(errors, []);
  assert.deepEqual(forbidden, []);
}

test('make-ready hero keeps the entire labeled comparison at mobile and desktop widths', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 768, 1024, 1280]) {
      const { context, page, errors, forbidden } = await setup(browser, width);
      try {
        await goto(page, '/make-ready-turnovers');
        const image = page.locator(`img[src="${post.image}"]`).first();
        assert.equal(await image.getAttribute('alt'), post.imageAlt);
        await completeComparison(image);
        assert.equal(await page.getByRole('link', { name: 'Read the room cleanup guide' }).getAttribute('href'), `/blog/${post.slug}`);
        assert.equal(await page.getByRole('link', { name: 'Explore the project gallery' }).getAttribute('href'), '/gallery');
        await page.waitForFunction(() => document.querySelector('meta[property="og:image"]')?.content.endsWith('/gallery/interior-room-cleanup-before-after.jpg'));
        assert.equal(await page.locator('meta[property="og:image"]').count(), 1);
        await noOverflow(page, `hub at ${width}`);
        await checkCleanRun(errors, forbidden);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('gallery shows the photo in both Make Ready and Cleaning without an invented location', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 1280]) {
      const { context, page, errors, forbidden } = await setup(browser, width);
      try {
        await goto(page, '/gallery');
        await page.getByRole('button', { name: 'Make Ready', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Make Ready', exact: true }).getAttribute('aria-pressed'), 'true');
        const card = page.getByRole('heading', { name: 'Room Cleanup: Before & After' }).locator('xpath=../..');
        await completeComparison(card.locator(`img[src="${post.image}"]`));
        assert.doesNotMatch(await card.innerText(), /Austin|Round Rock|\bTX\b/i);
        await page.getByRole('button', { name: 'Cleaning', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Cleaning', exact: true }).getAttribute('aria-pressed'), 'true');
        await completeComparison(card.locator(`img[src="${post.image}"]`));
        await noOverflow(page, `gallery at ${width}`);
        await checkCleanRun(errors, forbidden);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('blog cards preserve both halves and the article has one canonical and the correct schema', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 1280]) {
      const { context, page, errors, forbidden } = await setup(browser, width);
      try {
        await goto(page, '/blog');
        const articleLink = page.locator(`a[href="/blog/${post.slug}"]`).first();
        const thumb = articleLink.locator('img');
        assert.equal(await thumb.evaluate(img => getComputedStyle(img).objectFit), 'contain');
        await articleLink.hover();
        assert.equal(await thumb.evaluate(img => getComputedStyle(img).transform), 'none');
        await articleLink.click();
        await page.getByRole('heading', { level: 1, name: post.title }).waitFor();
        await completeComparison(page.locator(`article img[src="${post.image}"]`));
        await page.waitForFunction(slug => document.querySelector('link[rel="canonical"]')?.href.endsWith('/blog/' + slug), post.slug);
        assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
        assert.equal(await page.locator('meta[property="og:image"]').count(), 1);
        assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), 'https://www.maintainitbandits.com' + post.image);
        const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(tags => tags.map(tag => { try { return JSON.parse(tag.textContent); } catch (_) { return {}; } }));
        const articles = schemas.filter(s => s['@type'] === 'BlogPosting');
        assert.equal(articles.length, 1);
        assert.equal(articles[0].headline, post.title);
        assert.equal(articles[0].image, 'https://www.maintainitbandits.com' + post.image);
        assert.equal(schemas.filter(s => s['@type'] === 'BreadcrumbList').length, 1);
        assert.equal(await page.getByRole('link', { name: 'request a make-ready quote', exact: true }).getAttribute('href'), '/contact?service=make-ready-services');
        await noOverflow(page, `article at ${width}`);
        await goto(page, '/blog/austin-rental-make-ready-checklist-landlords');
        const relatedThumb = page.locator(`a[href="/blog/${post.slug}"] img`).first();
        assert.equal(await relatedThumb.evaluate(img => getComputedStyle(img).objectFit), 'contain');
        await checkCleanRun(errors, forbidden);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
