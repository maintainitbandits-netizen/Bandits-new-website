// Estimates phone tests. All sessions, people and records are fictional, and
// every browser request is intercepted. These tests never touch live Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let playwright, chromium;
try { playwright = require('playwright-core'); chromium = require('@sparticuz/chromium').default; } catch (_) {}
const html = fs.readFileSync(path.join(__dirname, '../frontend/public/crm.html'), 'utf8');
const week = fs.readFileSync(path.join(__dirname, '../frontend/public/crm-week.js'), 'utf8');
const canRun = !!(playwright && chromium);

function fakeCRM() {
  const clients = [
    { id: 'c1', name: 'Fictional Client', stage: 'Lead', type: 'Homeowner', props: '123 Example Road, Austin, TX', notes: '' },
    { id: 'c2', name: 'Other Client', stage: 'Lead', type: 'Homeowner', props: '456 Example Road, Austin, TX', notes: '' },
  ];
  const jobs = [{ id: 'existing', client: 'c1', service: 'Mow / edge / blow', prop: '123 Example Road, Austin, TX', date: '2026-10-20', status: 'Done', price: 55, items: 'Mow | 1 | 55', notes: 'Job note' }];
  const rows = new Map();
  clients.forEach(data => rows.set(`clients/${data.id}`, { coll: 'clients', id: data.id, data }));
  jobs.forEach(data => rows.set(`jobs/${data.id}`, { coll: 'jobs', id: data.id, data }));
  let signedIn = false;
  window.__mock = { rows, writes: [], copied: '', prints: 0 };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__mock.copied = text; } } });
  window.print = () => { window.__mock.prints++; };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { access_token: 'fictional.jwt' } : null } }),
      signInWithPassword: async () => { signedIn = true; return { data: { session: { access_token: 'fictional.jwt' } }, error: null }; },
      signOut: async () => { signedIn = false; return { error: null }; },
    },
    from: () => ({
      select: async () => ({ data: [...rows.values()].map(row => JSON.parse(JSON.stringify(row))), error: null }),
      upsert: async row => { const saved = JSON.parse(JSON.stringify(row)); rows.set(`${row.coll}/${row.id}`, saved); window.__mock.writes.push(saved); return { error: null }; },
      delete() { let coll; return { eq(k, v) { if (k === 'coll') { coll = v; return this; } rows.delete(`${coll}/${v}`); window.__mock.writes.push({ coll, id: v, deleted: true }); return Promise.resolve({ error: null }); } }; },
    }),
    channel: () => ({ on(_e, _f, fn) { window.__mock.listener = fn; return this; }, subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'), 0); return this; } }),
  };
  window.supabase = { createClient: () => client };
}
async function makeBrowser() {
  process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs22.x';
  const executablePath = await chromium.executablePath();
  process.env.LD_LIBRARY_PATH = `/tmp/al2023/lib:${process.env.LD_LIBRARY_PATH || ''}`;
  for (let attempt = 0; ; attempt++) {
    try { return await playwright.chromium.launch({ executablePath, args: chromium.args.filter(a => a !== '--single-process'), headless: true }); }
    catch (error) { if (attempt >= 2 || !String(error).includes('SIGSEGV')) throw error; }
  }
}
async function setup(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript(fakeCRM);
  const page = await context.newPage(), errors = [], dialogs = [];
  let dismissNext = false;
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { dialogs.push({ type: d.type(), text: d.message() }); if (dismissNext) { dismissNext = false; return d.dismiss(); } return d.accept(); });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url === 'https://crm.test/crm.html') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    if (url === 'https://crm.test/crm-week.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: week });
    if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// mocked' });
    errors.push(`Unexpected network request: ${url}`); return route.abort();
  });
  await page.goto('https://crm.test/crm.html');
  await page.locator('#em').fill('fictional@example.invalid'); await page.locator('#pw').fill('not-a-real-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
  return { context, page, errors, dialogs, dismiss: () => { dismissNext = true; } };
}
async function noOverflow(page, label) {
  const dimensions = await page.evaluate(() => {
    const dlg = document.querySelector('#dlg'), doc = document.querySelector('#doc');
    return { viewport: innerWidth, body: document.documentElement.scrollWidth, dialog: dlg.open ? dlg.scrollWidth : 0, dialogWidth: dlg.open ? dlg.clientWidth : 0, doc: doc.hidden ? 0 : doc.scrollWidth, docWidth: doc.hidden ? 0 : doc.clientWidth };
  });
  assert.ok(dimensions.body <= dimensions.viewport && dimensions.dialog <= dimensions.dialogWidth && dimensions.doc <= dimensions.docWidth, `${label} overflow: ${JSON.stringify(dimensions)}`);
}
async function synced(page) { await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices'); }

test('phone estimates create, quote, schedule and choose retention for client deletions', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, errors, dialogs, dismiss } = await setup(browser, width);
      try {
        await page.getByRole('button', { name: 'Estimates', exact: true }).click(); await noOverflow(page, `${width} page`);
        assert.match(await page.locator('#est_jobs').innerText(), /Fictional Client/);
        await page.getByRole('button', { name: '+ New estimate' }).click(); await noOverflow(page, `${width} editor`);
        await page.locator('#es_client').selectOption('c1'); await page.locator('#es_service').selectOption('Mow / edge / blow');
        await page.locator('#es_property').fill('123 Example Road, Austin, TX'); await page.locator('#es_date').fill('2026-11-01');
        await page.locator('#es_status').selectOption('Sent');
        let first = page.locator('#es_lines .estimate-line').first();
        await first.locator('[data-field=description]').fill('Mulch <fictional>');
        await first.locator('[data-field=quantity]').fill('2.5'); await first.locator('[data-field=rate]').fill('19.99');
        await page.getByRole('button', { name: '+ Add line' }).click();
        let second = page.locator('#es_lines .estimate-line').nth(1);
        await second.locator('[data-field=description]').fill('Seed'); await second.locator('[data-field=quantity]').fill('0.5'); await second.locator('[data-field=rate]').fill('0.10');
        assert.match(await page.locator('#es_total').innerText(), /\$50\.03/);
        await page.locator('#es_notes').fill('Customer note <fictional>'); await page.locator('#es_team_notes').fill('Private internal note');
        await page.getByRole('button', { name: 'Save estimate', exact: true }).click(); await synced(page);
        assert.match(await page.locator('#est_saved').innerText(), /Fictional Client.*\$50\.03/s);
        assert.equal(await page.evaluate(() => [...__mock.rows.values()].filter(r => r.coll === 'estimates').length), 1);
        await page.locator('#est_saved').getByRole('button', { name: 'View', exact: true }).click(); await noOverflow(page, `${width} document`);
        assert.match(await page.locator('#doc').innerText(), /Mulch <fictional>/); assert.doesNotMatch(await page.locator('#doc').innerText(), /Private internal note/);
        await page.locator('#doc').getByRole('button', { name: 'Copy text' }).click();
        assert.match(await page.evaluate(() => __mock.copied), /Total: \$50\.03/); assert.doesNotMatch(await page.evaluate(() => __mock.copied), /Private internal note/);
        await page.locator('#doc').getByRole('button', { name: 'Print / PDF' }).click(); assert.equal(await page.evaluate(() => __mock.prints), 1);
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.locator('#est_saved').getByRole('button', { name: 'Schedule job' }).click(); await noOverflow(page, `${width} schedule`);
        assert.equal(await page.evaluate(() => Object.keys(S.jobs).length), 1);
        await page.locator('#es_job_date').fill('2026-11-10'); await page.getByRole('button', { name: 'Create scheduled job' }).click(); await synced(page);
        assert.match(dialogs.map(x => x.text).join('\n'), /Create a scheduled job.*\$50\.03/);
        const linked = await page.evaluate(() => Object.values(S.jobs).find(j => j.sourceEstimateId));
        assert.equal(linked.status, 'Scheduled'); assert.equal(linked.price, 50.03); assert.equal(linked.notes, 'Customer note <fictional>');
        assert.equal(await page.evaluate(() => Object.values(S.estimates)[0].status), 'Sent');
        await page.locator('#est_saved').getByRole('button', { name: 'View job' }).click();
        await page.locator('#j_items').fill('Mulch <fictional> | 2.5 | 19.99\nSeed | 0.5 | 0.10');
        assert.equal(await page.locator('#j_price').inputValue(), '50.03');
        await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click(); await synced(page);
        await page.locator('#est_jobs .card', { hasText: '2026-11-10' }).getByRole('button', { name: 'View quote' }).click(); await noOverflow(page, `${width} job quote`);
        assert.match(await page.locator('#doc').innerText(), /\$49\.98/); assert.match(await page.locator('#doc').innerText(), /Total: \$50\.03/);
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.locator('#est_jobs .card', { hasText: '2026-10-20' }).getByRole('button', { name: 'View quote' }).click();
        assert.equal(await page.locator('#doc h2').last().innerText(), 'Quote');
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.getByRole('button', { name: 'Jobs', exact: true }).click();
        await page.locator('#main .card', { hasText: '2026-10-20' }).getByRole('button', { name: 'Invoice', exact: true }).click();
        assert.equal(await page.locator('#doc h2').last().innerText(), 'Invoice'); await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.getByRole('button', { name: 'Clients', exact: true }).click();
        await page.locator('#cl .card', { hasText: 'Fictional Client' }).getByRole('button', { name: 'Delete client' }).click(); await noOverflow(page, `${width} client deletion`);
        await page.getByRole('button', { name: 'Review deletion' }).click(); assert.match(await page.locator('#client_delete_status').innerText(), /Choose whether to keep or delete/);
        await page.locator('#client_estimate_choice').selectOption('keep'); dismiss();
        await page.getByRole('button', { name: 'Review deletion' }).click(); assert.ok(await page.evaluate(() => S.clients.c1));
        assert.match(dialogs.at(-1).text, /KEEP 1 saved estimate.*including customer details/is); assert.match(dialogs.at(-1).text, /2 linked jobs/);
        await page.getByRole('button', { name: 'Review deletion' }).click(); await synced(page);
        assert.equal(await page.evaluate(() => !!S.clients.c1), false); assert.equal(await page.evaluate(() => Object.keys(S.jobs).length), 0);
        await page.getByRole('button', { name: 'Estimates', exact: true }).click();
        assert.match(await page.locator('#est_saved').innerText(), /Client deleted \(estimate kept\)/);
        await page.locator('#est_saved').getByRole('button', { name: 'View', exact: true }).click(); assert.match(await page.locator('#doc').innerText(), /Fictional Client/);
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.locator('#est_saved').getByRole('button', { name: 'Edit', exact: true }).click();
        await page.locator('#es_client').selectOption('c2'); await page.getByRole('button', { name: 'Save estimate' }).click(); await synced(page);
        assert.equal(await page.evaluate(() => Object.values(S.estimates)[0].clientName), 'Other Client');
        await page.getByRole('button', { name: 'Clients', exact: true }).click();
        await page.locator('#cl .card', { hasText: 'Other Client' }).getByRole('button', { name: 'Delete client' }).click();
        await page.locator('#client_estimate_choice').selectOption('delete'); await page.getByRole('button', { name: 'Review deletion' }).click(); await synced(page);
        assert.match(dialogs.at(-1).text, /DELETE 1 saved estimate/); assert.equal(await page.evaluate(() => Object.keys(S.estimates).length), 0);
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('phone multi-lead deletion requires a new keep-or-delete choice when selection changes', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors, dialogs, dismiss } = await setup(browser, 320);
    try {
      await page.evaluate(() => {
        for (const [id, client, clientName] of [['e1', 'c1', 'Fictional Client'], ['e2', 'c2', 'Other Client']]) {
          const e = { id, client, clientName, service: 'Mow / edge / blow', property: '', date: '2026-11-01', status: 'Draft', lines: [{ description: 'Work', quantityMilli: 1000, unitCents: 5000 }], totalCents: 5000, notes: '', teamNotes: '' };
          S.estimates[id] = e; __mock.rows.set(`estimates/${id}`, { coll: 'estimates', id, data: JSON.parse(JSON.stringify(e)) });
        }
      });
      await page.getByRole('button', { name: 'Select leads to delete' }).click(); await noOverflow(page, '320 lead deletion');
      await page.locator('#lead_list label', { hasText: 'Fictional Client' }).locator('input').check();
      assert.equal(await page.locator('#lead_estimate_option').isVisible(), true);
      await page.locator('#lead_estimate_choice').selectOption('keep');
      await page.locator('#lead_list label', { hasText: 'Other Client' }).locator('input').check();
      assert.equal(await page.locator('#lead_estimate_choice').inputValue(), '');
      assert.match(await page.locator('#lead_count').innerText(), /2 selected.*2 saved estimates/);
      await page.getByRole('button', { name: 'Delete selected leads' }).click();
      assert.match(await page.locator('#lead_status').innerText(), /Choose whether to keep or delete/);
      await page.locator('#lead_estimate_choice').selectOption('delete'); dismiss();
      await page.getByRole('button', { name: 'Delete selected leads' }).click(); assert.equal(await page.evaluate(() => Object.keys(S.clients).length), 2);
      assert.match(dialogs.at(-1).text, /DELETE 2 saved estimates/);
      await page.getByRole('button', { name: 'Delete selected leads' }).click(); await synced(page);
      assert.equal(await page.evaluate(() => Object.keys(S.clients).length), 0); assert.equal(await page.evaluate(() => Object.keys(S.estimates).length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});
