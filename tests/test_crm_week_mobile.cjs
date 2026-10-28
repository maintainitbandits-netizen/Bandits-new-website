// Workweek UI smoke/integration tests. All records, tokens and provider replies
// are fictional and every network request is intercepted. No live data is used.
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
    { id: 'c1', name: 'Example Manager', type: 'Property manager', stage: 'Lead', props: '', notes: '' },
    { id: 'c2', name: 'Example Homeowner', type: 'Homeowner', stage: 'Lead', props: '', notes: '' },
  ];
  const jobs = [
    { id: 'old1', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: '10 Existing Road, Austin, TX 78701', service: 'Other', ord: 0 },
    { id: 'old2', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: '20 Existing Road, Austin, TX 78701', service: 'Other', ord: 1 },
  ];
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
      select: async () => ({ data: [...rows.values()], error: null }),
      upsert: async row => { rows.set(`${row.coll}/${row.id}`, row); window.__mock.writes.push(row); return { error: null }; },
      delete() { let coll; return { eq(k, v) { if (k === 'coll') { coll = v; return this; } rows.delete(`${coll}/${v}`); return Promise.resolve({ error: null }); } }; },
    }),
    channel: () => ({ on(_e, _f, fn) { window.__mock.listener = fn; return this; }, subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'), 0); return this; } }),
  };
  window.supabase = { createClient: () => client };
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, dialog: document.querySelector('#dlg').scrollWidth, width: document.querySelector('#dlg').clientWidth }));
  assert.ok(size.page <= size.viewport && size.dialog <= size.width, `${label} overflows: ${JSON.stringify(size)}`);
}

async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  return playwright.chromium.launch({ executablePath, args: chromium.args.filter(a => a !== '--single-process'), headless: true });
}
async function setupPage(browser, width, provider = {}) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript(installFakeCRM);
  // Keep the fixture week in the future even when these tests run years later.
  await context.addInitScript(() => {
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [2026, 9, 28, 12])); }
      static now() { return new RealDate(2026, 9, 28, 12).getTime(); }
    }
    window.Date = FixedDate;
  });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === 'https://crm.test/crm.html') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    if (url === 'https://crm.test/crm-week.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: weekScript });
    if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// fictional client injected' });
    if (url === 'https://crm.test/api/crm-route') {
      assert.equal(route.request().headers().authorization, 'Bearer fictional.jwt.token');
      const body = route.request().postDataJSON(); requests.push(body);
      if (provider.handle) return provider.handle(route, body);
      if (body.action === 'geocode') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matches: body.addresses.map((a, i) => ({ formatted: a, location: [30.1 + i * 0.01, -97.1], accuracy: 1, accuracyType: 'rooftop', ambiguous: false })) }) });
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
  return { context, page, requests, errors };
}
async function beginWeek(page, text) {
  await page.locator('.bar').getByRole('button', { name: 'Plan workweek' }).click();
  await page.locator('#wk_monday').fill('2026-11-02');
  await page.locator('#wk_client').selectOption('c1');
  await page.locator('#wk_text').fill(text);
  await page.getByRole('button', { name: 'Review jobs and dates' }).click();
}

const canRun = !!(playwright && chromium);
test('workweek preview, date editing, move/re-optimize and save work on narrow phones', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, requests, errors } = await setupPage(browser, width);
      try {
        await beginWeek(page, [
          '100 Example Road, Austin, TX 78701 | exact 2026-11-03',
          '200 Example Road, Austin, TX 78701 | due 2026-11-03',
          '300 Example Road, Austin, TX 78701',
          '400 Example Road, Austin, TX 78701',
          '500 Example Road, Austin, TX 78701',
          '600 Example Road, Austin, TX 78701',
          '400 Example Road, Austin, TX 78701',
        ].join('\n'));
        await noOverflow(page, `${width} date review`);
        assert.equal(requests.length, 0); assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        const third = page.locator('#wk_entries details').nth(2);
        await third.locator('summary').click();
        await third.locator('select').nth(0).selectOption('deadline');
        await third.locator('input[type=date]').fill('2026-11-05');
        await third.locator('select').nth(1).selectOption('c2');
        await third.locator('select').nth(2).selectOption('Other');
        assert.match(await third.locator('summary').innerText(), /Due by 2026-11-05/);
        await page.getByRole('button', { name: 'Review address sharing' }).click();
        await noOverflow(page, `${width} privacy disclosure`);
        assert.match(await page.locator('#dlg').innerText(), /possible duplicate/i);
        assert.equal(requests.length, 0);
        await page.getByRole('button', { name: 'Look up locations' }).click();
        await page.waitForSelector('#wk_suggest');
        await noOverflow(page, `${width} match review`);
        assert.equal(requests.length, 1); assert.equal(requests[0].action, 'geocode');
        assert.equal(requests[0].addresses.length, 6); // duplicate looked up only once
        assert.doesNotMatch(JSON.stringify(requests[0]), /Example Manager|2026-11-03|deadline/);
        await page.getByRole('button', { name: 'Matches look right — suggest week' }).click();
        await page.waitForSelector('#wk_save');
        await noOverflow(page, `${width} plan preview`);
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        assert.ok(requests.filter(x => x.action === 'optimize').length >= 1);
        requests.filter(x => x.action === 'optimize').forEach(input => {
          assert.doesNotMatch(JSON.stringify(input), /Example Road|Example Manager|2026-11/);
          assert.ok(input.stops.length >= 2 && input.stops.length <= 100);
        });
        const proposed = await page.evaluate(() => ({ entries: weekPlan.entries, orders: weekPlan.orders, days: weekPlan.days }));
        assert.ok(proposed.orders['2026-11-03'].includes(0));
        assert.ok(proposed.orders['2026-11-02'].includes(1) || proposed.orders['2026-11-03'].includes(1));
        const thirdDay = proposed.days.find(d => proposed.orders[d].includes(2));
        assert.ok(thirdDay <= '2026-11-05');
        const movable = proposed.entries.findIndex((e, i) => e.dateRequirement === 'any' && proposed.days.some(d => !proposed.orders[d].includes(i) && proposed.orders[d].length));
        const from = proposed.days.find(d => proposed.orders[d].includes(movable));
        const to = proposed.days.find(d => d !== from && proposed.orders[d].length);
        assert.ok(movable >= 0 && to);
        await page.locator(`#dlg select[data-i="${movable}"]`).selectOption(to);
        assert.equal(await page.locator('#wk_save').isDisabled(), true);
        await page.getByRole('button', { name: 'Re-optimize changed days' }).click();
        await page.waitForFunction(() => !document.querySelector('#wk_save').disabled);
        await page.getByRole('button', { name: 'Save all jobs' }).click();
        await page.waitForFunction(() => document.querySelector('#wk_status').textContent.includes('Added 7 jobs'));
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await page.locator('#dlg select[data-i]:enabled').count(), 0);
        const stored = await page.evaluate(() => [...__mock.rows.values()].filter(x => x.coll === 'jobs').map(x => x.data));
        assert.equal(stored.length, 9);
        assert.deepEqual(stored.filter(j => j.id.startsWith('old')).map(j => [j.id, j.date, j.ord]), [['old1', '2026-11-04', 0], ['old2', '2026-11-04', 1]]);
        const fixed = stored.find(j => j.prop.startsWith('100 Example'));
        assert.equal(fixed.date, '2026-11-03'); assert.equal(fixed.dateRequirement, 'exact'); assert.equal(fixed.requiredDate, '2026-11-03');
        const due = stored.find(j => j.prop.startsWith('300 Example'));
        assert.equal(due.client, 'c2'); assert.equal(due.service, 'Other'); assert.ok(due.date <= '2026-11-05');
        assert.equal(stored.filter(j => j.prop.startsWith('400 Example')).length, 2);
        const before = await page.evaluate(() => __mock.writes.length);
        await page.evaluate(() => weekSave());
        assert.equal(await page.evaluate(() => __mock.writes.length), before);
        await page.locator('#dlg').getByRole('button', { name: 'Close' }).click();
        await page.getByRole('button', { name: 'Route', exact: true }).click();
        await page.evaluate(() => { rd = '2026-11-05'; render(); });
        await page.evaluate(id => addStop(id), fixed.id);
        assert.match(await page.locator('#rmsg').innerText(), /must be done on 2026-11-03/i);
        assert.equal(await page.evaluate(id => S.jobs[id].date, fixed.id), '2026-11-03');
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('impossible date requirements and imprecise matches fail before any jobs are saved', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, requests, errors } = await setupPage(browser, 360, { handle: (route, input) => {
      if (input.action === 'geocode') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ matches: input.addresses.map(a => ({ formatted: a, location: [30.1, -97.1], accuracy: 1, accuracyType: 'city', ambiguous: false })) }) });
      throw new Error('No route optimization should be requested for an imprecise match');
    } });
    try {
      await beginWeek(page, '100 Example Road, Austin, TX 78701 | exact 2026-11-07');
      await page.getByRole('button', { name: 'Review address sharing' }).click();
      assert.match(await page.locator('#wk_problems').innerText(), /cannot be placed|No selected workday/i);
      assert.equal(requests.length, 0);
      await page.locator('#wk_entries details summary').click();
      await page.locator('#wk_entries select').first().selectOption('any');
      await page.getByRole('button', { name: 'Review address sharing' }).click();
      await page.getByRole('button', { name: 'Look up locations' }).click();
      await page.waitForFunction(() => document.querySelector('#wk_status').textContent.includes('too imprecise'));
      assert.equal(await page.locator('#wk_suggest').count(), 0);
      assert.equal(requests.length, 1);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('a text-file upload stays local until consent and rejects unsupported formats', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, requests, errors } = await setupPage(browser, 360);
    try {
      await page.locator('.bar').getByRole('button', { name: 'Plan workweek' }).click();
      await page.locator('#wk_monday').fill('2026-11-02');
      await page.locator('#wk_client').selectOption('c1');
      await page.locator('#wk_file').setInputFiles({ name: 'workorders.txt', mimeType: 'text/plain', buffer: Buffer.from('123 Fictional <img src=x onerror=alert(1)> Rd, Austin, TX 78701 | due 2026-11-05\n') });
      await page.waitForFunction(() => document.querySelector('#wk_status').textContent.includes('File loaded'));
      assert.match(await page.locator('#wk_text').inputValue(), /due 2026-11-05/);
      assert.equal(requests.length, 0);
      await page.getByRole('button', { name: 'Review jobs and dates' }).click();
      assert.equal(await page.locator('#wk_entries img').count(), 0);
      assert.match(await page.locator('#wk_entries').innerText(), /Due by 2026-11-05/);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      await page.getByRole('button', { name: 'Back to list and week' }).click();
      await page.locator('#wk_file').setInputFiles({ name: 'workorders.csv', mimeType: 'text/csv', buffer: Buffer.from('Address\nNot supported') });
      await page.waitForFunction(() => document.querySelector('#wk_status').textContent.includes('Choose a nonempty .txt file'));
      assert.match(await page.locator('#wk_text').inputValue(), /Fictional/);
      assert.equal(requests.length, 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('workdays in the past are rejected before locations or records leave the device', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, requests, errors } = await setupPage(browser, 360);
    try {
      await page.locator('.bar').getByRole('button', { name: 'Plan workweek' }).click();
      await page.locator('#wk_monday').fill('2026-10-19');
      await page.locator('#wk_client').selectOption('c1');
      await page.locator('#wk_text').fill('123 Example Road, Austin, TX 78701');
      await page.locator('#wk_days input').first().check();
      await page.getByRole('button', { name: 'Review jobs and dates' }).click();
      assert.match(await page.locator('#wk_status').innerText(), /workday is in the past/i);
      assert.equal(requests.length, 0); assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('planner can start with no clients and create them only after confirmation', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, requests, errors } = await setupPage(browser, 320);
    try {
      await page.evaluate(() => { __mock.rows.clear(); S.clients = {}; S.jobs = {}; render(); });
      await page.locator('.bar').getByRole('button', { name: 'Plan workweek' }).click();
      await page.locator('#wk_monday').fill('2026-11-02');
      await page.locator('#wk_client').selectOption('__week_new_client_per_address__');
      await page.getByText('Settings for any new clients').click();
      await page.locator('#wk_new_type').selectOption('Property manager');
      await page.locator('#wk_new_stage').selectOption('Won');
      await page.locator('#wk_text').fill('100 Example Road, Austin, TX 78701\n100 Example Road, Austin, TX 78701\n200 Example Road, Austin, TX 78701');
      await page.getByRole('button', { name: 'Review jobs and dates' }).click();
      await page.getByRole('button', { name: 'Review address sharing' }).click();
      assert.match(await page.locator('#dlg').innerText(), /possible duplicate/i);
      assert.equal(requests.length, 0); assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      await page.getByRole('button', { name: 'Look up locations' }).click();
      await page.waitForSelector('#wk_suggest');
      await page.getByRole('button', { name: 'Matches look right — suggest week' }).click();
      await page.waitForSelector('#wk_save');
      assert.match(await page.locator('#dlg').innerText(), /New client named by address/);
      await page.getByRole('button', { name: 'Save all jobs' }).click();
      await page.waitForFunction(() => document.querySelector('#wk_status').textContent.includes('Added 3 jobs and 2 new clients'));
      await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
      const rows = await page.evaluate(() => [...__mock.rows.values()]);
      const clients = rows.filter(x => x.coll === 'clients').map(x => x.data), jobs = rows.filter(x => x.coll === 'jobs').map(x => x.data);
      assert.equal(clients.length, 2); assert.equal(jobs.length, 3);
      assert.ok(clients.every(c => c.stage === 'Won' && c.type === 'Property manager'));
      assert.equal(jobs.filter(j => j.prop.startsWith('100 Example'))[0].client, jobs.filter(j => j.prop.startsWith('100 Example'))[1].client);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});
