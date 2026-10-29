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
      upsert: async row => { if (window.__mock.blockWrites) return { error: { message: 'simulated offline' } }; rows.set(`${row.coll}/${row.id}`, row); window.__mock.writes.push(row); return { error: null }; },
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
  // The sandboxed Chromium binary can occasionally SIGSEGV at startup; retry
  // that launcher failure only, never browser assertions or application errors.
  for (let attempt = 0; ; attempt++) {
    try { return await playwright.chromium.launch({ executablePath, args: chromium.args.filter(a => a !== '--single-process'), headless: true }); }
    catch (error) { if (attempt >= 2 || !String(error).includes('SIGSEGV')) throw error; }
  }
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

test('next-stop mode separates navigation and completion, preserves other dates, repeats and pending sync', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, requests, errors } = await setup(browser, width);
      try {
        await page.evaluate(() => {
          Object.assign(S.jobs.j1, { repeat: 'Weekly', estimatedMinutes: 95, dateRequirement: 'deadline', requiredDate: '2026-11-04' });
          __mock.rows.get('jobs/j1').data = JSON.parse(JSON.stringify(S.jobs.j1));
        });
        await page.getByRole('button', { name: 'Pick addresses to route' }).click();
        await row(page, '100 Example Road').locator('input').check();
        await page.locator('#pick_scope').selectOption('all');
        await row(page, '700 Example Road').locator('input').check();
        await page.getByRole('button', { name: 'Route selected addresses', exact: true }).click();
        await page.getByRole('button', { name: 'Look up these locations' }).click();
        await page.getByRole('button', { name: 'Matches look right — optimize' }).click();
        await page.waitForSelector('#rr_next a');
        await noOverflow(page, `${width} next stop`);
        assert.match(await page.locator('#rr_next').innerText(), /Stop 1 of 2/);
        assert.equal(new URL(await page.getByRole('link', { name: 'Navigate to next stop' }).getAttribute('href')).searchParams.get('destination'), '30.1,-97');
        assert.equal(await page.evaluate(() => roadMapGuard()), true);
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        page.once('dialog', d => d.dismiss());
        await page.getByRole('button', { name: 'Mark done & next' }).click();
        assert.equal(await page.evaluate(() => S.jobs.j1.status), 'Scheduled');
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        await page.evaluate(() => { __mock.blockWrites = true; });
        let firstConfirmation = '';
        page.once('dialog', d => { firstConfirmation = d.message(); return d.accept(); });
        await page.getByRole('button', { name: 'Mark done & next' }).click();
        assert.match(firstConfirmation, /next repeating occurrence/i);
        await page.waitForFunction(() => S.jobs.j1.status === 'Done' && Object.keys(pending).length > 0);
        assert.equal(await page.evaluate(() => S.jobs.j1.date), '2026-11-04');
        const repeat = await page.evaluate(() => Object.values(S.jobs).find(j => j.id !== 'j1' && j.prop === S.jobs.j1.prop));
        assert.equal(repeat.date, '2026-11-11');
        assert.equal(repeat.status, 'Scheduled');
        assert.equal(repeat.estimatedMinutes, 95);
        assert.equal(repeat.dateRequirement, undefined);
        assert.match(await page.locator('#rr_next').innerText(), /Scheduled 2026-11-05.*did not reschedule/s);
        assert.equal(await page.locator('#rr_original').isVisible(), false);
        assert.equal(await page.evaluate(() => roadMapGuard()), false);
        await page.getByRole('button', { name: 'Skip for now' }).click();
        assert.match(await page.locator('#rr_status').innerText(), /Synced across devices/);
        assert.match(await page.locator('#rr_next').innerText(), /Stop 2 of 2/);
        await page.evaluate(() => { __mock.blockWrites = false; window.dispatchEvent(new Event('online')); });
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await page.evaluate(() => roadMapGuard()), true);
        let secondConfirmation = '';
        page.once('dialog', d => { secondConfirmation = d.message(); return d.accept(); });
        await page.getByRole('button', { name: 'Mark done & next' }).click();
        assert.match(secondConfirmation, /scheduled for 2026-11-05.*date will not change/is);
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await page.evaluate(() => S.jobs.j7.status), 'Done');
        assert.equal(await page.evaluate(() => S.jobs.j7.date), '2026-11-05');
        assert.match(await page.locator('#rr_next').innerText(), /No more stops/);
        assert.ok(requests.length >= 2); assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('next stop refuses stale jobs; skipping does not change any record', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 320);
    try {
      await page.getByRole('button', { name: 'Pick addresses to route' }).click();
      await row(page, '100 Example Road').locator('input').check();
      await page.getByRole('button', { name: 'Route selected addresses', exact: true }).click();
      await page.evaluate(() => { S.jobs.j1.prop = 'Changed fictional address, Austin, TX 78701'; });
      assert.equal(await page.evaluate(() => roadMapGuard()), false);
      await page.getByRole('button', { name: 'Mark done & next' }).click();
      assert.match(await page.locator('#rr_status').innerText(), /route changed/i);
      assert.equal(await page.evaluate(() => S.jobs.j1.status), 'Scheduled');
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      await page.getByRole('button', { name: 'Back to picks' }).click();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Pick addresses to route' }).click();
      await row(page, 'Changed fictional address').locator('input').check();
      await page.getByRole('button', { name: 'Route selected addresses', exact: true }).click();
      await page.getByRole('button', { name: 'Skip for now' }).click();
      assert.match(await page.locator('#rr_next').innerText(), /Skipped jobs are still scheduled/);
      assert.equal(await page.evaluate(() => S.jobs.j1.status), 'Scheduled');
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('daily next-stop mode follows existing order without an optimization request', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, requests, errors } = await setup(browser, 320);
    try {
      await page.evaluate(() => { S.jobs.missing.prop = '1200 Fictional Road, Austin, TX 78701'; __mock.rows.get('jobs/missing').data.prop = S.jobs.missing.prop; });
      await page.getByRole('button', { name: 'Next stop for this day' }).click();
      await noOverflow(page, '320 daily next stop');
      assert.match(await page.locator('#rr_next').innerText(), /Stop 1 of 7/);
      assert.match(await page.locator('#rr_next').innerText(), /100 Example Road/);
      assert.equal(requests.length, 0); assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      await page.getByRole('button', { name: 'Skip for now' }).click();
      assert.equal(await page.evaluate(() => S.jobs.j1.status), 'Scheduled');
      assert.match(await page.locator('#rr_next').innerText(), /200 Example Road/);
      page.once('dialog', d => d.accept());
      await page.getByRole('button', { name: 'Mark done & next' }).click();
      await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
      assert.equal(await page.evaluate(() => S.jobs.j2.status), 'Done');
      assert.equal(await page.evaluate(() => S.jobs.j2.date), '2026-11-04');
      assert.equal(requests.length, 0); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('due dashboard uses required dates, flags invalid requirements and edits estimates on a phone', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 320);
    try {
      await page.evaluate(() => {
        for (const id of ['fixed', 'late']) { delete S.jobs[id]; __mock.rows.delete(`jobs/${id}`); }
        const d = today();
        const cases = [
          { id:'over', service:'Overdue fictional service', date:addD(d,-4), dateRequirement:'deadline', requiredDate:addD(d,-1) },
          { id:'today', service:'Due today fictional service', date:d, dateRequirement:'exact', requiredDate:d },
          { id:'future', service:'Upcoming fictional service', date:d, dateRequirement:'deadline', requiredDate:addD(d,2) },
          { id:'invalid', service:'Missing date service', date:d, dateRequirement:'deadline', requiredDate:'' },
          { id:'badtype', service:'Invalid rule service', date:d, dateRequirement:'mystery', requiredDate:d },
          { id:'orphan', service:'Missing rule service', date:d, requiredDate:d },
          { id:'complete', service:'Completed service', date:d, status:'Done', dateRequirement:'deadline', requiredDate:addD(d,-1) },
          { id:'any', service:'Unrestricted service', date:d, dateRequirement:'any' },
        ];
        for (const item of cases) { const job = { client:'c1', prop:'Fictional Address, Austin, TX 78701', status:'Scheduled', ...item }; S.jobs[job.id] = job; __mock.rows.set(`jobs/${job.id}`, { coll:'jobs', id:job.id, data:JSON.parse(JSON.stringify(job)) }); }
      });
      await page.getByRole('button', { name: 'Due & overdue' }).click();
      await noOverflow(page, '320 due dashboard');
      const main = page.locator('#main');
      assert.match(await main.innerText(), /Overdue \(1\)/);
      assert.match(await main.innerText(), /Due today \(1\)/);
      assert.match(await main.innerText(), /Upcoming \(1\)/);
      assert.match(await main.innerText(), /Needs a valid requirement \(3\)/);
      assert.doesNotMatch(await main.innerText(), /Completed service|Unrestricted service/);
      const card = main.locator('.card', { hasText: 'Due today fictional service' });
      await card.getByRole('button', { name: 'Edit job' }).click();
      await page.locator('#j_minutes').fill('90');
      await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
      assert.equal(await page.evaluate(() => S.jobs.today.estimatedMinutes), 90);
      assert.match(await main.innerText(), /1 hr 30 min work/);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('multi-select lead deletion shows linked counts, requires confirmation and leaves unselected records', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, errors } = await setup(browser, width);
      try {
        await page.evaluate(() => {
          const client = { id:'keep', name:'Unselected client', stage:'Won', type:'Other / unknown', props:'', notes:'' };
          const job = { id:'keepjob', client:'keep', status:'Scheduled', date:'2026-11-04', prop:'5 Fictional Road', service:'Mow' };
          S.clients.keep = client; S.jobs.keepjob = job;
          __mock.rows.set('clients/keep', {coll:'clients',id:'keep',data:JSON.parse(JSON.stringify(client))});
          __mock.rows.set('jobs/keepjob', {coll:'jobs',id:'keepjob',data:JSON.parse(JSON.stringify(job))});
        });
        await page.getByRole('button', { name: 'Pipeline' }).click();
        await page.getByRole('button', { name: 'Select leads to delete' }).click();
        await noOverflow(page, `${width} lead selection`);
        await page.locator('#lead_list label', { hasText:'Fictional Client' }).locator('input').check();
        await page.locator('#lead_search').fill('Other Client');
        await page.locator('#lead_list label', { hasText:'Other Client' }).locator('input').check();
        assert.match(await page.locator('#lead_count').innerText(), /2 selected · 11 linked jobs/);
        let cancelled = '';
        page.once('dialog', d => { cancelled = d.message(); return d.dismiss(); });
        await page.getByRole('button', { name:'Delete selected leads' }).click();
        assert.match(cancelled, /2 leads AND 11 linked jobs/);
        assert.match(cancelled, /photo files are NOT deleted/i);
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        assert.equal(await page.evaluate(() => Object.keys(S.clients).length), 3);
        let accepted = '';
        page.once('dialog', d => { accepted = d.message(); return d.accept(); });
        await page.getByRole('button', { name:'Delete selected leads' }).click();
        assert.match(accepted, /2 leads AND 11 linked jobs/);
        await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
        const remaining = await page.evaluate(() => ({ clients:Object.keys(S.clients), jobs:Object.keys(S.jobs), rows:[...__mock.rows.keys()] }));
        assert.deepEqual(remaining.clients, ['keep']); assert.deepEqual(remaining.jobs, ['keepjob']);
        assert.deepEqual(remaining.rows.sort(), ['clients/keep', 'jobs/keepjob']);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('lead selection notices changed linked jobs and blocks deletion before confirmation', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 320);
    try {
      await page.getByRole('button', { name:'Pipeline' }).click();
      await page.getByRole('button', { name:'Select leads to delete' }).click();
      await page.locator('#lead_list label', { hasText:'Fictional Client' }).locator('input').check();
      await page.evaluate(() => { S.jobs.j1.service = 'Changed while selected'; });
      await page.getByRole('button', { name:'Delete selected leads' }).click();
      assert.match(await page.locator('#lead_status').innerText(), /linked jobs changed/i);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.ok(await page.evaluate(() => !!S.clients.c1 && !!S.jobs.j1));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('property removal and editing cannot silently redirect jobs using a default address', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 320);
    try {
      await page.evaluate(() => {
        S.clients.c1.props = '100 First Property, Austin, TX 78701\n200 Second Property, Austin, TX 78701';
        S.jobs.j1.prop = '';
        __mock.rows.get('clients/c1').data.props = S.clients.c1.props;
        __mock.rows.get('jobs/j1').data.prop = '';
      });
      await page.getByRole('button', { name:'Properties' }).click();
      const first = page.locator('#main .card', { hasText:'100 First Property' });
      let warning = '';
      page.once('dialog', d => { warning = d.message(); return d.accept(); });
      await first.getByRole('button', { name:'Delete property' }).click();
      assert.match(warning, /first property.*explicit address/i);
      assert.match(await page.evaluate(() => S.clients.c1.props), /^100 First Property/);
      await page.getByRole('button', { name:'Clients' }).click();
      await page.locator('#cl .card', { hasText:'Fictional Client' }).click();
      await page.locator('#c_props').fill('200 Second Property, Austin, TX 78701');
      page.once('dialog', d => { warning = d.message(); return d.accept(); });
      await page.locator('#dlg').getByRole('button', { name:'Save', exact:true }).click();
      assert.match(warning, /first property.*explicit address/i);
      assert.equal(await page.evaluate(() => jaddr(S.jobs.j1)), '100 First Property, Austin, TX 78701');
      await page.locator('#dlg').getByRole('button', { name:'Cancel' }).click();
      await page.getByRole('button', { name:'Jobs', exact:true }).click();
      await page.evaluate(() => openJob('j1'));
      await page.locator('#j_prop').fill('100 First Property, Austin, TX 78701');
      await page.locator('#dlg').getByRole('button', { name:'Save', exact:true }).click();
      await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
      await page.getByRole('button', { name:'Properties' }).click();
      page.once('dialog', d => d.accept());
      await page.locator('#main .card', { hasText:'100 First Property' }).getByRole('button', { name:'Delete property' }).click();
      await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
      assert.equal(await page.evaluate(() => S.clients.c1.props), '200 Second Property, Austin, TX 78701');
      assert.equal(await page.evaluate(() => jaddr(S.jobs.j1)), '100 First Property, Austin, TX 78701');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('daily next-stop mode becomes stale if another scheduled stop is added', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 320);
    try {
      await page.evaluate(() => { S.jobs.missing.prop = '1200 Fictional Road, Austin, TX 78701'; __mock.rows.get('jobs/missing').data.prop = S.jobs.missing.prop; });
      await page.getByRole('button', { name:'Next stop for this day' }).click();
      await page.evaluate(() => { S.jobs.newstop = { id:'newstop', client:'c1', date:rd, status:'Scheduled', service:'Mow', prop:'New fictional address, Austin, TX 78701' }; });
      assert.equal(await page.evaluate(() => roadMapGuard()), false);
      await page.getByRole('button', { name:'Mark done & next' }).click();
      assert.match(await page.locator('#rr_status').innerText(), /day's stops changed/i);
      assert.equal(await page.evaluate(() => S.jobs.j1.status), 'Scheduled');
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('route job deletion is explicit, cancelable and warns that private photos remain', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 320);
    try {
      const card = page.locator('#main .card', { hasText:'200 Example Road' });
      let message = '';
      page.once('dialog', d => { message = d.message(); return d.dismiss(); });
      await card.getByRole('button', { name:'Delete job' }).click();
      assert.match(message, /Delete the job for Other Client/);
      assert.match(message, /photo files are NOT deleted from storage/i);
      assert.equal(await page.evaluate(() => !!S.jobs.j2), true);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      page.once('dialog', d => d.accept());
      await card.getByRole('button', { name:'Delete job' }).click();
      await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
      assert.equal(await page.evaluate(() => !!S.jobs.j2), false);
      assert.equal(await page.evaluate(() => __mock.rows.has('jobs/j2')), false);
      assert.equal(await page.evaluate(() => !!S.clients.c2), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('phone Completed tab tracks finished work across Done, Invoiced and Paid without hiding unpaid jobs', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, requests, errors } = await setup(browser, width);
      try {
        await page.getByRole('button', { name: 'Jobs', exact: true }).click();
        const job = () => page.locator('#main .card', { hasText: '100 Example Road' });
        await job().getByRole('button', { name: '→ Done', exact: true }).click();
        await page.waitForFunction(() => S.jobs.j1.status === 'Done' && document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await job().count(), 1, 'Done job remains in Jobs → Open');
        await page.getByRole('button', { name: 'Completed', exact: true }).click();
        await noOverflow(page, `${width} completed work`);
        assert.match(await page.locator('#main').innerText(), /scheduled job dates, not completion dates/i);
        assert.match(await page.locator('#completed_count').innerText(), /2 completed jobs shown/);
        let completed = page.locator('#completed_list .card', { hasText: '100 Example Road' });
        assert.match(await completed.innerText(), /Fictional Client.*Done/s);
        assert.match(await completed.innerText(), /Scheduled: 2026-11-04/);
        assert.match(await completed.innerText(), /Price not set/);
        assert.equal(await completed.getByRole('button', { name: 'Before / after photos' }).count(), 1);
        await completed.getByRole('button', { name: 'Invoice', exact: true }).click();
        assert.equal(await page.locator('#doc h2').last().innerText(), 'Invoice');
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.locator('#completed_search').fill('1000 Done Road');
        assert.match(await page.locator('#completed_count').innerText(), /1 completed job shown/);
        assert.equal(await page.locator('#completed_list .card').count(), 1);
        await page.locator('#completed_filter').selectOption('Paid');
        assert.match(await page.locator('#completed_list').innerText(), /No completed jobs match/);
        await page.locator('#completed_filter').selectOption('All'); await page.locator('#completed_search').fill('');

        await page.getByRole('button', { name: 'Jobs', exact: true }).click();
        await job().getByRole('button', { name: '→ Invoiced', exact: true }).click();
        await page.waitForFunction(() => S.jobs.j1.status === 'Invoiced' && document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await job().count(), 1, 'Invoiced job remains in Jobs → Open');
        await page.getByRole('button', { name: 'Completed', exact: true }).click();
        completed = page.locator('#completed_list .card', { hasText: '100 Example Road' });
        assert.match(await completed.innerText(), /Invoiced/);
        await page.locator('#completed_filter').selectOption('Invoiced');
        assert.equal(await page.locator('#completed_list .card').count(), 1);
        await page.locator('#completed_filter').selectOption('All');

        await page.getByRole('button', { name: 'Jobs', exact: true }).click();
        await job().getByRole('button', { name: '→ Paid', exact: true }).click();
        await page.waitForFunction(() => S.jobs.j1.status === 'Paid' && document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await job().count(), 0, 'Paid job leaves Jobs → Open as before');
        await page.getByRole('button', { name: 'Completed', exact: true }).click();
        assert.match(await page.locator('#completed_list .card', { hasText: '100 Example Road' }).innerText(), /Paid/);
        await page.getByRole('button', { name: 'Route', exact: true }).click();
        await page.locator('#main .card', { hasText: '300 Example Road' }).getByRole('button', { name: 'Mark Done', exact: true }).click();
        await page.waitForFunction(() => S.jobs.j3.status === 'Done' && document.querySelector('#st').textContent === 'Synced across devices');
        await page.getByRole('button', { name: 'Completed', exact: true }).click();
        let routed = page.locator('#completed_list .card', { hasText: '300 Example Road' });
        assert.match(await routed.innerText(), /Done/);
        await routed.getByRole('button', { name: 'Edit job' }).click();
        await page.locator('#j_status').selectOption('Scheduled');
        await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForFunction(() => S.jobs.j3.status === 'Scheduled' && document.querySelector('#st').textContent === 'Synced across devices');
        assert.equal(await page.locator('#completed_list .card', { hasText: '300 Example Road' }).count(), 0);
        await page.getByRole('button', { name: 'Jobs', exact: true }).click();
        assert.equal(await page.locator('#main .card', { hasText: '300 Example Road' }).count(), 1);
        assert.equal(requests.length, 0); assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('phone Properties edits the intended job and clearly shows biweekly price, additional jobs and sync', {skip:!canRun&&'Install browser dependencies externally'}, async () => {
  const browser=await makeBrowser();
  try{
    for(const width of [320,390]){
      const {context,page,errors}=await setup(browser,width);
      try{
        await page.evaluate(()=>{
          S.clients.c1.props='100 First Fictional Property\n200 Second Fictional Property';
          __mock.rows.get('clients/c1').data=JSON.parse(JSON.stringify(S.clients.c1));
          Object.assign(S.jobs.j1,{prop:'',service:'Mow',date:'2026-11-04',status:'Scheduled',repeat:'One-time',price:35,items:'',notes:'Fictional original'});
          __mock.rows.get('jobs/j1').data=JSON.parse(JSON.stringify(S.jobs.j1));
          const later={id:'later',client:'c1',prop:'100 First Fictional Property',service:'Other',date:'2026-12-01',status:'Scheduled',repeat:'Weekly',price:75,items:'',notes:''};
          S.jobs.later=later;__mock.rows.set('jobs/later',{coll:'jobs',id:'later',data:JSON.parse(JSON.stringify(later))});
        });
        await page.getByRole('button',{name:'Properties',exact:true}).click();
        const card=()=>page.locator('#main .card',{hasText:'100 First Fictional Property'});
        await noOverflow(page,`${width} properties`);
        assert.match(await card().innerText(),/Earliest scheduled: 2026-11-04.*Mow/s);
        assert.match(await card().innerText(),/Repeat: One-time.*\$35/);
        assert.match(await card().innerText(),/View all scheduled and unscheduled jobs \(2\)/);
        assert.match(await card().innerText(),/\+ Job creates a new job/);
        await card().getByRole('button',{name:'Edit next job',exact:true}).click();await noOverflow(page,`${width} property job editor`);
        assert.equal(await page.locator('#j_service').inputValue(),'Mow','legacy service must not be silently replaced');
        assert.match(await page.locator('#j_rep').innerText(),/Every 2 weeks \(biweekly\)/);
        await page.locator('#j_rep').selectOption('Every 2 weeks');await page.locator('#j_price').fill('85.25');
        await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&__mock.rows.get('jobs/j1').data.price===85.25);
        assert.match(await page.locator('#job_save_message').innerText(),/Job changes synced across devices/);
        assert.match(await card().innerText(),/Repeat: Every 2 weeks \(biweekly\).*\$85\.25/);
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.service),'Mow');
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.prop),'');
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.notes),'Fictional original');
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/later').data.price),75);
        await page.locator('#job_save_notice').getByRole('button',{name:'Dismiss'}).click();

        await card().locator('summary').click();
        const later=()=>card().locator('li',{hasText:'2026-12-01'});
        assert.match(await later().innerText(),/Weekly.*\$75/);
        await later().getByRole('button',{name:'Edit job',exact:true}).click();
        await page.locator('#j_price').fill('88');await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&__mock.rows.get('jobs/later').data.price===88);
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.price),85.25);
        await page.locator('#job_save_notice').getByRole('button',{name:'Dismiss'}).click();
        await card().getByRole('link',{name:'+ Job',exact:true}).click();
        await page.locator('#j_date').fill('2026-12-15');await page.locator('#j_rep').selectOption('Every 2 weeks');await page.locator('#j_price').fill('95');
        await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
        await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&[...__mock.rows.values()].some(row=>row.coll==='jobs'&&row.data.date==='2026-12-15'&&row.data.prop==='100 First Fictional Property'));
        assert.match(await page.locator('#job_save_message').innerText(),/New job synced across devices/);
        assert.match(await card().innerText(),/View all scheduled and unscheduled jobs \(3\)/);
        await card().locator('summary').click();assert.match(await card().innerText(),/2026-12-15.*Every 2 weeks \(biweekly\).*\$95/s);
        assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.price),85.25);
        assert.deepEqual(errors,[]);
      }finally{await context.close()}
    }
  }finally{await browser.close()}
});

test('phone Properties can save biweekly and price on an unscheduled work order without creating a visit', {skip:!canRun&&'Install browser dependencies externally'}, async () => {
  const browser=await makeBrowser();
  try{
    const {context,page,errors}=await setup(browser,320);
    try{
      await page.evaluate(()=>{
        S.clients.c1.props='555 Fictional Rental';__mock.rows.get('clients/c1').data=JSON.parse(JSON.stringify(S.clients.c1));
        const data={id:'af-1',client:'c1',prop:'555 Fictional Rental',service:'Other',date:'',status:'Unscheduled',repeat:'One-time',price:'',items:'',notes:'',sourceAppfolio:{managerId:'c1',number:'250-1'},workDescription:'Fictional work',workOrderDetails:'Private fictional details'};
        S.jobs['af-1']=data;__mock.rows.set('jobs/af-1',{coll:'jobs',id:'af-1',data:JSON.parse(JSON.stringify(data))});
      });
      await page.getByRole('button',{name:'Properties',exact:true}).click();
      const card=()=>page.locator('#main .card',{hasText:'555 Fictional Rental'});
      assert.match(await card().innerText(),/Earliest scheduled: —/);assert.match(await card().innerText(),/Unscheduled job: Other.*Price not set/);
      await card().getByRole('button',{name:'Edit unscheduled job',exact:true}).click();
      const before=await page.evaluate(()=>Object.keys(S.jobs).length);
      assert.match(await page.locator('#dlg').innerText(),/set a repeat while a job is unscheduled/i);
      await page.locator('#j_rep').selectOption('Every 2 weeks');await page.locator('#j_price').fill('90');
      await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&__mock.rows.get('jobs/af-1').data.price===90);
      assert.equal(await page.evaluate(()=>S.jobs['af-1'].status),'Unscheduled');assert.equal(await page.evaluate(()=>S.jobs['af-1'].date),'');
      assert.equal(await page.evaluate(()=>Object.keys(S.jobs).length),before);
      assert.match(await card().innerText(),/Unscheduled job: Other.*Every 2 weeks \(biweekly\).*\$90/s);
      await page.locator('#job_save_notice').getByRole('button',{name:'Dismiss'}).click();
      await card().locator('summary').click();assert.match(await card().innerText(),/Unscheduled.*Every 2 weeks \(biweekly\).*\$90/s);
      await card().locator('li',{hasText:'Unscheduled'}).getByRole('button',{name:'Edit job'}).click();
      await page.locator('#j_status').selectOption('Scheduled');await page.locator('#j_date').fill('2026-11-04');
      await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&S.jobs['af-1'].status==='Scheduled');
      assert.match(await card().innerText(),/Every 2 weeks \(biweekly\).*\$90/);
      await page.locator('#job_save_notice').getByRole('button',{name:'Dismiss'}).click();
      await page.getByRole('button',{name:'Jobs',exact:true}).click();
      await page.locator('#main .card',{hasText:'AppFolio #250-1'}).getByRole('button',{name:'→ Done',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&Object.values(S.jobs).some(j=>j.id!=='af-1'&&j.prop==='555 Fictional Rental'));
      const next=await page.evaluate(()=>Object.values(S.jobs).find(j=>j.id!=='af-1'&&j.prop==='555 Fictional Rental'));
      assert.equal(next.date,'2026-11-18');assert.equal(next.repeat,'Every 2 weeks');assert.equal(next.price,90);
      assert.equal(next.sourceAppfolio,undefined);assert.equal(next.workOrderDetails,undefined);
      assert.deepEqual(errors,[]);
    }finally{await context.close()}
  }finally{await browser.close()}
});

test('phone job saves make offline retry and invalid legacy repeats explicit', {skip:!canRun&&'Install browser dependencies externally'}, async () => {
  const browser=await makeBrowser();
  try{
    const {context,page,errors}=await setup(browser,390);const alerts=[];
    page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.accept()});
    try{
      await page.evaluate(()=>{
        S.clients.c1.props='100 Example Road, Austin, TX 78701';__mock.rows.get('clients/c1').data=JSON.parse(JSON.stringify(S.clients.c1));
        Object.assign(S.jobs.j1,{repeat:'Biweekly',price:50,items:'',notes:''});__mock.rows.get('jobs/j1').data=JSON.parse(JSON.stringify(S.jobs.j1));
      });
      await page.getByRole('button',{name:'Properties',exact:true}).click();
      const card=()=>page.locator('#main .card',{hasText:'100 Example Road'});
      await card().getByRole('button',{name:'Edit next job'}).click();
      await page.evaluate(()=>{const row=__mock.rows.get('jobs/j1');row.data.notes='Fictional change from another device';__mock.listener({eventType:'UPDATE',new:JSON.parse(JSON.stringify(row))})});
      await page.locator('#j_price').fill('80');await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
      assert.match(alerts.at(-1),/job or its client changed/i);assert.match(await page.locator('#j_save_error').innerText(),/close and reopen/i);
      assert.equal(await page.evaluate(()=>__mock.writes.length),0);
      await page.locator('#dlg').getByRole('button',{name:'Cancel',exact:true}).click();await card().getByRole('button',{name:'Edit next job'}).click();
      assert.equal(await page.locator('#j_notes').inputValue(),'Fictional change from another device');
      assert.equal(await page.locator('#j_rep').inputValue(),'Biweekly');
      await page.locator('#j_price').fill('80');await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
      assert.match(alerts.at(-1),/supported repeat.*biweekly/i);assert.match(await page.locator('#j_save_error').innerText(),/supported repeat/i);
      assert.equal(await page.evaluate(()=>__mock.writes.length),0);
      await page.locator('#j_rep').selectOption('Every 2 weeks');await page.evaluate(()=>__mock.blockWrites=true);
      await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#job_save_message').textContent.includes('waiting to sync'));
      assert.notEqual(await page.locator('#st').innerText(),'Synced across devices');
      assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.price),50);
      assert.match(await page.evaluate(()=>localStorage.getItem('mib_pending_v1')),/Every 2 weeks/);
      await page.evaluate(()=>{__mock.blockWrites=false;window.dispatchEvent(new Event('online'))});
      await page.waitForFunction(()=>document.querySelector('#st').textContent==='Synced across devices'&&__mock.rows.get('jobs/j1').data.price===80);
      assert.match(await page.locator('#job_save_message').innerText(),/Job changes synced across devices/);
      assert.equal(await page.evaluate(()=>__mock.rows.get('jobs/j1').data.repeat),'Every 2 weeks');
      assert.deepEqual(errors,[]);
    }finally{await context.close()}
  }finally{await browser.close()}
});

test('an uncertain phone save disables repeat submission and asks the user to check existing jobs', {skip:!canRun&&'Install browser dependencies externally'}, async () => {
  const browser=await makeBrowser();
  try{
    const {context,page,errors}=await setup(browser,390);const alerts=[];
    page.on('dialog',dialog=>{alerts.push(dialog.message());return dialog.accept()});
    try{
      await page.evaluate(()=>{
        S.clients.c1.props='100 Example Road, Austin, TX 78701';__mock.rows.get('clients/c1').data=JSON.parse(JSON.stringify(S.clients.c1));
        window.originalWrite=w;w=(coll,record)=>{originalWrite(coll,record);throw Error('fictional error after queuing')};
      });
      await page.getByRole('button',{name:'Properties',exact:true}).click();
      await page.locator('#main .card',{hasText:'100 Example Road'}).getByRole('link',{name:'+ Job',exact:true}).click();
      await page.locator('#j_date').fill('2026-12-20');await page.locator('#j_price').fill('85');
      await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();
      assert.match(alerts.at(-1),/save result is uncertain.*check jobs.*duplicate/i);
      assert.match(await page.locator('#j_save_error').innerText(),/close this editor.*check jobs/i);
      assert.equal(await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
      await page.waitForFunction(()=>[...__mock.rows.values()].some(row=>row.coll==='jobs'&&row.data.date==='2026-12-20'&&row.data.price===85));
      assert.equal(await page.evaluate(()=>[...__mock.rows.values()].filter(row=>row.coll==='jobs'&&row.data.date==='2026-12-20').length),1);
      await page.evaluate(()=>w=window.originalWrite);await page.locator('#dlg').getByRole('button',{name:'Cancel',exact:true}).click();
      assert.match(await page.locator('#job_save_message').innerText(),/save may be incomplete.*before trying again/i);
      await page.getByRole('button',{name:'Jobs',exact:true}).click();assert.match(await page.locator('#main').innerText(),/2026-12-20/);
      assert.deepEqual(errors,[]);
    }finally{await context.close()}
  }finally{await browser.close()}
});
