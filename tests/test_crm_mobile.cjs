// Optional mobile Chromium smoke test. It intercepts every request and uses
// fictional data plus a fake Supabase client; it never contacts the live CRM.
// Install playwright-core and @sparticuz/chromium outside the repository and
// set NODE_PATH to that node_modules to run. No native SMS is actually sent.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, bundledChromium;
try {
  playwright = require('playwright-core');
  bundledChromium = require('@sparticuz/chromium').default;
} catch (_) {}
const html = fs.readFileSync(path.join(__dirname, '../frontend/public/crm.html'), 'utf8');
const weekScript = fs.readFileSync(path.join(__dirname, '../frontend/public/crm-week.js'), 'utf8');

function installFakeSupabase() {
  const clients = [
    { id: 'c1', name: 'Fictional Owner', phone: '(512) 555-0100', type: 'Homeowner', stage: 'Lead', props: '100 Example Road', notes: '' },
    { id: 'c2', name: 'Second Fictional Owner', phone: '+1 512 555 0101', type: 'Homeowner', stage: 'Lead', props: '300 Example Road', notes: '' },
  ];
  const jobs = [
    { id: 'j1', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: '100 Example Road', service: 'Mow / edge / blow', price: 0, ord: 0 },
    { id: 'j2', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: '200 Example Road', service: 'Mow / edge / blow', price: 0, ord: 1 },
    { id: 'j3', client: 'c2', date: '2026-11-04', status: 'Scheduled', prop: '300 Example Road', service: 'Mow / edge / blow', price: 0, ord: 2 },
  ];
  const rows = new Map();
  clients.forEach(data => rows.set(`clients/${data.id}`, { coll: 'clients', id: data.id, data }));
  jobs.forEach(data => rows.set(`jobs/${data.id}`, { coll: 'jobs', id: data.id, data }));
  const photos = new Map();
  let signedIn = false;
  window.__mock = { rows, photos, uploadedTypes: [] };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { access_token: 'fictional.jwt.token' } : null } }),
      signInWithPassword: async () => { signedIn = true; return { data: { session: { access_token: 'fictional.jwt.token' } }, error: null }; },
      signOut: async () => { signedIn = false; return { error: null }; },
    },
    rpc: async () => ({ data: true, error: null }),
    storage: { from: () => ({
      async list(folder) {
        const prefix = folder + '/';
        return { data: [...photos.keys()].filter(k => k.startsWith(prefix)).reverse().map(k => ({ name: k.slice(prefix.length) })), error: null };
      },
      async upload(name, blob, options) {
        window.__mock.uploadedTypes.push([blob.type, options.contentType]);
        photos.set(name, blob); return { data: { path: name }, error: null };
      },
      async download(name) { return { data: photos.get(name), error: photos.has(name) ? null : { message: 'missing' } }; },
      async remove(names) { return { data: names.filter(n => photos.delete(n)).map(name => ({ name })), error: null }; },
    }) },
    from: () => ({
      select: async () => ({ data: [...rows.values()], error: null }),
      upsert: async row => { rows.set(`${row.coll}/${row.id}`, row); return { error: null }; },
      delete() { let coll; return { eq(key, val) { if (key === 'coll') { coll = val; return this; } rows.delete(`${coll}/${val}`); return Promise.resolve({ error: null }); } }; },
    }),
    channel: () => ({ on() { return this; }, subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'), 0); return this; } }),
  };
  window.supabase = { createClient: () => client };
}

async function assertNoOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({ body: document.documentElement.scrollWidth, viewport: innerWidth, dialog: document.querySelector('#dlg').open ? document.querySelector('#dlg').scrollWidth : 0, dialogWidth: document.querySelector('#dlg').clientWidth }));
  assert.ok(dimensions.body <= dimensions.viewport, `${label}: page overflows: ${JSON.stringify(dimensions)}`);
  if (dimensions.dialog) assert.ok(dimensions.dialog <= dimensions.dialogWidth, `${label}: dialog overflows: ${JSON.stringify(dimensions)}`);
}

test('new CRM flows fit small screens and use only fictional mock data', { skip: !(playwright && bundledChromium) && 'Install playwright-core and @sparticuz/chromium externally to run mobile Chromium' }, async () => {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await bundledChromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  const browser = await playwright.chromium.launch({ executablePath, args: bundledChromium.args.filter(arg => arg !== '--single-process'), headless: true });
  try {
    for (const width of [320, 360, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36' });
      const page = await context.newPage();
      const unexpectedRequests = [], errors = [], roadRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await context.addInitScript(installFakeSupabase);
      await page.route('**/*', route => {
        const url = route.request().url();
        if (url === 'https://crm.test/crm.html') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
        if (url === 'https://crm.test/crm-week.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: weekScript });
        if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// Fake client was injected before page load.' });
        if (url === 'https://crm.test/api/crm-route') {
          const request = route.request();
          assert.equal(request.method(), 'POST');
          assert.equal(request.headers().authorization, 'Bearer fictional.jwt.token');
          const input = request.postDataJSON(); roadRequests.push(input);
          if (input.action === 'geocode') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matches: input.addresses.map((a, i) => ({ formatted: `${a}, Austin, TX 78701`, location: [30.1 + i * 0.01, -97], accuracy: 1, accuracyType: 'rooftop', ambiguous: false })) }) });
          if (input.action === 'optimize') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ order: input.fixedFirst ? [0, 2, 1] : [1, 2, 0] }) });
          return route.abort();
        }
        unexpectedRequests.push(url); return route.abort();
      });
      try {
        await page.goto('https://crm.test/crm.html');
        await page.locator('#em').fill('fictional@example.invalid');
        await page.locator('#pw').fill('not-a-real-password');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        await page.getByRole('button', { name: 'Route', exact: true }).click();
        await page.locator('#main input[type=date]').fill('2026-11-04');
        await page.waitForFunction(() => document.querySelectorAll('#main .card').length === 3);
        await assertNoOverflow(page, `${width} route`);
        const sms = await page.locator('#main .card').first().getByRole('link', { name: 'Text en route' }).getAttribute('href');
        assert.match(decodeURIComponent(sms), /^sms:5125550100\?body=.*on our way/);

        await page.getByRole('button', { name: 'Optimize driving route', exact: true }).click();
        await assertNoOverflow(page, `${width} driving-route consent`);
        assert.equal(roadRequests.length, 0);
        assert.equal(await page.locator('#rr_opt').isVisible(), false);
        assert.equal(await page.locator('#rr_save').isVisible(), false);
        assert.match(await page.locator('#dlg').innerText(), /Nothing has been sent yet/);
        await page.getByRole('button', { name: 'Look up these locations' }).click();
        await page.waitForFunction(() => !document.querySelector('#rr_opt').hidden);
        await assertNoOverflow(page, `${width} address-match review`);
        assert.equal(roadRequests.length, 1); assert.equal(roadRequests[0].action, 'geocode');
        assert.equal(roadRequests[0].addresses.length, 3);
        assert.doesNotMatch(JSON.stringify(roadRequests[0]), /Fictional Owner|555-0100/);
        assert.match(await page.locator('#rr_preview').innerText(), /Review address matches/);
        await page.getByRole('button', { name: 'Matches look right — optimize' }).click();
        await page.waitForFunction(() => !document.querySelector('#rr_save').hidden);
        await assertNoOverflow(page, `${width} driving-route preview`);
        assert.equal(roadRequests.length, 2); assert.equal(roadRequests[1].action, 'optimize');
        assert.doesNotMatch(JSON.stringify(roadRequests[1]), /Example Road|Fictional Owner/);
        assert.match(await page.locator('#rr_status').innerText(), /not saved yet/);
        await page.getByRole('button', { name: 'Save route order', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#rr_status').textContent.includes('Route order saved'));
        await page.locator('#dlg').getByRole('button', { name: 'Close' }).click();
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        assert.match(await page.locator('#main .card').nth(1).innerText(), /300 Example Road/);

        await page.getByRole('button', { name: 'Paste or upload route order' }).click();
        await assertNoOverflow(page, `${width} route dialog`);
        await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('blocked'); } } }); document.execCommand = () => false; });
        await page.getByRole('button', { name: "Copy this day's locations" }).click();
        await page.waitForFunction(() => document.querySelector('#ro_copy_details').open);
        assert.match(await page.locator('#ro_copy').inputValue(), /100 Example Road\n300 Example Road\n200 Example Road/);
        await page.locator('#ro_text').fill('300 Example Road\n100 Example Road');
        await page.getByRole('button', { name: 'Review order' }).click();
        assert.match(await page.locator('#ro_preview').innerText(), /2 matched stops/);
        await page.getByRole('button', { name: 'Save route order' }).click();
        await page.waitForFunction(() => document.querySelector('#ro_status').textContent.includes('Route order saved'));
        await page.locator('#dlg').getByRole('button', { name: 'Close' }).click();
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        assert.match(await page.locator('#main .card').first().innerText(), /300 Example Road/);
        assert.equal(await page.evaluate(() => window.__mock.rows.get('jobs/j3').data.client), 'c2');
        assert.equal(await page.evaluate(() => window.__mock.rows.get('jobs/j3').data.date), '2026-11-04');

        await page.locator('#main .card').first().getByRole('button', { name: 'Before / after photos' }).click();
        await page.waitForFunction(() => !document.querySelector('#ph_before_input').disabled);
        await assertNoOverflow(page, `${width} photos dialog`);
        const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 5; canvas.height = 5; canvas.getContext('2d').fillRect(0, 0, 5, 5); return canvas.toDataURL('image/png'); });
        const buffer = Buffer.from(png.split(',')[1], 'base64');
        await page.locator('#ph_before_input').setInputFiles({ name: 'fictional-before.png', mimeType: 'image/png', buffer });
        await page.waitForFunction(() => document.querySelector('#ph_status').textContent.includes('Before photo uploaded.'));
        assert.match(await page.locator('#ph_before_list').innerText(), /Before photo 1/);
        await page.locator('#ph_before_list').getByRole('button', { name: 'View' }).click();
        await page.waitForFunction(() => document.querySelector('#ph_view img')?.naturalWidth > 0);
        await page.locator('#ph_after_input').setInputFiles({ name: 'fictional-after.png', mimeType: 'image/png', buffer });
        await page.waitForFunction(() => document.querySelector('#ph_status').textContent.includes('After photo uploaded.'));
        assert.equal(await page.evaluate(() => window.__mock.photos.size), 2);
        assert.deepEqual(await page.evaluate(() => window.__mock.uploadedTypes), [['image/jpeg', 'image/jpeg'], ['image/jpeg', 'image/jpeg']]);
        assert.equal(await page.evaluate(() => Object.keys(localStorage).some(k => /data:image|base64/i.test(localStorage.getItem(k)))), false);
        await page.locator('#ph_before_list').getByRole('button', { name: 'Delete' }).click();
        await page.waitForFunction(() => document.querySelector('#ph_status').textContent.includes('Photo deleted.'));
        assert.equal(await page.evaluate(() => window.__mock.photos.size), 1);
        await page.locator('#dlg').getByRole('button', { name: 'Close' }).click();

        await page.getByRole('button', { name: 'Import addresses' }).click();
        await page.locator('#imp_mode').selectOption('jobs');
        await page.locator('#imp_client').selectOption('c1');
        await page.locator('#imp_date').fill('2026-11-04');
        await page.locator('#imp_service').selectOption({ label: 'Mow / edge / blow' });
        await page.locator('#imp_format').selectOption('gps');
        await page.locator('#imp_text').fill('30.2, -97.1\n30.1, -97.1');
        await assertNoOverflow(page, `${width} import dialog`);
        await page.getByRole('button', { name: 'Review import' }).click();
        assert.match(await page.locator('#imp_preview').innerText(), /2 scheduled jobs/);
        await page.getByRole('button', { name: 'Add addresses', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#imp_status').textContent.includes('Added 2 scheduled jobs'));
        await page.locator('#dlg').getByRole('button', { name: 'Close' }).click();
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        const locations = await page.locator('#main .card').allInnerTexts();
        assert.equal(locations.length, 5);
        assert.match(locations[0], /300 Example Road/);
        assert.match(locations[3], /30\.2, -97\.1/);
        assert.match(locations[4], /30\.1, -97\.1/);
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpectedRequests, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
