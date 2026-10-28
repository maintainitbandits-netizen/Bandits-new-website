// Exercises the static CRM against an in-memory Supabase substitute. No real
// credentials, network requests, or customer records are used by these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../frontend/public/crm.html'), 'utf8');
const match = html.match(/<script>\s*([\s\S]*?)<\/script>/);
assert.ok(match, 'CRM has an inline application script');
const source = match[1];
const clone = value => JSON.parse(JSON.stringify(value));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

class FakeServer {
  constructor() {
    this.rows = new Map();
    this.clients = [];
    this.failWrites = false;
    this.selectDelay = 0;
    this.writeDelay = 0;
  }

  makeClient() {
    const server = this;
    const state = { listener: null, onStatus: null, active: true };
    const client = {
      state,
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithPassword: async () => ({ data: { session: { access_token: 'fake' } }, error: null }),
        signOut: async () => ({ error: null }),
      },
      from(table) {
        assert.equal(table, 'records');
        return {
          select: async () => {
            // Capture the snapshot before the delay to exercise stale responses.
            const data = Array.from(server.rows.values()).map(clone);
            if (server.selectDelay) await wait(server.selectDelay);
            return { data, error: null };
          },
          upsert: async row => {
            if (server.writeDelay) await wait(server.writeDelay);
            if (server.failWrites) return { error: { message: 'simulated connection failure' } };
            const key = `${row.coll}/${row.id}`;
            const eventType = server.rows.has(key) ? 'UPDATE' : 'INSERT';
            server.rows.set(key, clone(row));
            server.broadcast({ eventType, new: clone(row) });
            return { error: null };
          },
          delete() {
            let coll;
            return {
              eq(field, value) {
                if (field === 'coll') { coll = value; return this; }
                return (async () => {
                  if (server.writeDelay) await wait(server.writeDelay);
                  if (server.failWrites) return { error: { message: 'simulated connection failure' } };
                  const row = server.rows.get(`${coll}/${value}`);
                  server.rows.delete(`${coll}/${value}`);
                  if (row) server.broadcast({ eventType: 'DELETE', old: clone(row) });
                  return { error: null };
                })();
              },
            };
          },
        };
      },
      channel() {
        return {
          on(_event, _filter, listener) { state.listener = listener; return this; },
          subscribe(callback) { state.onStatus = callback; setTimeout(() => state.active && callback('SUBSCRIBED'), 0); return this; },
        };
      },
      reconnect() { if (state.active && state.onStatus) state.onStatus('SUBSCRIBED'); },
      dispose() { state.active = false; },
    };
    this.clients.push(client);
    return client;
  }

  broadcast(event) {
    setTimeout(() => this.clients.forEach(client => {
      if (client.state.active && client.state.listener) client.state.listener(clone(event));
    }), 0);
  }
}

function makeDevice(server, initialStorage = {}, options = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: selector === '#doc', open: false, value: '', textContent: '', innerHTML: '',
      addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; },
    });
    return elements.get(selector);
  };
  const document = {
    querySelector: element,
    activeElement: { tagName: 'BODY' },
    addEventListener() {},
  };
  const listeners = {};
  const timers = new Set();
  const client = server.makeClient();
  const context = vm.createContext({
    document, localStorage,
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    navigator: options.navigator || {}, location: { reload() {} },
    supabase: { createClient: () => client },
    fetch: options.fetch,
    alert() {}, confirm: options.confirm || (() => false),
    setTimeout(fn, ms) { const timer = setTimeout(() => { timers.delete(timer); fn(); }, ms); timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); clearTimeout(timer); },
  });
  vm.runInContext(source, context, { filename: 'crm.js' });
  return {
    context, element, client, storage,
    async login() { await vm.runInContext('login()', context); await wait(35); },
    exec(code) { return vm.runInContext(code, context); },
    emit(name) { if (listeners[name]) listeners[name](); },
    dispose() { client.dispose(); timers.forEach(clearTimeout); timers.clear(); },
  };
}

function record(name, id) {
  return { id, name, type: 'Homeowner', stage: 'Lead', props: '', notes: '' };
}

async function devices(server) {
  const first = makeDevice(server), second = makeDevice(server);
  await Promise.all([first.login(), second.login()]);
  return [first, second];
}

test('before login the CRM is gated; a client and a job propagate to another device', async () => {
  const server = new FakeServer();
  const first = makeDevice(server), second = makeDevice(server);
  try {
    await wait(5);
    assert.equal(first.element('#login').hidden, false);
    assert.equal(first.element('#main').innerHTML, '');
    await Promise.all([first.login(), second.login()]);
    first.exec(`w('clients', ${JSON.stringify(record('Mock client', 'c1'))})`);
    first.exec(`w('jobs', {id:'j1',client:'c1',date:'2026-10-28',service:'Mow',status:'Scheduled',price:0})`);
    await wait(70);
    assert.equal(second.exec("S.clients.c1.name"), 'Mock client');
    assert.equal(second.exec("S.jobs.j1.client"), 'c1');
    assert.equal(first.element('#st').textContent, 'Synced across devices');
  } finally { first.dispose(); second.dispose(); }
});

test('a failed save stays local, is not shown as synced, and retries after reconnect', async () => {
  const server = new FakeServer();
  const [first, second] = await devices(server);
  try {
    first.exec(`w('clients', ${JSON.stringify(record('Existing', 'c1'))})`);
    await wait(50);
    server.failWrites = true;
    first.exec(`w('clients', ${JSON.stringify(record('Offline edit', 'c2'))})`);
    await wait(30);
    assert.equal(first.exec('S.clients.c2.name'), 'Offline edit');
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    assert.match(first.storage.get('mib_pending_v1'), /Offline edit/);
    server.failWrites = false;
    first.client.reconnect();
    await wait(90);
    assert.equal(server.rows.get('clients/c2').data.name, 'Offline edit');
    assert.equal(second.exec('S.clients.c2.name'), 'Offline edit');
    assert.equal(first.element('#st').textContent, 'Synced across devices');
  } finally { first.dispose(); second.dispose(); }
});

test('queued changes survive a page reload and are sent after the owner signs in', async () => {
  const server = new FakeServer();
  const original = makeDevice(server);
  let reloaded;
  try {
    await original.login();
    server.failWrites = true;
    original.exec(`w('clients', ${JSON.stringify(record('Saved for retry', 'c-retry'))})`);
    await wait(35);
    const persisted = Object.fromEntries(original.storage);
    original.dispose();
    server.failWrites = false;
    reloaded = makeDevice(server, persisted);
    assert.equal(reloaded.element('#login').hidden, false);
    await reloaded.login();
    await wait(80);
    assert.equal(server.rows.get('clients/c-retry').data.name, 'Saved for retry');
    assert.equal(reloaded.exec('S.clients["c-retry"].name'), 'Saved for retry');
  } finally { original.dispose(); if (reloaded) reloaded.dispose(); }
});

test('a stale fetch does not erase an edit made while it was in flight', async () => {
  const server = new FakeServer();
  const [first, second] = await devices(server);
  try {
    server.selectDelay = 60;
    first.exec('load()');
    first.exec(`w('clients', ${JSON.stringify(record('During load', 'c-race'))})`);
    await wait(150);
    assert.equal(first.exec('S.clients["c-race"].name'), 'During load');
    assert.equal(server.rows.get('clients/c-race').data.name, 'During load');
    assert.equal(second.exec('S.clients["c-race"].name'), 'During load');
  } finally { first.dispose(); second.dispose(); }
});

test('failed deletes are retried without resurrecting the local record', async () => {
  const server = new FakeServer();
  const [first, second] = await devices(server);
  try {
    first.exec(`w('clients', ${JSON.stringify(record('Delete me', 'c-del'))})`);
    await wait(50);
    server.failWrites = true;
    first.exec("rm('clients', 'c-del')");
    await wait(25);
    assert.equal(first.exec('S.clients["c-del"]'), undefined);
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    server.failWrites = false;
    first.client.reconnect();
    await wait(100);
    assert.equal(server.rows.has('clients/c-del'), false);
    assert.equal(second.exec('S.clients["c-del"]'), undefined);
  } finally { first.dispose(); second.dispose(); }
});

test('a newer edit to the same client is not lost while an earlier save is in flight', async () => {
  const server = new FakeServer();
  const [first, second] = await devices(server);
  try {
    server.writeDelay = 45;
    first.exec(`w('clients', ${JSON.stringify(record('First version', 'c-same'))})`);
    await wait(10);
    first.exec(`w('clients', ${JSON.stringify(record('Latest version', 'c-same'))})`);
    await wait(160);
    assert.equal(server.rows.get('clients/c-same').data.name, 'Latest version');
    assert.equal(first.exec('S.clients["c-same"].name'), 'Latest version');
    assert.equal(second.exec('S.clients["c-same"].name'), 'Latest version');
    assert.equal(first.element('#st').textContent, 'Synced across devices');
  } finally { first.dispose(); second.dispose(); }
});

test('sign-out warns before deleting unsynced local changes', async () => {
  const server = new FakeServer();
  const first = makeDevice(server);
  try {
    await first.login();
    server.failWrites = true;
    first.exec(`w('clients', ${JSON.stringify(record('Keep me', 'c-pending'))})`);
    await wait(25);
    await first.exec('logout()'); // fake confirm returns false
    assert.match(first.storage.get('mib_pending_v1'), /Keep me/);
  } finally { first.dispose(); }
});

// Route tests use fictional addresses and coordinates; they make no network
// requests and do not use customer data.
function routeData() {
  return {
    clients: { c1: record('Example client', 'c1') },
    jobs: {
      far: { id: 'far', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: 'Far Example Road', service: 'Mow', price: 0, ord: 0 },
      near: { id: 'near', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: 'Near Example Road', service: 'Mow', price: 0, ord: 1 },
      mid: { id: 'mid', client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: 'Middle Example Road', service: 'Mow', price: 0, ord: 2 },
    },
    meta: { start: '30.00000,-97.00000' },
  };
}

function coordinateRoute() {
  const state = routeData();
  state.jobs.far.prop = '30.30000,-97.00000';
  state.jobs.near.prop = '30.10000,-97.00000';
  state.jobs.mid.prop = '30.20000,-97.00000';
  return state;
}

function seedRoute(device, state = routeData()) {
  device.exec(`S=${JSON.stringify(state)};rd='2026-11-04';tab='Route';render()`);
}

test('adding a scheduled stop changes its date and syncs, and a new job uses the selected day', async () => {
  const server = new FakeServer();
  const [first, second] = await devices(server);
  try {
    first.exec(`rd='2026-11-04';w('clients', ${JSON.stringify(record('Example client', 'c1'))})`);
    first.exec(`w('jobs', {id:'today',client:'c1',date:'2026-11-04',status:'Scheduled',prop:'123 Example Road',service:'Mow',price:0,ord:0})`);
    first.exec(`w('jobs', {id:'other',client:'c1',date:'2026-11-05',status:'Scheduled',prop:'456 Example Road',service:'Mow',price:0})`);
    await wait(100);
    assert.equal(first.exec("addable().some(j=>j.id==='other')"), true);
    first.exec("addStop('other')");
    await wait(100);
    assert.equal(first.exec("S.jobs.other.date"), '2026-11-04');
    assert.equal(first.exec("S.jobs.other.ord"), 1);
    assert.equal(second.exec("S.jobs.other.date"), '2026-11-04');
    assert.equal(server.rows.get('jobs/other').data.date, '2026-11-04');
    first.exec('openJob(null,{date:rd})');
    assert.match(first.element('#dlg').innerHTML, /id="j_date" type="date" value="2026-11-04"/);
  } finally { first.dispose(); second.dispose(); }
});

test('a stop that was deleted or is no longer scheduled is not modified', () => {
  const server = new FakeServer(), device = makeDevice(server);
  try {
    seedRoute(device);
    device.exec("delete S.jobs.far;addStop('far')");
    assert.match(device.element('#rmsg').textContent, /no longer scheduled/);
    device.exec("S.jobs.near.status='Done';addStop('near')");
    assert.equal(device.exec('S.jobs.near.date'), '2026-11-04');
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('coordinates and round trips generate a bounded Google Maps link with a mobile warning', () => {
  const server = new FakeServer(), device = makeDevice(server);
  try {
    const state = routeData();
    state.jobs = {};
    state.meta.round = true;
    for (let i = 0; i < 10; i++) state.jobs[`j${i}`] = {
      id: `j${i}`, client: 'c1', date: '2026-11-04', status: 'Scheduled',
      prop: `${i + 1} Example Road`, service: 'Mow', price: 0, ord: i,
    };
    seedRoute(device, state);
    const url = new URL(device.exec('mapsUrl(dayJobs())'));
    assert.equal(url.searchParams.get('origin'), '30.00000,-97.00000');
    assert.equal(url.searchParams.get('destination'), '30.00000,-97.00000');
    assert.equal(url.searchParams.get('waypoints').split('|').length, 9);
    const markup = device.exec('vRoute()');
    assert.match(markup, /First 9 mapped stops only/);
    assert.match(markup, /mobile browsers may omit some/);
    assert.match(markup, /GPS coordinates only/);
    assert.match(markup, /Move a scheduled job to this day/);
    device.exec("S.meta.start=''");
    assert.match(device.exec('vRoute()'), /Add a start location to return to it/);
  } finally { device.dispose(); }
});

test('using device location stores the selected coordinates as the start point', () => {
  const server = new FakeServer();
  const device = makeDevice(server, {}, { navigator: { geolocation: {
    getCurrentPosition(success) { success({ coords: { latitude: 30.267149, longitude: -97.743059 } }); },
  } } });
  try {
    device.exec('useLoc()');
    assert.equal(device.exec('S.meta.start'), '30.26715,-97.74306');
    const pending = JSON.parse(device.storage.get('mib_pending_v1'));
    assert.equal(Object.values(pending)[0].data.start, '30.26715,-97.74306');
  } finally { device.dispose(); }
});

test('auto-pick orders coordinates locally and preserves offline-safe pending edits', () => {
  const server = new FakeServer(); let requests = 0;
  const device = makeDevice(server, {}, { fetch: () => { requests++; throw new Error('no network allowed'); } });
  try {
    seedRoute(device, coordinateRoute());
    device.exec('opt()');
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['near', 'mid', 'far']);
    assert.equal(requests, 0);
    assert.match(device.element('#rmsg').textContent, /approximate straight-line distance/);
    const pending = JSON.parse(device.storage.get('mib_pending_v1'));
    assert.ok(Object.values(pending).every(entry => entry.coll === 'jobs'));
    assert.equal(device.exec('Object.keys(pending).length'), 3);
  } finally { device.dispose(); }
});

test('street addresses are not sent to a geocoder or partially reordered', () => {
  const server = new FakeServer(); let requests = 0;
  const device = makeDevice(server, {}, { fetch: () => { requests++; throw new Error('no network allowed'); } });
  try {
    const state = coordinateRoute();
    state.jobs.near.prop = '123 Example Street';
    seedRoute(device, state);
    device.exec('opt()');
    assert.equal(requests, 0);
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['far', 'near', 'mid']);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    assert.match(device.element('#rmsg').textContent, /GPS coordinates for every stop/);
  } finally { device.dispose(); }
});

test('a street-address start or out-of-range coordinates are not used for automatic ordering', () => {
  const server = new FakeServer(), device = makeDevice(server);
  try {
    const state = coordinateRoute();
    state.meta.start = '123 Example Street';
    seedRoute(device, state);
    device.exec('opt()');
    assert.match(device.element('#rmsg').textContent, /GPS coordinates for the start/);
    assert.equal(device.exec("coords('91,0')"), null);
    assert.equal(device.exec("coords('30,-181')"), null);
    assert.equal(device.exec('Number.isFinite(hv([90,180],[-90,0]))'), true);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('sign-out removes any address-lookup cache left by an older CRM copy', async () => {
  const server = new FakeServer();
  const device = makeDevice(server, { mibgeo: JSON.stringify({ fictional: [30, -97] }) });
  try {
    await device.exec('logout()');
    assert.equal(device.storage.has('mibgeo'), false);
  } finally { device.dispose(); }
});

// Address-import tests use fictional data and the in-memory Supabase substitute.
function importSetup(device, { mode, client = '', text = '', skip = true, date = '2026-11-04', service = 'Mow / edge / blow', type = 'Other / unknown', stage = 'Lead' }) {
  device.exec('openImport()');
  device.element('#imp_mode').value = mode;
  device.element('#imp_client').value = client;
  device.element('#imp_type').value = type;
  device.element('#imp_stage').value = stage;
  device.element('#imp_date').value = date;
  device.element('#imp_service').value = service;
  device.element('#imp_skip').checked = skip;
  device.element('#imp_text').value = text;
  device.exec('importModeChanged()');
}

function seedClient(server, data = {}) {
  const c = { ...record('Example manager', 'c-import'), props: '100 Example St, Austin, TX', notes: 'Keep this note', ...data };
  server.rows.set(`clients/${c.id}`, { coll: 'clients', id: c.id, data: clone(c) });
  return c;
}

test('address text and CSV parsing preserve commas, quotes, Unicode and quoted line breaks', () => {
  const device = makeDevice(new FakeServer());
  try {
    const text = '\uFEFF  123 Example St, Austin, TX  \r\n\r\n456 Calle Ñ, Austin, TX\n';
    device.context.exampleText = text;
    assert.deepEqual(Array.from(device.exec('importLines(exampleText)')), ['123 Example St, Austin, TX', '456 Calle Ñ, Austin, TX']);
    const csv = '\uFEFFName,Address,Other\r\n"Example","123 Example St, Austin, TX",x\r\n"Example 2","456 ""Sample"" Ave\nRound Rock, TX",y\r\n';
    device.context.exampleCsv = csv;
    assert.deepEqual(Array.from(device.exec('importCSV(exampleCsv)')), ['123 Example St, Austin, TX', '456 "Sample" Ave, Round Rock, TX']);
    device.context.oneColumn = '"A Road, Austin, TX"\n"B Road, Austin, TX"\n';
    assert.deepEqual(Array.from(device.exec('importCSV(oneColumn)')), ['A Road, Austin, TX', 'B Road, Austin, TX']);
  } finally { device.dispose(); }
});

test('ambiguous, malformed and oversized address inputs are rejected without writes', () => {
  const device = makeDevice(new FakeServer());
  try {
    for (const [input, message] of [
      ['Name,Street\nJane,123 Example St', /Address header/],
      ['Address\n123 Example St, Austin, TX', /extra columns/],
      ['Address\n"Unclosed', /unclosed quote/],
      ['Address,Property Address\nA,B', /more than one address column/],
      ['Address,City,State,ZIP\n123 Example St,Austin,TX,78701', /address parts in separate columns/],
    ]) {
      device.context.exampleCsv = input;
      assert.throws(() => device.exec('importCSV(exampleCsv)'), message);
    }
    device.context.badPaste = 'Name\tAddress\nExample\t123 Example St';
    assert.throws(() => device.exec('importLines(badPaste)'), /one complete address per line/);
    device.context.tooMany = Array.from({ length: 1001 }, (_, i) => `${i} Example Road`).join('\n');
    assert.throws(() => device.exec('importLines(tooMany)'), /up to 1000 addresses/);
    device.context.tooLong = 'x'.repeat(501);
    assert.throws(() => device.exec('importLines(tooLong)'), /too long/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('a CSV file is read locally into the review box and spreadsheets are rejected clearly', async () => {
  const device = makeDevice(new FakeServer());
  try {
    device.exec('openImport()');
    device.context.testFile = { value: 'selected', files: [{ name: 'addresses.csv', size: 100, text: async () => 'Address\n"123 Example St, Austin, TX"\n"456 Example Ave, Austin, TX"' }] };
    await device.exec('importFile(testFile)');
    assert.equal(device.element('#imp_text').value, '123 Example St, Austin, TX\n456 Example Ave, Austin, TX');
    assert.match(device.element('#imp_status').textContent, /Loaded 2 addresses/);
    device.context.testFile = { value: 'selected', files: [{ name: 'addresses.xlsx', size: 100, text: async () => 'ignored' }] };
    await device.exec('importFile(testFile)');
    assert.match(device.element('#imp_status').textContent, /Export Excel or Sheets files as CSV/);
    assert.equal(device.element('#imp_text').value, '123 Example St, Austin, TX\n456 Example Ave, Austin, TX');
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('a slow file read never overwrites a list edited while it was loading', async () => {
  const device = makeDevice(new FakeServer()); let finish;
  try {
    device.exec('openImport()');
    device.context.testFile = { value: 'selected', files: [{ name: 'list.txt', size: 20, text: () => new Promise(resolve => { finish = resolve; }) }] };
    const reading = device.exec('importFile(testFile)');
    device.element('#imp_text').value = 'User-edited Example Road';
    device.exec('importInvalidate()');
    finish('Old Example Road');
    await reading;
    assert.equal(device.element('#imp_text').value, 'User-edited Example Road');
  } finally { device.dispose(); }
});

test('import requires a loaded CRM and a review before adding anything', () => {
  const device = makeDevice(new FakeServer(), {}, { confirm: () => true });
  try {
    importSetup(device, { mode: 'clients', text: '123 Example St' });
    device.exec('reviewImport()');
    assert.match(device.element('#imp_status').textContent, /wait for your CRM to load/);
    device.exec('confirmImport()');
    assert.match(device.element('#imp_status').textContent, /Review the import/);
    assert.equal(device.exec('Object.keys(S.clients).length'), 0);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('property import previews duplicates and appends without replacing client details', async () => {
  const server = new FakeServer(); seedClient(server, { props: '100 Example St, Austin, TX\n', stage: 'Recurring' });
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    importSetup(first, { mode: 'properties', client: 'c-import', text: '100 EXAMPLE ST, AUSTIN, TX\n200 Example Ave, Austin, TX\n200 example ave, austin, tx\n300 Example Rd, Austin, TX' });
    first.exec('reviewImport()');
    assert.match(first.element('#imp_preview').innerHTML, /<b>2<\/b> properties/);
    assert.match(first.element('#imp_preview').innerHTML, /1 repeated in the list will be skipped\. 1 already/);
    assert.match(first.element('#imp_preview').innerHTML, /Repeated in this list \(skipped\)/);
    assert.match(first.element('#imp_preview').innerHTML, /Already in destination \(skipped\)/);
    assert.match(first.element('#imp_preview').innerHTML, /200 example ave, austin, tx/);
    assert.equal(first.exec('S.clients["c-import"].props'), '100 Example St, Austin, TX\n');
    first.exec('confirmImport()');
    assert.match(first.element('#imp_status').textContent, /Added 2 properties/);
    await wait(100);
    const expected = '100 Example St, Austin, TX\n200 Example Ave, Austin, TX\n300 Example Rd, Austin, TX';
    assert.equal(first.exec('S.clients["c-import"].props'), expected);
    assert.equal(second.exec('S.clients["c-import"].props'), expected);
    assert.equal(server.rows.get('clients/c-import').data.notes, 'Keep this note');
    assert.equal(server.rows.get('clients/c-import').data.stage, 'Recurring');
    assert.equal(first.exec('Object.keys(S.clients).length'), 1);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 0);
    first.exec('confirmImport()');
    assert.match(first.element('#imp_status').textContent, /Review the import/);
    assert.equal(first.exec('S.clients["c-import"].props'), expected);
  } finally { first.dispose(); second.dispose(); }
});

test('new-client import names records by address, skips existing entries and syncs to another device', async () => {
  const server = new FakeServer(); seedClient(server);
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    importSetup(first, { mode: 'clients', text: '100 Example St, Austin, TX\n200 Example St, Austin, TX\n300 Example St, Austin, TX', type: 'Other / unknown', stage: 'Lead' });
    first.exec('reviewImport()');
    assert.match(first.element('#imp_preview').innerHTML, /<b>2<\/b> clients/);
    first.exec('confirmImport()');
    await wait(100);
    const clients = clone(first.exec('Object.values(S.clients)'));
    assert.equal(clients.length, 3);
    for (const address of ['200 Example St, Austin, TX', '300 Example St, Austin, TX']) {
      const c = clients.find(item => item.name === address);
      assert.ok(c); assert.equal(c.props, address); assert.equal(c.type, 'Other / unknown'); assert.equal(c.stage, 'Lead');
    }
    assert.equal(second.exec('Object.keys(S.clients).length'), 3);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 0);
  } finally { first.dispose(); second.dispose(); }
});

test('the user can explicitly allow an existing address when making a separate client', async () => {
  const server = new FakeServer(); seedClient(server);
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    importSetup(device, { mode: 'clients', skip: false, text: '100 Example St, Austin, TX\n100 EXAMPLE ST, AUSTIN, TX' });
    device.exec('reviewImport()');
    assert.match(device.element('#imp_preview').innerHTML, /<b>1<\/b> client/);
    device.exec('confirmImport()');
    assert.equal(device.exec('Object.keys(S.clients).length'), 2);
  } finally { device.dispose(); }
});

test('job import sets the chosen date and service, skips same-service jobs and appears on the route', async () => {
  const server = new FakeServer(); seedClient(server);
  server.rows.set('jobs/existing', { coll: 'jobs', id: 'existing', data: {
    id: 'existing', client: 'c-import', date: '2026-11-04', status: 'Scheduled', service: 'Mow / edge / blow', prop: '100 Example St, Austin, TX', price: 0,
  } });
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    importSetup(first, { mode: 'jobs', client: 'c-import', text: '100 Example St, Austin, TX\n200 Example St, Austin, TX\n200 example st, austin, tx' });
    first.exec('reviewImport()');
    assert.match(first.element('#imp_preview').innerHTML, /<b>1<\/b> scheduled job/);
    first.exec('confirmImport()');
    await wait(100);
    const jobs = clone(first.exec('Object.values(S.jobs)'));
    assert.equal(jobs.length, 2);
    const added = jobs.find(j => j.id !== 'existing');
    assert.equal(added.client, 'c-import'); assert.equal(added.prop, '200 Example St, Austin, TX');
    assert.equal(added.date, '2026-11-04'); assert.equal(added.service, 'Mow / edge / blow');
    assert.equal(added.status, 'Scheduled'); assert.equal(added.repeat, 'One-time'); assert.equal(added.price, '');
    first.exec("rd='2026-11-04'");
    assert.equal(first.exec('dayJobs().length'), 2);
    assert.equal(second.exec('Object.keys(S.jobs).length'), 2);
    assert.equal(first.exec('S.clients["c-import"].props'), '100 Example St, Austin, TX');
  } finally { first.dispose(); second.dispose(); }
});

test('a changed list or realtime data requires another review before import', async () => {
  const server = new FakeServer(); seedClient(server);
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    importSetup(device, { mode: 'properties', client: 'c-import', text: '200 Example St, Austin, TX\n300 Example St, Austin, TX' });
    device.exec('reviewImport()');
    const updated = { ...seedClient(server), props: '100 Example St, Austin, TX\n200 Example St, Austin, TX' };
    device.exec(`onRt({eventType:'UPDATE',new:{coll:'clients',id:'c-import',data:${JSON.stringify(updated)}}})`);
    device.exec('confirmImport()');
    assert.match(device.element('#imp_status').textContent, /Review the import again/);
    assert.equal(device.exec('S.clients["c-import"].props'), updated.props);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.exec('reviewImport()');
    assert.match(device.element('#imp_preview').innerHTML, /<b>1<\/b> property/);
    device.element('#imp_text').value += '\n400 Example St, Austin, TX';
    device.exec('confirmImport()');
    assert.match(device.element('#imp_status').textContent, /Review the import again/);
    assert.equal(device.exec('S.clients["c-import"].props'), updated.props);
  } finally { device.dispose(); }
});

test('canceling or insufficient device storage leaves all records unchanged', async () => {
  const server = new FakeServer(); seedClient(server);
  let approve = false;
  const device = makeDevice(server, {}, { confirm: () => approve });
  try {
    await device.login();
    importSetup(device, { mode: 'clients', text: '200 Example St, Austin, TX' });
    device.exec('reviewImport()');
    device.exec('confirmImport()');
    assert.equal(device.exec('Object.keys(S.clients).length'), 1);
    approve = true;
    const originalSet = device.context.localStorage.setItem;
    device.context.localStorage.setItem = (key, value) => { if (key.startsWith('mib_import_probe_')) throw new Error('quota'); originalSet(key, value); };
    device.exec('confirmImport()');
    assert.match(device.element('#imp_status').textContent, /Not enough device storage/);
    assert.equal(device.exec('Object.keys(S.clients).length'), 1);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('import previews escape untrusted address text', async () => {
  const server = new FakeServer(), device = makeDevice(server);
  try {
    await device.login();
    importSetup(device, { mode: 'clients', text: '<img src=x onerror=alert(1)> Example Road' });
    device.exec('reviewImport()');
    assert.doesNotMatch(device.element('#imp_preview').innerHTML, /<img/);
    assert.match(device.element('#imp_preview').innerHTML, /&lt;img/);
  } finally { device.dispose(); }
});

test('batched imported clients survive a failed sync and retry after reload', async () => {
  const server = new FakeServer(), first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  let restored;
  try {
    await Promise.all([first.login(), second.login()]);
    importSetup(first, { mode: 'clients', text: '200 Example St, Austin, TX\n300 Example St, Austin, TX' });
    first.exec('reviewImport()');
    server.failWrites = true;
    first.exec('confirmImport()');
    await wait(30);
    assert.equal(first.exec('Object.keys(S.clients).length'), 2);
    assert.equal(first.exec('Object.keys(pending).length'), 2);
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    const saved = Object.fromEntries(first.storage);
    first.dispose();
    server.failWrites = false;
    restored = makeDevice(server, saved);
    await restored.login();
    await wait(110);
    assert.equal(restored.exec('Object.keys(S.clients).length'), 2);
    assert.equal(restored.exec('Object.keys(pending).length'), 0);
    assert.equal(second.exec('Object.keys(S.clients).length'), 2);
    assert.equal(server.rows.size, 2);
  } finally { first.dispose(); second.dispose(); if (restored) restored.dispose(); }
});

test('the import is revalidated after the final confirmation', async () => {
  const server = new FakeServer(); seedClient(server);
  let device;
  device = makeDevice(server, {}, { confirm: () => {
    device.exec('S.clients["c-import"].props += "\\n200 Example St, Austin, TX"');
    return true;
  } });
  try {
    await device.login();
    importSetup(device, { mode: 'properties', client: 'c-import', text: '200 Example St, Austin, TX' });
    device.exec('reviewImport()');
    device.exec('confirmImport()');
    assert.match(device.element('#imp_status').textContent, /Review the import again/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    assert.equal(device.exec('S.clients["c-import"].props'), '100 Example St, Austin, TX\n200 Example St, Austin, TX');
  } finally { device.dispose(); }
});

test('jobs require a valid client, date and service before review', async () => {
  const server = new FakeServer(); seedClient(server);
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    importSetup(device, { mode: 'jobs', client: 'missing', text: '200 Example St, Austin, TX' });
    device.exec('reviewImport()'); assert.match(device.element('#imp_status').textContent, /Choose an existing client/);
    device.element('#imp_client').value = 'c-import'; device.element('#imp_date').value = '2026-02-30';
    device.exec('reviewImport()'); assert.match(device.element('#imp_status').textContent, /valid job date/);
    device.element('#imp_date').value = '2026-11-04'; device.element('#imp_service').value = '';
    device.exec('reviewImport()'); assert.match(device.element('#imp_status').textContent, /Choose a service/);
    device.exec('confirmImport()'); assert.equal(device.exec('Object.keys(S.jobs).length'), 0);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('large imports queue once, create unique IDs and remain recoverable after a sync failure', async () => {
  const server = new FakeServer(), device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    device.exec('Math.random=()=>0.5; Date.now=()=>1000');
    const text = Array.from({ length: 1000 }, (_, i) => `${i + 1} Example St, Austin, TX`).join('\n');
    importSetup(device, { mode: 'clients', text });
    device.exec('reviewImport()');
    assert.match(device.element('#imp_preview').innerHTML, /<b>1000<\/b> clients/);
    assert.match(device.element('#imp_preview').innerHTML, /tap to show all/);
    server.failWrites = true;
    device.exec('confirmImport()');
    assert.equal(device.exec('Object.keys(S.clients).length'), 1000);
    assert.equal(device.exec('Object.keys(pending).length'), 1000);
    assert.equal(Object.keys(JSON.parse(device.storage.get('mib_pending_v1'))).length, 1000);
    assert.equal(Object.keys(JSON.parse(device.storage.get('mib')).clients).length, 1000);
    assert.match(device.element('#imp_status').textContent, /Added 1000 clients/);
  } finally { device.dispose(); }
});
