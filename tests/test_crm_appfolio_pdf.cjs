// Fictional PDFs, clients and jobs only. All browser network traffic is
// intercepted; no AppFolio login, live Supabase or customer information is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
let playwright, chromium;
try { playwright = require('playwright-core'); chromium = require('@sparticuz/chromium').default; } catch (_) {}
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'frontend/public/crm.html'), 'utf8');
const week = fs.readFileSync(path.join(root, 'frontend/public/crm-week.js'), 'utf8');
const pdfReader = fs.readFileSync(path.join(root, 'frontend/public/crm-pdf.mjs'));
const pdfLib = fs.readFileSync(path.join(root, 'frontend/public/crm-pdfjs/pdf.min.mjs'));
const pdfWorker = fs.readFileSync(path.join(root, 'frontend/public/crm-pdfjs/pdf.worker.min.mjs'));
const canRun = !!(playwright && chromium);

// A minimal text PDF generated at test time; no vendor or resident data.
function makePdf(pages) {
  const objects = [];
  const count = pages.length, fontId = 3 + count * 2;
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Count ${count} /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] >>`;
  const escape = s => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  pages.forEach((lines, i) => {
    const pageId = 3 + i * 2, contentId = pageId + 1;
    const positioned = lines.length && typeof lines[0] === 'object';
    const operators = positioned
      ? lines.map(line => `1 0 0 1 ${line.x} ${line.y} Tm\n(${escape(line.text)}) Tj`).join('\n')
      : `14 TL\n50 760 Td\n${lines.map(line => `(${escape(line)}) Tj\nT*`).join('\n')}`;
    const stream = `BT\n/F1 11 Tf\n${operators}\nET\n`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}endstream`;
  });
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  let pdf = '%PDF-1.4\n', offsets = [0];
  for (let i = 1; i < objects.length; i++) { offsets[i] = Buffer.byteLength(pdf, 'latin1'); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
function file(name, lines, extraPages = []) {
  return { name, mimeType: 'application/pdf', buffer: makePdf([lines, ...extraPages]) };
}
const FIRST = ['Work Order # 250-1', 'Service Address: 100 Example Road', 'Austin, TX 78701', 'Job Description: Fictional landscape cleanup', 'Private Fictional Instructions: check in at desk'];
const SECOND = ['Work Order Number: 251-1', 'Property Address: 200 Example Lane, Austin, TX 78702', 'Job Description: Fictional make-ready cleanup'];
// A fictional two-column layout. Values are deliberately drawn before their
// labels, as some PDF producers do; none of the text comes from a real order.
const COLUMN_PDF = [
  { text: 'Fictional Property Office', x: 36, y: 730 },
  { text: '984-8', x: 426, y: 730 },
  { text: 'Assigned', x: 426, y: 712 },
  { text: '12/31/2031', x: 426, y: 694 },
  { text: '120 Example Lane Unit', x: 426, y: 610 },
  { text: '7B', x: 426, y: 598 },
  { text: '120 Example Lane Unit', x: 426, y: 586 },
  { text: '7B', x: 426, y: 574 },
  { text: 'Exampletown, TX 70001', x: 426, y: 562 },
  { text: 'Fictional garden repair', x: 36, y: 438 },
  { text: 'Bring a fictional tool', x: 36, y: 426 },
  { text: 'Fictional person', x: 141, y: 210 },
  { text: 'Work Order #', x: 280, y: 730 },
  { text: 'Status', x: 280, y: 712 },
  { text: 'Scheduled on', x: 280, y: 694 },
  { text: 'Job Site', x: 280, y: 610 },
  { text: 'Additional Field', x: 280, y: 545 },
  { text: '--', x: 426, y: 545 },
  { text: 'Description', x: 36, y: 460 },
  { text: 'Created by:', x: 36, y: 210 },
];
// A generated blank, password-protected PDF containing no real data.
const ENCRYPTED = 'JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPDU5M2QxM2NhMWU+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCA2MTIgNzkyIF0KL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovViAyCi9SIDMKL0xlbmd0aCAxMjgKL1AgNDI5NDk2NzI5MgovRmlsdGVyIC9TdGFuZGFyZAovTyA8MWFkNTQxYzcwMTZiM2I1OTQ1MmMxMmVhMGY3ZjQ3Y2QxYzJjMTRmMDhmNGJkZWE3YjE3NzQyNWEwMDQ2ZjUzND4KL1UgPDI2MmQxMzc5YmFiOGVhNzk5MzRjNzE1OWFmYTMyZDBiMjhiZjRlNWU0ZTc1OGE0MTY0MDA0ZTU2ZmZmYTAxMDg+Cj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI2MSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMyAwIFIKL0luZm8gMSAwIFIKL0lEIFsgPDM1NjEzMTMyNjIzNzY0MzczODM1NjEzNjY0MzUzNTM3MzUzNjM5NjI2MjM3MzA2NDMyMzQzMjMyNjEzNzMwMzk+IDwzNTYxMzEzMjYyMzc2NDM3MzgzNTYxMzY2NDM1MzUzNzM1MzYzOTYyNjIzNzMwNjQzMjM0MzIzMjYxMzczMDM5PiBdCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgo0NzYKJSVFT0YK';

function fakeCRM() {
  const clients = [
    { id: 'c1', name: 'Fictional Manager One', stage: 'Won', type: 'Property manager', props: '', notes: '' },
    { id: 'c2', name: 'Fictional Manager Two', stage: 'Won', type: 'Property manager', props: '', notes: '' },
  ];
  const rows = new Map();
  clients.forEach(data => rows.set(`clients/${data.id}`, { coll: 'clients', id: data.id, data }));
  let signedIn = false;
  window.__mock = { rows, writes: [], failed: false, copied: '' };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__mock.copied = text; } } });
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { access_token: 'fictional.jwt' } : null } }),
      signInWithPassword: async () => { signedIn = true; return { data: { session: { access_token: 'fictional.jwt' } }, error: null }; },
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: async () => ({ data: [...rows.values()].map(row => JSON.parse(JSON.stringify(row))), error: null }),
      upsert: async row => { if (window.__mock.failed) return { error: { message: 'fictional failure' } }; const copy = JSON.parse(JSON.stringify(row)); rows.set(`${row.coll}/${row.id}`, copy); window.__mock.writes.push(copy); return { error: null }; },
      delete() { let coll; return { eq(k, v) { if (k === 'coll') { coll = v; return this; } rows.delete(`${coll}/${v}`); return Promise.resolve({ error: null }); } }; },
    }),
    channel: () => ({ on(_event, _filter, listener) { window.__mock.listener = listener; return this; }, subscribe(callback) { setTimeout(() => callback('SUBSCRIBED'), 0); return this; } }),
  }) };
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
async function setup(browser, width, options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript(fakeCRM);
  const page = await context.newPage(), errors = [], requests = [], dialogs = [];
  let dismissNext = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => { dialogs.push({ type: dialog.type(), text: dialog.message() }); if (dismissNext) { dismissNext = false; return dialog.dismiss(); } return dialog.accept(); });
  await page.route('**/*', async route => {
    const request = route.request(), url = request.url(); requests.push({ url, method: request.method(), postData: request.postData() });
    if (url === 'https://crm.test/crm.html') return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    if (url === 'https://crm.test/crm-week.js') return route.fulfill({ status: 200, contentType: 'application/javascript', body: week });
    if (url === 'https://crm.test/crm-pdf.mjs') { if (options.readerDelay) await new Promise(resolve => setTimeout(resolve, options.readerDelay)); return route.fulfill({ status: 200, contentType: 'application/javascript', body: pdfReader }); }
    if (url === 'https://crm.test/crm-pdfjs/pdf.min.mjs') return route.fulfill({ status: 200, contentType: 'application/javascript', body: pdfLib });
    if (url === 'https://crm.test/crm-pdfjs/pdf.worker.min.mjs') return route.fulfill({ status: 200, contentType: 'application/javascript', body: pdfWorker });
    if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '// fictional client injected' });
    errors.push(`Unexpected request: ${url}`); return route.abort();
  });
  await page.goto('https://crm.test/crm.html');
  await page.locator('#em').fill('fictional@example.invalid'); await page.locator('#pw').fill('not-a-real-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices');
  return { context, page, errors, requests, dialogs, dismiss: () => { dismissNext = true; } };
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => { const d = document.querySelector('#dlg'); return { viewport: innerWidth, body: document.documentElement.scrollWidth, dialog: d.scrollWidth, width: d.clientWidth }; });
  assert.ok(size.body <= size.viewport && size.dialog <= size.width, `${label} overflows: ${JSON.stringify(size)}`);
}
async function loaded(page) { await page.waitForFunction(() => /PDFs read/.test(document.querySelector('#af_status')?.textContent || ''), null, { timeout: 30000 }); }
async function synced(page) { await page.waitForFunction(() => document.querySelector('#st').textContent === 'Synced across devices'); }

test('PDF field suggestions are conservative and do not infer dates or statuses', async () => {
  const module = await import(pathToFileURL(path.join(root, 'frontend/public/crm-pdf.mjs')).href);
  assert.deepEqual(module.suggestWorkOrderFields(FIRST.join('\n')), { number: '250-1', location: '100 Example Road, Austin, TX 78701', description: 'Fictional landscape cleanup' });
  assert.deepEqual(module.suggestWorkOrderFields(SECOND.join('\n')), { number: '251-1', location: '200 Example Lane, Austin, TX 78702', description: 'Fictional make-ready cleanup' });
  assert.deepEqual(module.suggestWorkOrderFields('Work Order Details\nStatus: On hold\nScheduled: 2026-11-04'), { number: '', location: '', description: '' });
  assert.deepEqual(module.suggestWorkOrderFields('Work Order\n#93-7\nProperty Address:\n55 Example St'), { number: '93-7', location: '55 Example St', description: '' });
  assert.equal(module.suggestWorkOrderFields('Work Description:\nFictional repair\nStatus: On hold').description, 'Fictional repair');
  assert.equal(module.suggestWorkOrderFields('Work Description:\nStatus: On hold').description, '');
  assert.deepEqual(module.textItemsToLines([
    { str: 'Work Order', transform: [1, 0, 0, 1, 10, 700], width: 50 },
    { str: '#250-1', transform: [1, 0, 0, 1, 63, 700], width: 40, hasEOL: true },
    { str: 'Second line', transform: [1, 0, 0, 1, 10, 685], width: 80 },
  ]), ['Work Order #250-1', 'Second line']);
  const items = COLUMN_PDF.map(row => ({ str: row.text, transform: [1, 0, 0, 1, row.x, row.y], width: row.text.length * 5.3 }));
  const positioned = module.suggestPositionedWorkOrderFields(items);
  assert.equal(positioned.number, '984-8');
  assert.equal(positioned.location, '120 Example Lane Unit 7B, Exampletown, TX 70001');
  assert.equal(positioned.description, 'Fictional garden repair\nBring a fictional tool');
  assert.equal(positioned.complete, true);
  assert.equal(module.suggestPositionedWorkOrderFields(items.filter(item => item.str !== 'Job Site')), null);
  assert.equal(module.suggestPositionedWorkOrderFields([...items, items.find(item => item.str === 'Job Site')]), null);
  assert.equal(module.suggestPositionedWorkOrderFields([...items, { str: 'Fictional text without a position' }]).complete, false);
  const splitBody = items.filter(item => item.str !== 'Fictional garden repair').concat([
    { str: 'Fictional ', transform: [1, 0, 0, 1, 36, 438], width: 40 },
    { str: 'garden ', transform: [1, 0, 0, 1, 76, 438], width: 32 },
    { str: 'repair', transform: [1, 0, 0, 1, 108, 438], width: 28 },
  ]);
  assert.equal(module.suggestPositionedWorkOrderFields(splitBody).description, 'Fictional garden repair\nBring a fictional tool');
  const closeFooter = items.map(item => item.str === 'Created by:' ? { ...item, transform: [1, 0, 0, 1, 36, 408] } : item);
  assert.equal(module.suggestPositionedWorkOrderFields(closeFooter).description, 'Fictional garden repair\nBring a fictional tool');
});

test('a fictional two-column work order is matched by position and still requires review', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors, requests } = await setup(browser, 390);
    try {
      await page.getByRole('button', { name: 'Import work order PDFs' }).click();
      await page.locator('#af_file').setInputFiles([file('fictional-columns.pdf', COLUMN_PDF)]); await loaded(page);
      await noOverflow(page, 'two-column PDF review');
      assert.equal(await page.locator('#af_number_0').inputValue(), '984-8');
      assert.equal(await page.locator('#af_location_0').inputValue(), '120 Example Lane Unit 7B, Exampletown, TX 70001');
      assert.equal(await page.locator('#af_description_0').inputValue(), 'Fictional garden repair\nBring a fictional tool');
      assert.equal(await page.locator('#af_date_0').inputValue(), '');
      const raw = await page.locator('#af_details_0').inputValue();
      assert.ok(raw.indexOf('Work Order #') < raw.indexOf('Assigned'));
      assert.match(raw, /Fictional person/); assert.match(raw, /12\/31\/2031/);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      await page.locator('#af_client_0').selectOption('c1');
      await page.getByRole('button', { name: 'Import selected jobs' }).click(); await synced(page);
      const job = await page.evaluate(() => Object.values(S.jobs)[0]);
      assert.equal(job.sourceAppfolio.number, '984-8'); assert.equal(job.status, 'Unscheduled'); assert.equal(job.date, '');
      assert.equal(job.prop, '120 Example Lane Unit 7B, Exampletown, TX 70001');
      assert.equal(job.workDescription, 'Fictional garden repair\nBring a fictional tool'); assert.equal(job.notes, '');
      assert.ok(requests.every(request => request.method === 'GET' && !request.postData));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('multiple PDFs are read locally, reviewed, imported and scheduled on narrow phones', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    for (const width of [320, 390]) {
      const { context, page, errors, requests, dialogs } = await setup(browser, width);
      try {
        await page.getByRole('button', { name: 'Import work order PDFs' }).click();
        assert.equal(await page.locator('#af_file').getAttribute('multiple'), '');
        await noOverflow(page, `${width} import setup`);
        await page.locator('#af_file').setInputFiles([file('one.pdf', FIRST), file('two.pdf', SECOND, [[]]), file('empty.pdf', [])]);
        await loaded(page); await noOverflow(page, `${width} PDF review`);
        assert.match(await page.locator('#af_count').innerText(), /3 PDFs loaded.*2 selected.*1 could not be read/);
        assert.match(await page.locator('#af_list').innerText(), /No selectable text/);
        assert.match(await page.locator('#af_list').innerText(), /page\(s\) without selectable text/);
        assert.equal(await page.locator('#af_number_0').inputValue(), '250-1');
        assert.equal(await page.locator('#af_location_0').inputValue(), '100 Example Road, Austin, TX 78701');
        assert.equal(await page.locator('#af_number_1').inputValue(), '251-1');
        assert.equal(await page.locator('#af_description_0').inputValue(), 'Fictional landscape cleanup');
        assert.match(await page.locator('#af_details_0').inputValue(), /Private Fictional Instructions/);
        assert.equal(await page.locator('#af_category_0').inputValue(), '');
        assert.equal(await page.locator('#af_category_1').inputValue(), '');
        await page.locator('#af_batch_category').selectOption('Cleaning');
        await page.getByRole('button', { name: 'Apply category to all' }).click();
        assert.equal(await page.locator('#af_category_0').inputValue(), 'Cleaning');
        assert.equal(await page.locator('#af_category_1').inputValue(), 'Cleaning');
        await page.locator('#af_category_1').selectOption('Maintenance');
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        await page.locator('#af_batch_client').selectOption('c1');
        await page.evaluate(() => { S.clients.c1.name = 'Renamed manager'; });
        await page.getByRole('button', { name: 'Apply client to all' }).click();
        assert.match(await page.locator('#af_status').innerText(), /client changed/i);
        assert.equal(await page.locator('#af_client_0').inputValue(), '');
        await page.evaluate(() => { S.clients.c1.name = 'Fictional Manager One'; });
        await page.getByRole('button', { name: 'Apply client to all' }).click();
        assert.equal(await page.locator('#af_client_0').inputValue(), 'c1');
        await page.locator('#af_client_1').selectOption('c2');
        await page.locator('#af_service_1').selectOption('Make-ready cleanup');
        await page.locator('#af_date_1').fill('2026-11-10');
        await page.locator('#af_location_0').fill('');
        await page.getByRole('button', { name: 'Import selected jobs' }).click();
        assert.match(await page.locator('#af_status').innerText(), /enter the property \/ unit address/i);
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        await page.locator('#af_location_0').fill('100 Example Road, Austin, TX 78701');
        await page.locator('#af_description_0').fill('');
        await page.getByRole('button', { name: 'Import selected jobs' }).click();
        assert.match(await page.locator('#af_status').innerText(), /enter the work description/i);
        assert.equal(await page.evaluate(() => __mock.writes.length), 0);
        await page.locator('#af_description_0').fill('Edited fictional landscape cleanup');
        await page.getByRole('button', { name: 'Import selected jobs' }).click();
        assert.match(dialogs.at(-1).text, /2 reviewed work orders as 1 scheduled and 1 unscheduled/i);
        await synced(page);
        const jobs = await page.evaluate(() => Object.values(S.jobs));
        assert.equal(jobs.length, 2);
        const first = jobs.find(j => j.sourceAppfolio.number === '250-1'), second = jobs.find(j => j.sourceAppfolio.number === '251-1');
        assert.equal(first.status, 'Unscheduled'); assert.equal(first.date, ''); assert.equal(first.client, 'c1');
        assert.equal(second.status, 'Scheduled'); assert.equal(second.date, '2026-11-10'); assert.equal(second.client, 'c2');
        assert.equal(second.service, 'Make-ready cleanup'); assert.equal(first.price, ''); assert.equal(first.notes, '');
        assert.equal(first.workCategory, 'Cleaning'); assert.equal(second.workCategory, 'Maintenance');
        assert.equal(first.workDescription, 'Edited fictional landscape cleanup');
        assert.match(first.workOrderDetails, /Fictional landscape cleanup/);
        assert.equal(jobs.some(j => 'pdf' in j || 'file' in j), false);
        assert.ok(requests.every(r => r.method === 'GET' && !r.postData), 'PDF bytes or job data were sent over the browser network');
        await page.locator('#dlg').getByRole('button', { name: 'Close', exact: true }).click();
        await page.getByRole('button', { name: 'Jobs', exact: true }).click();
        const unscheduled = page.locator('#main .card', { hasText: 'AppFolio #250-1' });
        assert.match(await unscheduled.innerText(), /Unscheduled/); assert.match(await unscheduled.innerText(), /Price not set/);
        await unscheduled.getByRole('button', { name: 'Quote', exact: true }).click();
        assert.match(dialogs.at(-1).text, /no price.*enter a price/i);
        assert.equal(await page.locator('#doc').isHidden(), true);
        await unscheduled.getByRole('button', { name: 'Schedule', exact: true }).click();
        assert.equal(await page.locator('#j_date').inputValue(), '');
        assert.equal(await page.locator('#j_status').inputValue(), 'Scheduled');
        assert.equal(await page.locator('#j_work_description').inputValue(), 'Edited fictional landscape cleanup');
        await page.locator('#j_work_description').fill('Private edited work description');
        await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click();
        assert.match(dialogs.at(-1).text, /Choose a date before scheduling/i);
        assert.equal(await page.evaluate(id => S.jobs[id].status, first.id), 'Unscheduled');
        await page.locator('#j_date').fill('2026-11-11'); await page.locator('#j_price').fill('55');
        await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click();
        await synced(page);
        assert.equal(await page.evaluate(id => S.jobs[id].status, first.id), 'Scheduled');
        assert.equal(await page.evaluate(id => S.jobs[id].date, first.id), '2026-11-11');
        assert.equal(await page.evaluate(id => S.jobs[id].workDescription, first.id), 'Private edited work description');
        await page.locator('#main .card', { hasText: 'AppFolio #250-1' }).getByRole('button', { name: 'Quote', exact: true }).click();
        assert.doesNotMatch(await page.locator('#doc').innerText(), /Private Fictional Instructions|Private edited work description/);
        await page.locator('#doc').getByRole('button', { name: 'Copy text' }).click();
        assert.doesNotMatch(await page.evaluate(() => __mock.copied), /Private Fictional Instructions|Private edited work description/);
        assert.match(await page.evaluate(() => __mock.copied), /Total: \$55/);
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        await page.locator('#main .card', { hasText: 'AppFolio #250-1' }).getByRole('button', { name: '→ Done' }).click();
        await synced(page);
        await page.locator('#main .card', { hasText: 'AppFolio #250-1' }).getByRole('button', { name: 'Invoice', exact: true }).click();
        assert.doesNotMatch(await page.locator('#doc').innerText(), /Private Fictional Instructions|Private edited work description/);
        await page.locator('#doc').getByRole('button', { name: 'Copy text' }).click();
        assert.doesNotMatch(await page.evaluate(() => __mock.copied), /Private Fictional Instructions|Private edited work description/);
        await page.locator('#doc').getByRole('button', { name: 'Close' }).click();
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test('duplicate work orders are identified per manager, including within one selected batch', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors, dialogs } = await setup(browser, 390);
    try {
      await page.getByRole('button', { name: 'Import work order PDFs' }).click();
      await page.locator('#af_file').setInputFiles([file('first.pdf', FIRST), file('duplicate.pdf', FIRST)]); await loaded(page);
      await page.locator('#af_batch_client').selectOption('c1'); await page.getByRole('button', { name: 'Apply client to all' }).click();
      assert.match(await page.locator('#af_issue_0').innerText(), /Another selected PDF/);
      assert.match(await page.locator('#af_issue_1').innerText(), /Another selected PDF/);
      await page.getByRole('button', { name: 'Import selected jobs' }).click();
      assert.match(await page.locator('#af_status').innerText(), /same work order number.*twice/i);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      // The same number can exist for two different property managers.
      await page.locator('#af_client_1').selectOption('c2');
      await page.getByRole('button', { name: 'Import selected jobs' }).click(); await synced(page);
      assert.equal(await page.evaluate(() => Object.keys(S.jobs).length), 2);
      await page.locator('#dlg').getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Import work order PDFs' }).click();
      await page.locator('#af_file').setInputFiles([file('already.pdf', FIRST), file('new.pdf', SECOND)]); await loaded(page);
      await page.locator('#af_batch_client').selectOption('c1'); await page.getByRole('button', { name: 'Apply client to all' }).click();
      assert.match(await page.locator('#af_issue_0').innerText(), /already imported/);
      await page.getByRole('button', { name: 'Import selected jobs' }).click();
      assert.match(await page.locator('#af_status').innerText(), /already imported/);
      assert.equal(await page.evaluate(() => Object.keys(S.jobs).length), 2);
      await page.locator('[data-af-index="0"][type="checkbox"]').uncheck();
      await page.getByRole('button', { name: 'Import selected jobs' }).click(); await synced(page);
      assert.equal(await page.evaluate(() => Object.keys(S.jobs).length), 3);
      await page.locator('#dlg').getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Jobs', exact: true }).click();
      const managerOne = page.locator('#main .card', { hasText: 'Fictional Manager One' }).filter({ hasText: 'AppFolio #250-1' });
      await managerOne.click(); await page.locator('#j_af_number').fill('251-1');
      await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click();
      assert.match(dialogs.at(-1).text, /already has this work order number/i);
      assert.equal(await page.locator('#dlg').isVisible(), true);
      await page.locator('#j_af_number').fill('250-1');
      await page.locator('#j_work_details').fill('Updated fictional team-only information');
      await page.locator('#dlg').getByRole('button', { name: 'Save', exact: true }).click(); await synced(page);
      assert.equal(await page.evaluate(() => Object.values(S.jobs).find(j => j.client === 'c1' && j.sourceAppfolio.number === '250-1').workOrderDetails), 'Updated fictional team-only information');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('bad, image-only, oversized, and too-many-page PDFs are isolated; canceled batches write nothing', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors, dismiss } = await setup(browser, 320);
    try {
      await page.getByRole('button', { name: 'Import work order PDFs' }).click();
      await page.locator('#af_file').setInputFiles(Array.from({ length: 26 }, (_, i) => file(`order${i}.pdf`, FIRST)));
      assert.match(await page.locator('#af_status').innerText(), /no more than 25 PDFs/i);
      await page.locator('#af_file').setInputFiles([
        file('valid.pdf', FIRST), file('image-only.pdf', []),
        { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a PDF') },
        { name: 'large.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
        { name: 'many-pages.pdf', mimeType: 'application/pdf', buffer: makePdf(Array.from({ length: 26 }, () => ['Work Order # 8'])) },
        { name: 'too-much.pdf', mimeType: 'application/pdf', buffer: makePdf(Array.from({ length: 14 }, () => Array.from({ length: 45 }, () => 'a'.repeat(80)))) },
        { name: 'locked.pdf', mimeType: 'application/pdf', buffer: Buffer.from(ENCRYPTED, 'base64') },
        { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a PDF') },
      ]);
      await loaded(page); await noOverflow(page, 'errors and review');
      assert.match(await page.locator('#af_count').innerText(), /8 PDFs loaded.*1 selected.*7 could not be read/);
      const messages = await page.locator('#af_list').innerText();
      assert.match(messages, /No selectable text/); assert.match(messages, /could not be read as a PDF/i);
      assert.match(messages, /no larger than 5 MB/); assert.match(messages, /1–25 pages/); assert.match(messages, /50,000 characters/);
      assert.match(messages, /password-protected/); assert.match(messages, /Choose a PDF file/);
      // Selecting another batch appends it instead of losing the existing review.
      const injection = [...SECOND, 'Job Description: <img src=x onerror=alert(1)>'];
      await page.locator('#af_file').setInputFiles([file('extra.pdf', injection)]); await loaded(page);
      assert.match(await page.locator('#af_count').innerText(), /9 PDFs loaded.*2 selected/);
      assert.equal(await page.locator('#af_list img').count(), 0);
      assert.match(await page.locator('#af_details_8').inputValue(), /<img src=x onerror=alert\(1\)>/);
      await page.locator('#af_batch_client').selectOption('c1'); await page.getByRole('button', { name: 'Apply client to all' }).click();
      dismiss(); await page.getByRole('button', { name: 'Import selected jobs' }).click();
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      await page.locator('#dlg').getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.evaluate(() => Object.keys(S.jobs).length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});

test('closing during a slow PDF read discards its result and does not contaminate the next batch', { skip: !canRun && 'Install browser dependencies externally' }, async () => {
  const browser = await makeBrowser();
  try {
    const { context, page, errors } = await setup(browser, 390, { readerDelay: 1000 });
    try {
      await page.getByRole('button', { name: 'Import work order PDFs' }).click();
      await page.locator('#af_file').setInputFiles([file('slow.pdf', FIRST)]);
      await page.waitForFunction(() => /Loading the PDF reader/.test(document.querySelector('#af_status')?.textContent || ''));
      await page.locator('#dlg').getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Import work order PDFs' }).click();
      await page.waitForTimeout(1200);
      assert.equal(await page.locator('#af_count').innerText(), '');
      assert.equal(await page.locator('#af_list .card').count(), 0);
      assert.equal(await page.evaluate(() => __mock.writes.length), 0);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  } finally { await browser.close(); }
});
