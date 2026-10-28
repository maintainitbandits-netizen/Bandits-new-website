// Phone-sized picker tests. All records, sessions, and provider responses are
// fictional; every network request is intercepted. No live CRM data is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, chromium;
try { playwright = require('playwright-core'); chromium = require('@sparticuz/chromium').default; } catch (_) {}
const html = fs.readFileSync(path.join(__dirname, '../frontend/public/crm.html'), 'utf8');
const weekScript = fs.readFileSync(path.join(__dirname, '../frontend/public/crm-week.js'), 'utf8');

function installFakeCRM() {
  const clients = [
    { id: 'c1', name: 'Fictional Client', type: 'Homeowner', stage: 'Lead', props: '', notes: '' },
    { id: 'c2', name: 'Other Client', type: 'Homeowner', stage: 'Lead', props: '', notes: '' },
  ];
  const jobs = Array.from({ length: 7 }, (_, i) => ({
    id: `j${i + 1}`, client: i % 2 ? 'c2' : 'c1', date: i === 6 ? '2026-11-05' : '2026-11-04',
    status: 'Scheduled', prop: `${(i + 1) * 100} Example Road, Austin, TX 78701`, service: 'Mow', ord: i,
  }));
  jobs.push({ id: 'fixed', client: 'c1', date: '2026-11-05', status: 'Scheduled', prop: '800 Exact Road, Austin, TX 78701', service: 'Mow', dateRequirement: 'exact', requiredDate: '2026-11-05' });
  jobs.push({ id: 'late', client: 'c1', date: '2026-11-03', status: 'Scheduled', prop: '900 Late Road, Austin, TX 78701', service: 'Mow', dateRequirement: 'deadline', requiredDate: '2026-11-03' });
  jobs.push({ id: 'missing', client: 'c2', date: '2026-11-04', status: 'Scheduled', prop: '', service: 'Mow' });
  jobs.push({ id: 'done', client: 'c1', date: '2026-11-04', status: 'Done', prop: '1000 Done Road, Austin, TX 78701', service: 'Mow' });
  const rows = new Map();
  clients.forEach(data => rows.set(`clients/${data.id}`, { coll: 'clients', id: data.id, data }));
  jobs.forEach(data => rows.set(`jobs/${data.id}`, { coll: 'jobs', id: data.id, data }));
  let signedIn = false;
  window.__mock = { rows, writes: [], listener: null };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { access_token: 'fictional.jwt.token' } : null } }),
      signInWithPassword: async () => { signedIn = true; return { data: { session: { access_token: 'fictional.jwt.token' } }, error: null }; },
      signOut: async () => { signedIn = false; return { error: null }; },
    },
    from: () => ({
      select: async () => ({ data: [...rows.values()].map(row => JSON.parse(JSON.stringify(row))), error: null }),
      upsert: async row => { rows.set(`${row.coll}/${row.id}`, row); window.__mock.writes.push(row); return { error: null }; },
      delete() { let coll; return { eq(k, v) { if (k === 'coll') { coll = v; return this; } rows.delete(`${coll}/${v}`); window.__mock.writes.push({ deleted: v }); return Promise.resolve({ error: null }); } }; },
    }),
    channel: () => ({ on(_e, _f, fn) { window.__mock.listener = fn; return this; }, subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'), 0); return this; } }),
  };
  window.supabase = { createClient: () => client };
}
async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  return playwright.chromium.launch({ executablePath, args: chromium.args.filter(a => a !== '--single-process'), headless: true });
}
async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript(installFakeCRM);
  const page = await context.newPage(), requests = [], errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === 'https://crm.test/crm.html') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    if (url === 'https://crm.test/crm-week.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: weekScript });
    if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// fictional client injected' });
    if (url === 'https://crm.test/api/crm-route') {
      assert.equal(route.request().headers().authorization, 'Bearer fictional.jwt.token');
      const body = route.request().postDataJSON(); requests.push(body);
      if (body.action === 'geocode') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matches: body.addresses.map((a, i) => ({ formatted: a, location: [30.1 + i * 0.01, -97], accuracy: 1, accuracyType: 'rooftop', ambiguous: false })) }) });
      if (body.action === 'optimize') {
        const order = Array.from({ length: body.stops.length }, (_, i) => i);
        if (body.fixedFirst) order.splice(1, order.length - 1, ...order.slice(1).reverse()); else order.reverse();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ order }) });
      }
    }
    errors.push(`Unexpected network request: ${url}`); return route.abort();
  });
  await page.goto('https://crm.test/crm.html');
  await page.locator('#em').fill('fictional@example.invalid');
  await page.locator('#pw').fill('not-a-real-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
  await page.getByRole('button', { name: 'Route', exact: true }).click();
  await page.locator('#main input[type=date]').fill('2026-11-04');
  return { context, page, requests, errors };
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth, dialog: document.querySelector('#dlg').scrollWidth, dialogWidth: document.querySelector('#dlg').clientWidth }));
  assert.ok(size.body <= size.viewport && size.dialog <= size.dialogWidth, `${label} overflows: ${JSON.stringify(size)}`);
}
const row = (page, text) => page.locator('#pick_list label.pick-stop', { hasText: text });
const canRun = !!(playwright && chromium);

test('phone picker preserves filtered selections and routes only chosen jobs, without saving', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, requests, errors } = await setup(browser, width);
      try {
        await page.getByRole('button', { name: 'Pick addresses to route' }).click();
        await noOverflow(page, `${width} picker`);
        assert.equal(await page.locator('#pick_scope').inputValue(), 'day');
        assert.equal(await row(page, '1000 Done Road').count(), 0);
        assert.equal(await row(page, '700 Example Road').count(), 0);
        assert.equal(await row(page, 'No address').locator('input').isDisabled(), true);
        assert.equal(await page.locator('#pick_route').isDisabled(), true);
        await row(page, '100 Example Road').locator('input').check();
        await row(page, '300 Example Road').locator('input').check();
        await page.locator('#pick_scope').selectOption('all');
        assert.equal(await row(page, '800 Exact Road').locator('input').isDisabled(), true);
        assert.match(await row(page, '800 Exact Road').innerText(), /must be done on 2026-11-05/i);
        assert.equal(await row(page, '900 Late Road').locator('input').isDisabled(), true);
        await page.locator('#pick_search').fill('700 Example');
        await row(page, '700 Example Road').locator('input').check();
        assert.match(await page.locator('#pick_count').innerText(), /3 selected/);
        await page.locator('#pick_search').fill('');
        assert.equal(await row(page, '100 Example Road').locator('input').isChecked(), true);
        assert.equal(await row(page, '300 Example Road').locator('input').isChecked(), true);
        assert.equal(await row(page, '700 Example Road').locator('input').isChecked(), true);
        await page.getByRole('button', { name: 'Route selected addresses', exact: true }).click();
        await noOverflow(page, `${width} disclosure`);
        assert.equal(requests.length, 0);
        assert.match(await page.locator('#dlg').innerText(), /Nothing has been sent yet/);
        await page.getByRole('button', { name: 'Look up these locations' }).click();
        await page.waitForSelector('#rr_opt:visible');
        await noOverflow(page, `${width} match review`);
        assert.deepEqual(requests[0].addresses, ['100 Example Road, Austin, TX 78701', '300 Example Road, Austin, TX 78701', '700 Example Road, Austin, TX 78701']);
        await page.getByRole('button', { name: 'Matches look right — optimize' }).click();
        await page.waitForSelector('#rr_preview h3');
        await page.waitForFunction(() => document.querySelector('#rr_status').textContent.includes('Selected route ready'));
        await noOverflow(page, `${width} selected route`);
        assert.equal(requests.length, 2); assert.equal(requests[1].stops.length, 3);
        assert.doesNotMatch(JSON.stringify(requests), /Other Client|Fictional Client|200 Example|800 Exact|900 Late/);
        assert.match(await page.locator('#rr_preview').innerText(), /100 Example Road/);
        assert.match(await page.locator('#rr_preview').innerText(), /700 Example Road/);
        assert.doesNotMatch(await page.locator('#rr_preview').innerText(), /200 Example|800 Exact|900 Late/);
        const href = await page.locator('#rr_preview a.pri').first().getAttribute('href');
        const url = new URL(href); assert.equal(url.origin, 'https://www.google.com');
        assert.equal(url.searchParams.has('origin'), false);
        assert.equal((url.searchParams.get('waypoints') || '').split('|').filter(Boolean).length, 2);
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        await page.getByRole('button', { name: 'Back to picks' }).click();
        assert.equal(await row(page, '100 Example Road').locator('input').isChecked(), true);
        assert.equal(await row(page, '700 Example Road').locator('input').isChecked(), true);
        assert.match(await page.locator('#pick_count').innerText(), /3 selected/);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('single-stop and long GPS routes work on a phone without losing stops or changing jobs', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, requests, errors } = await setup(browser, 320);
    try {
      await page.getByRole('button', { name: 'Pick addresses to route' }).click();
      await row(page, '100 Example Road').locator('input').check();
      await page.getByRole('button', { name: 'Route selected addresses', exact: true }).click();
      assert.match(await page.locator('#rr_status').innerText(), /No optimization request was needed/);
      assert.equal(requests.length, 0);
      const single = new URL(await page.locator('#rr_preview a.pri').getAttribute('href'));
      assert.equal(single.searchParams.get('destination'), '100 Example Road, Austin, TX 78701');
      await page.getByRole('button', { name: 'Back to picks' }).click();
      await page.getByRole('button', { name: 'Clear selection' }).click();
      assert.equal(await page.locator('#pick_route').isDisabled(), true);
      await page.locator('#dlg').getByRole('button', { name: 'Close' }).click();
      await page.evaluate(() => {
        for (let i = 1; i <= 6; i++) S.jobs[`j${i}`].prop = `${30 + i / 100},-97`;
        S.meta.start = '30,-98'; S.meta.round = true;
      });
      await page.getByRole('button', { name: 'Pick addresses to route' }).click();
      for (let i = 1; i <= 5; i++) await row(page, `${30 + i / 100},-97`).locator('input').check();
      await page.getByRole('button', { name: 'Route selected addresses', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Send GPS points and optimize' }).isVisible(), true);
      await page.getByRole('button', { name: 'Send GPS points and optimize' }).click();
      await page.waitForFunction(() => document.querySelector('#rr_status').textContent.includes('Selected route ready'));
      await noOverflow(page, '320 long selected route');
      assert.equal(requests.length, 1); assert.equal(requests[0].action, 'optimize');
      assert.equal(requests[0].stops.length, 5); assert.equal(requests[0].returnToStart, true);
      const links = await page.locator('#rr_preview a.pri').evaluateAll(nodes => nodes.map(n => n.href));
      assert.equal(links.length, 2);
      const first = new URL(links[0]), second = new URL(links[1]);
      assert.equal(first.searchParams.get('origin'), '30,-98');
      assert.equal(first.searchParams.get('waypoints').split('|').length, 3);
      assert.equal(second.searchParams.get('origin'), first.searchParams.get('destination'));
      assert.equal(second.searchParams.get('destination'), '30,-98');
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});
