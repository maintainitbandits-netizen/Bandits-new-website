// Isolated browser tests for the owner's outdoor project images. Every request
// is served from the local build; no CRM, forms or external services are used.
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
const skip = { skip: !(playwright && chromium && build && fs.existsSync(path.join(build, 'index.html'))) && 'Set NODE_PATH and SITE_BUILD_DIR to isolated browser dependencies and build' };
const before = '/gallery/sod-install-before.jpg';
const after = '/gallery/sod-install-after.jpg';
const rock = '/gallery/decorative-rock-bed.jpg';
const flower = '/gallery/flower-bed-planting.jpg';

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
    const pathname = decodeURIComponent(url.pathname);
    let file = path.join(build, pathname.replace(/^\/+/, ''));
    if (!file.startsWith(path.resolve(build) + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
    const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[path.extname(file)] || 'application/octet-stream';
    return route.fulfill({ status: 200, contentType: mime, body: fs.readFileSync(file) });
  });
  return { context, page, errors, forbidden };
}
async function goto(page, url) {
  await page.goto('https://site.test' + url, { waitUntil: 'domcontentloaded' });
  await page.locator('.App').waitFor();
}
async function checkImage(locator, width, height, alt) {
  await locator.scrollIntoViewIfNeeded();
  const dimensions = await locator.evaluate(async img => {
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  });
  assert.deepEqual(dimensions, { width, height });
  if (alt) assert.equal(await locator.getAttribute('alt'), alt);
}
async function checkBlur(locator) {
  await locator.scrollIntoViewIfNeeded();
  const gradient = await locator.evaluate(async img => {
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const width = 56, height = 17;
    const pixels = ctx.getImageData(551, 66, width, height).data;
    const intensity = i => pixels[4*i]*0.2126 + pixels[4*i+1]*0.7152 + pixels[4*i+2]*0.0722;
    let difference = 0, count = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y*width+x;
      if (x) { difference += Math.abs(intensity(i)-intensity(i-1)); count++; }
      if (y) { difference += Math.abs(intensity(i)-intensity(i-width)); count++; }
    }
    return difference / count;
  });
  assert.ok(gradient < 2, `The address area must remain strongly blurred, got ${gradient}`);
}
async function noOverflow(page, label) {
  const dims = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
  assert.ok(dims.width <= dims.viewport, `${label} overflows: ${JSON.stringify(dims)}`);
}
async function clean(errors, forbidden) {
  assert.deepEqual(errors, []);
  assert.deepEqual(forbidden, []);
}
async function card(page, heading) {
  return page.getByRole('heading', { name: heading, exact: true }).locator('xpath=../..');
}

async function comparisonChecks(page, slider, mobile) {
  await checkImage(slider.locator(`img[src="${before}"]`), 1320, 859, 'Front yard before sod installation');
  await checkImage(slider.locator(`img[src="${after}"]`), 1320, 861, 'Front yard after sod installation');
  const framing = await slider.evaluate(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, fits: [...el.querySelectorAll('img')].map(img => getComputedStyle(img).objectFit) }));
  assert.ok(Math.abs(framing.width / framing.height - 1320/860) < 0.01, `Comparison should preserve the whole landscape frame: ${JSON.stringify(framing)}`);
  assert.deepEqual(framing.fits, ['contain', 'contain']);
  assert.equal(await slider.getAttribute('aria-valuenow'), '50');
  await slider.focus();
  await page.keyboard.press('End');
  assert.equal(await slider.getAttribute('aria-valuenow'), '100');
  await page.keyboard.press('Home');
  assert.equal(await slider.getAttribute('aria-valuenow'), '0');
  assert.match(await slider.getAttribute('aria-valuetext'), /0% of the before photo visible/);
  await page.keyboard.press('ArrowRight');
  assert.equal(await slider.getAttribute('aria-valuenow'), '5');
  const box = await slider.boundingBox();
  await slider.click({ position: { x: box.width * 0.75, y: box.height * 0.5 } });
  assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow')) - 75) <= 1);
  // Real input catches browser image-drag and native touch-handling bugs that
  // dispatching a synthetic mousemove/touchmove event would miss.
  const currentBox = await slider.boundingBox();
  const y = Math.round(currentBox.y + currentBox.height / 2);
  const start = Math.round(currentBox.x + currentBox.width * 0.75);
  const end = Math.round(currentBox.x + currentBox.width * 0.25);
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y }] });
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(start + (end - start) * i / 12), y }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
  } else {
    await page.mouse.move(start, y);
    await page.mouse.down();
    await page.mouse.move(end, y, { steps: 12 });
    await page.mouse.up();
  }
  await page.waitForFunction(el => Math.abs(Number(el.getAttribute('aria-valuenow')) - 25) <= 1, await slider.elementHandle());
  assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow')) - 25) <= 1, `${mobile ? 'Touch' : 'Mouse drag'} moves the slider`);
}

test('gallery shows the full sod comparison and both landscape photos with working filters and privacy', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390, 768, 1280]) {
      const { context, page, errors, forbidden } = await setup(browser, width);
      try {
        await goto(page, '/gallery');
        const sodCard = await card(page, 'Sod Installation: Before & After');
        const slider = sodCard.getByRole('slider', { name: 'Sod Installation: Before & After comparison' });
        await comparisonChecks(page, slider, width < 600);
        assert.doesNotMatch(await sodCard.innerText(), /\b(?:Austin|TX|Bermuda|Zoysia)\b/i);
        const rockCard = await card(page, 'Decorative Rock Landscape Bed');
        const flowerCard = await card(page, 'Flower Bed Design & Planting');
        await checkImage(rockCard.locator(`img[src="${rock}"]`), 1320, 709, 'Decorative rock around shrubs in a landscaped bed');
        await checkBlur(rockCard.locator(`img[src="${rock}"]`));
        await checkImage(flowerCard.locator(`img[src="${flower}"]`), 1320, 857, 'A planted flower bed with dark mulch and a stone border');
        for (const project of [rockCard, flowerCard]) {
          assert.match(await project.innerText(), /Project Photo/i);
          assert.doesNotMatch(await project.innerText(), /\b(?:Austin|TX|Recent Job)\b/i);
          const info = await project.locator('img').evaluate(img => ({ w: img.getBoundingClientRect().width, h: img.getBoundingClientRect().height, nw: img.naturalWidth, nh: img.naturalHeight }));
          assert.ok(Math.abs(info.w / info.h - info.nw / info.nh) < 0.02, 'New landscape image remains fully visible');
        }
        await page.getByRole('button', { name: 'Sod Installation', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Sod Installation', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByRole('heading', { name: 'Sod Installation: Before & After' }).count(), 1);
        assert.equal(await page.getByRole('heading', { name: 'Decorative Rock Landscape Bed' }).count(), 0);
        await page.getByRole('button', { name: 'Landscaping', exact: true }).click();
        assert.equal(await page.getByRole('heading', { name: 'Sod Installation: Before & After' }).count(), 1);
        assert.equal(await page.getByRole('heading', { name: 'Decorative Rock Landscape Bed' }).count(), 1);
        assert.equal(await page.getByRole('heading', { name: 'Flower Bed Design & Planting' }).count(), 1);
        const originalSlider = page.getByRole('slider', { name: 'Austin Mulch Bed Refresh comparison' });
        await originalSlider.focus();
        await page.keyboard.press('Home');
        assert.equal(await originalSlider.getAttribute('aria-valuenow'), '0');
        await noOverflow(page, `gallery ${width}`);
        await clean(errors, forbidden);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('new project photos appear on matching services, bundles, article and city pages', skip, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 1280]) {
      const { context, page, errors, forbidden } = await setup(browser, width);
      try {
        for (const url of ['/', '/services']) {
          await goto(page, url);
          for (const [slug, image, w, h, alt] of [
            ['sod-installation', after, 1320, 861, 'Front yard after sod installation'],
            ['mulch-rock-installation', rock, 1320, 709, 'Decorative rock around shrubs in a landscaped bed'],
            ['flower-bed-planting', flower, 1320, 857, 'A planted flower bed with dark mulch and a stone border'],
          ]) {
            const imageEl = page.locator(`a[href="/services/${slug}"] img[src="${image}"]`).first();
            await checkImage(imageEl, w, h, alt);
          }
          await noOverflow(page, `${url} ${width}`);
        }
        await goto(page, '/services/sod-installation');
        await checkImage(page.locator(`img[src="${after}"]`).first(), 1320, 861, 'Front yard after sod installation');
        const slider = page.getByRole('slider', { name: 'Sod Installation: Before & After comparison' });
        await comparisonChecks(page, slider, width < 600);
        assert.equal(await page.getByRole('link', { name: 'Get Free Estimate', exact: true }).first().getAttribute('href'), '/contact');
        await page.waitForFunction(url => document.querySelector('meta[property="og:image"]')?.content.endsWith(url), after);
        assert.equal(await page.locator('meta[property="og:image:alt"]').getAttribute('content'), 'Front yard after sod installation');
        await noOverflow(page, `sod service ${width}`);

        for (const [slug, image, w, h, alt] of [
          ['mulch-rock-installation', rock, 1320, 709, 'Decorative rock around shrubs in a landscaped bed'],
          ['flower-bed-planting', flower, 1320, 857, 'A planted flower bed with dark mulch and a stone border'],
        ]) {
          await goto(page, `/services/${slug}`);
          const hero = page.locator(`img[src="${image}"]`).first();
          await checkImage(hero, w, h, alt);
          if (image === rock) await checkBlur(hero);
          await page.waitForFunction(url => document.querySelector('meta[property="og:image"]')?.content.endsWith(url), image);
          await noOverflow(page, `${slug} ${width}`);
        }
        await goto(page, '/services/mulch-rock-installation/round-rock');
        await checkImage(page.locator(`img[src="${rock}"]`).first(), 1320, 709, 'Decorative rock around shrubs in a landscaped bed');
        assert.equal(await page.getByRole('link', { name: 'Request an Estimate', exact: true }).first().getAttribute('href'), '/contact?service=mulch-rock-installation&city=round-rock');
        await noOverflow(page, `city service ${width}`);

        await goto(page, '/bundles');
        await checkImage(page.locator(`a[href="/bundles/full-yard-makeover"] img`).first(), 1320, 861, 'Front yard after sod installation');
        await checkImage(page.locator(`a[href="/bundles/complete-yard"] img`).first(), 1320, 857, 'A planted flower bed with dark mulch and a stone border');
        await goto(page, '/bundles/full-yard-makeover');
        await checkImage(page.locator(`img[src="${after}"]`).first(), 1320, 861, 'Front yard after sod installation');
        await page.waitForFunction(url => document.querySelector('meta[property="og:image"]')?.content.endsWith(url), after);
        const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(tags => tags.map(tag => JSON.parse(tag.textContent)));
        assert.ok(schemas.some(s => s['@type'] === 'Service' && s.name === 'Full Yard Makeover' && s.image === 'https://www.maintainitbandits.com' + after));
        assert.ok(await page.locator('a[href="/contact?service=sod-installation"]').filter({ hasText: 'Request a Quote' }).count() >= 1);
        await noOverflow(page, `bundle ${width}`);

        await goto(page, '/blog/how-much-does-lawn-care-cost-austin-tx');
        await checkImage(page.locator(`article img[src="${after}"]`).first(), 1320, 861, 'Front yard after sod installation');
        await page.waitForFunction(url => document.querySelector('meta[property="og:image"]')?.content.endsWith(url), after);
        await noOverflow(page, `article ${width}`);
        await goto(page, '/blog/mulching-guide-austin-texas-when-how-much');
        await checkImage(page.locator(`article img[src="${flower}"]`).first(), 1320, 857, 'A planted flower bed with dark mulch and a stone border');
        await page.waitForFunction(url => document.querySelector('meta[property="og:image"]')?.content.endsWith(url), flower);
        await noOverflow(page, `mulching article ${width}`);
        await clean(errors, forbidden);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
