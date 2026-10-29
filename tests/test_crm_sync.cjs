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
    this.photoReady = false;
    this.photoObjects = new Map();
    this.photoUploads = 0;
    this.photoFailList = false;
    this.photoBeforeList = null;
    this.photoFailUpload = false;
    this.photoUnconfirmedAt = 0;
    this.photoBeforeUpload = null;
    this.photoAfterUpload = null;
    this.photoSilentDelete = false;
    this.photoRpcDelay = 0;
    this.photoRpcCalls = 0;
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
      async rpc(name) {
        assert.equal(name, 'mib_crm_photo_storage_private_v1');
        server.photoRpcCalls++;
        if (server.photoRpcDelay) await wait(server.photoRpcDelay);
        return { data: server.photoReady, error: null };
      },
      storage: { from(bucket) {
        assert.equal(bucket, 'mib-crm-job-photos');
        return {
          async list(folder) {
            if (server.photoBeforeList) await server.photoBeforeList(folder);
            if (server.photoFailList) return { data: null, error: { message: 'simulated list failure' } };
            const prefix = folder + '/';
            const files = [...server.photoObjects.keys()].filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
              .reverse().map(p => ({ name: p.slice(prefix.length), id: 'fake-object' }));
            return { data: files, error: null };
          },
          async upload(path, blob) {
            const attempt = ++server.photoUploads;
            if (server.photoBeforeUpload) await server.photoBeforeUpload({ path, attempt });
            if (server.photoFailUpload) return { data: null, error: { message: 'simulated upload failure' } };
            server.photoObjects.set(path, blob);
            if (server.photoAfterUpload) await server.photoAfterUpload({ path, attempt });
            if (server.photoUnconfirmedAt === attempt) return { data: null, error: { message: 'simulated lost response' } };
            return { data: { path }, error: null };
          },
          async download(path, _options, parameters) {
            assert.equal(parameters && parameters.cache, 'no-store');
            return server.photoObjects.has(path) ? { data: server.photoObjects.get(path), error: null } : { data: null, error: { message: 'not found' } };
          },
          async remove(paths) {
            if (server.photoSilentDelete) return { data: [], error: null };
            const deleted = paths.filter(p => server.photoObjects.delete(p)).map(name => ({ name }));
            return { data: deleted, error: null };
          },
        };
      } },
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
      hidden: ['#doc', '#rr_opt', '#rr_save'].includes(selector), open: false, value: '', textContent: '', innerHTML: '',
      addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; },
    });
    return elements.get(selector);
  };
  const document = {
    querySelector: element,
    querySelectorAll: () => [],
    activeElement: { tagName: 'BODY' },
    addEventListener() {},
  };
  const listeners = {};
  const timers = new Set();
  const client = server.makeClient();
  const context = vm.createContext({
    document, localStorage,
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    navigator: options.navigator || {}, location: { reload() {} }, TextEncoder,
    URL: options.URL || { createObjectURL: () => 'blob:fictional-photo', revokeObjectURL() {} },
    supabase: { createClient: () => client },
    WeeklyPlanner: require('../frontend/public/crm-week.js'),
    fetch: options.fetch,
    alert: options.alert || (() => {}), confirm: options.confirm || (() => false),
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

// Crew workflow tests use fictional route data and in-memory storage only.
function seedCrew(server) {
  const state = routeData();
  state.clients.c1.phone = '(512) 555-0100';
  state.clients.c2 = { ...record('Second example', 'c2'), phone: '+1 (512) 555-0101' };
  state.jobs.mid.client = 'c2';
  for (const [id, data] of Object.entries(state.clients)) server.rows.set(`clients/${id}`, { coll: 'clients', id, data: clone(data) });
  for (const [id, data] of Object.entries(state.jobs)) server.rows.set(`jobs/${id}`, { coll: 'jobs', id, data: clone(data) });
  return state;
}

test('GPS text and CSV accept latitude/longitude and reject ambiguous or invalid data', () => {
  const device = makeDevice(new FakeServer());
  try {
    device.context.gpsText = '30.1000, -97.2000\n30.2,-97.3';
    assert.deepEqual(Array.from(device.exec("importLines(gpsText,'gps')")), ['30.1, -97.2', '30.2, -97.3']);
    device.context.gpsCsv = 'Name,Latitude,Longitude\nA,30.1,-97.2\nB,30.2,-97.3';
    assert.deepEqual(Array.from(device.exec("importCSV(gpsCsv,'gps')")), ['30.1, -97.2', '30.2, -97.3']);
    device.context.gpsCsv = 'Coordinates\n"30.1,-97.2"\n"30.2,-97.3"';
    assert.deepEqual(Array.from(device.exec("importCSV(gpsCsv,'gps')")), ['30.1, -97.2', '30.2, -97.3']);
    device.context.gpsCsv = '30.1,-97.2\n30.2,-97.3';
    assert.deepEqual(Array.from(device.exec("importCSV(gpsCsv,'gps')")), ['30.1, -97.2', '30.2, -97.3']);
    for (const value of ['91,-97', '30,-181', '123 Example Street', '30.1,']) {
      device.context.gpsText = value;
      assert.throws(() => device.exec("importLines(gpsText,'gps')"), /valid decimal latitude/);
    }
    device.context.gpsCsv = 'Latitude,Coordinates\n30.1,"30.1,-97.2"';
    assert.throws(() => device.exec("importCSV(gpsCsv,'gps')"), /ambiguous GPS columns/);
    device.context.gpsCsv = 'Latitude,Name\n30.1,Example';
    assert.throws(() => device.exec("importCSV(gpsCsv,'gps')"), /both Latitude and Longitude/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('imported jobs keep their list order after existing stops and sync across devices', async () => {
  const server = new FakeServer(); seedClient(server);
  server.rows.set('jobs/old', { coll: 'jobs', id: 'old', data: { id: 'old', client: 'c-import', date: '2026-11-04', status: 'Scheduled', service: 'Other', prop: 'Existing Example Rd' } });
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    importSetup(first, { mode: 'jobs', client: 'c-import', text: 'Z Example Rd\nA Example Rd\nM Example Rd' });
    first.exec('reviewImport();confirmImport()');
    first.exec("rd='2026-11-04'");
    assert.deepEqual(Array.from(first.exec('dayJobs().map(j=>j.prop)')), ['Existing Example Rd', 'Z Example Rd', 'A Example Rd', 'M Example Rd']);
    await wait(130);
    second.exec("rd='2026-11-04'");
    assert.deepEqual(Array.from(second.exec('dayJobs().map(j=>j.prop)')), ['Existing Example Rd', 'Z Example Rd', 'A Example Rd', 'M Example Rd']);
    first.exec("w('jobs',{id:'moved',client:'c-import',date:'2026-11-05',status:'Scheduled',service:'Other',prop:'Moved Example Rd'});addStop('moved')");
    assert.equal(first.exec('dayJobs().at(-1).id'), 'moved');
  } finally { first.dispose(); second.dispose(); }
});

test('GPS job imports normalize locations and work with local coordinate-only auto-pick', async () => {
  const server = new FakeServer(); seedClient(server); let requests = 0;
  const device = makeDevice(server, {}, { confirm: () => true, fetch: () => { requests++; throw new Error('external network forbidden'); } });
  try {
    await device.login();
    importSetup(device, { mode: 'jobs', client: 'c-import', text: '30.3,-97\n30.1,-97\n30.2,-97' });
    device.element('#imp_format').value = 'gps';
    device.exec('reviewImport();confirmImport();rd="2026-11-04";S.meta.start="30,-97";opt()');
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.prop)')), ['30.1, -97', '30.2, -97', '30.3, -97']);
    assert.equal(requests, 0);
  } finally { device.dispose(); }
});

test('route order preview rearranges existing jobs without changing customer, date or creating records', async () => {
  const server = new FakeServer(); seedCrew(server); let requests = 0;
  const first = makeDevice(server, {}, { confirm: () => true, fetch: () => { requests++; throw new Error('external network forbidden'); } });
  const second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    first.exec("rd='2026-11-04';tab='Route';openRouteOrder()");
    first.element('#ro_format').value = 'address';
    first.element('#ro_text').value = 'Middle Example Road\nFar Example Road';
    first.exec('reviewRouteOrder()');
    assert.match(first.element('#ro_preview').innerHTML, /2<\/b> matched stops/);
    assert.match(first.element('#ro_preview').innerHTML, /1 unlisted stop stays at the end/);
    assert.deepEqual(Array.from(first.exec('dayJobs().map(j=>j.id)')), ['far', 'near', 'mid']);
    first.exec('applyRouteOrder()');
    assert.deepEqual(Array.from(first.exec('dayJobs().map(j=>j.id)')), ['mid', 'far', 'near']);
    await wait(130);
    second.exec("rd='2026-11-04'");
    assert.deepEqual(Array.from(second.exec('dayJobs().map(j=>j.id)')), ['mid', 'far', 'near']);
    assert.equal(second.exec('S.jobs.mid.client'), 'c2');
    assert.equal(second.exec('S.jobs.mid.date'), '2026-11-04');
    assert.equal(second.exec('Object.keys(S.jobs).length'), 3);
    assert.equal(requests, 0);
  } finally { first.dispose(); second.dispose(); }
});

test('unmatched or stale route lists do not change any jobs', async () => {
  const server = new FakeServer(); seedCrew(server);
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    device.exec("rd='2026-11-04';openRouteOrder()");
    device.element('#ro_text').value = 'Wrong Example Road';
    device.exec('reviewRouteOrder();applyRouteOrder()');
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.element('#ro_text').value = 'Middle Example Road\nFar Example Road';
    device.exec('reviewRouteOrder()');
    device.exec("S.jobs.mid.prop='Changed Example Road';applyRouteOrder()");
    assert.match(device.element('#ro_status').textContent, /No unmatched stop|changed|Review/);
    assert.equal(device.exec('S.jobs.far.ord'), 0);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('duplicate locations match separate stops in their current relative order', async () => {
  const server = new FakeServer(); const state = seedCrew(server);
  state.jobs.mid.prop = state.jobs.far.prop;
  server.rows.set('jobs/mid', { coll: 'jobs', id: 'mid', data: clone(state.jobs.mid) });
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    device.exec("rd='2026-11-04';openRouteOrder()");
    device.element('#ro_text').value = 'Near Example Road\nFar Example Road\nFar Example Road';
    device.exec('reviewRouteOrder();applyRouteOrder()');
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['near', 'far', 'mid']);
  } finally { device.dispose(); }
});

test('route-order CSV upload stays local and never changes CRM before review', async () => {
  const server = new FakeServer(); seedCrew(server);
  const device = makeDevice(server);
  try {
    await device.login(); device.exec("rd='2026-11-04';openRouteOrder()");
    device.context.routeFile = { value: 'chosen', files: [{ name: 'route.csv', size: 80, text: async () => 'Address\n"Middle Example Road"\n"Far Example Road"' }] };
    await device.exec('routeOrderFile(routeFile)');
    assert.equal(device.element('#ro_text').value, 'Middle Example Road\nFar Example Road');
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['far', 'near', 'mid']);
  } finally { device.dispose(); }
});

test('en-route SMS opens a draft for a valid client phone and never sends a message', () => {
  const server = new FakeServer(), android = makeDevice(server, {}, { navigator: { userAgent: 'Android' } });
  const ios = makeDevice(server, {}, { navigator: { userAgent: 'iPhone' } });
  try {
    const androidLink = android.exec('enRouteText({phone:"+1 (512) 555-0100"})');
    assert.ok(androidLink.startsWith('sms:+15125550100?body='));
    assert.match(decodeURIComponent(androidLink), /Maintain It Bandits.*on our way/);
    assert.ok(ios.exec('enRouteText({phone:"512-555-0100"})').startsWith('sms:5125550100&body='));
    assert.equal(android.exec('enRouteText({phone:"512-555-0100 ext 22"})'), '');
    assert.equal(android.exec('enRouteText({phone:"javascript:alert(1)"})'), '');
    const state = routeData(); state.clients.c1.phone = '(512) 555-0100'; seedRoute(android, state);
    const markup = android.exec('vRoute()');
    assert.match(markup, /Text en route/); assert.match(markup, /you tap Send/);
    assert.equal(android.exec('Object.keys(pending).length'), 0);
  } finally { android.dispose(); ios.dispose(); }
});

test('photos fail closed when private bucket readiness is not confirmed', async () => {
  const server = new FakeServer(); seedCrew(server);
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login(); device.exec("openJobPhotos('far')"); await wait(10);
    assert.match(device.element('#ph_status').textContent, /not ready/);
    assert.equal(device.element('#ph_before_input').disabled, true);
    device.context.photoInput = { value: 'chosen', files: [{ type: 'image/jpeg', size: 100 }] };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(server.photoUploads, 0); assert.equal(server.photoObjects.size, 0);
  } finally { device.dispose(); }
});

test('before/after photos use authenticated private storage and are visible on another device', async () => {
  const server = new FakeServer(); seedCrew(server); server.photoReady = true;
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server, {}, { confirm: () => true });
  try {
    await Promise.all([first.login(), second.login()]);
    first.exec("openJobPhotos('far')"); await wait(10);
    assert.equal(first.element('#ph_before_input').disabled, false);
    first.exec("prepareJobPhoto=async()=>({size:3,type:'image/jpeg'})");
    first.context.photoInput = { value: 'chosen', files: [{ type: 'image/jpeg', size: 100 }] };
    await first.exec("uploadJobPhoto(photoInput,'before')");
    first.context.photoInput = { value: 'chosen', files: [{ type: 'image/png', size: 100 }] };
    await first.exec("uploadJobPhoto(photoInput,'after')");
    assert.equal(server.photoObjects.size, 2);
    const paths = [...server.photoObjects.keys()];
    assert.ok(paths.some(p => p.startsWith('j-666172/before/p-') && p.endsWith('.jpg')));
    assert.ok(paths.some(p => p.startsWith('j-666172/after/p-') && p.endsWith('.jpg')));
    assert.ok(paths.every(p => !p.includes('Example')));
    assert.equal(first.exec('Object.keys(pending).length'), 0);
    second.exec("openJobPhotos('far')"); await wait(10);
    assert.match(second.element('#ph_before_list').innerHTML, /Before photo 1/);
    assert.match(second.element('#ph_after_list').innerHTML, /After photo 1/);
    second.context.photoButton = { dataset: { path: paths[0] } };
    await second.exec('viewJobPhoto(photoButton)');
    assert.match(second.element('#ph_view').innerHTML, /blob:fictional-photo/);
    assert.doesNotMatch(second.element('#ph_view').innerHTML, /\/public\//);
    await second.exec('removeJobPhoto(photoButton)');
    assert.equal(server.photoObjects.size, 1);
    assert.equal(second.element('#ph_status').textContent, 'Photo deleted.');
  } finally { first.dispose(); second.dispose(); }
});

test('failed photo uploads and silent permission-denied deletes are not reported as successful', async () => {
  const server = new FakeServer(); seedCrew(server); server.photoReady = true;
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login(); device.exec("openJobPhotos('far')"); await wait(10);
    device.exec("prepareJobPhoto=async()=>({size:3,type:'image/jpeg'})");
    device.context.photoInput = { value: 'chosen', files: [{ type: 'image/jpeg', size: 100 }] };
    server.photoFailUpload = true; await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.match(device.element('#ph_status').textContent, /upload not confirmed/);
    assert.equal(server.photoObjects.size, 0);
    server.photoFailUpload = false;
    device.context.photoInput = { value: 'chosen', files: [{ type: 'image/jpeg', size: 100 }] };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    const path = [...server.photoObjects.keys()][0];
    device.context.photoButton = { dataset: { path } }; server.photoSilentDelete = true;
    await device.exec('removeJobPhoto(photoButton)');
    assert.match(device.element('#ph_status').textContent, /deletion was not confirmed/i);
    assert.equal(server.photoObjects.size, 1);
  } finally { device.dispose(); }
});

test('unsynced jobs, unsafe image formats, and changed dialogs do not upload photos', async () => {
  const server = new FakeServer(); seedCrew(server); server.photoReady = true;
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login(); device.exec("openJobPhotos('far')"); await wait(10);
    await assert.rejects(device.exec("prepareJobPhoto({type:'image/svg+xml',size:100})"), /Choose a JPEG/);
    await assert.rejects(device.exec("prepareJobPhoto({type:'image/jpeg',size:30000000})"), /no larger than 20 MB/);
    device.exec("prepareJobPhoto=async()=>({size:3,type:'image/jpeg'});w('jobs',Object.assign({},S.jobs.far,{notes:'unsynced'}))");
    device.context.photoInput = { value: 'chosen', files: [{ type: 'image/jpeg', size: 100 }] };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(server.photoUploads, 0);
    assert.match(device.element('#ph_status').textContent, /Synced across devices/);
    server.photoRpcDelay = 30; device.exec("openJobPhotos('near');openBackup()");
    await wait(50);
    assert.match(device.element('#dlg').innerHTML, /<h2>Backup<\/h2>/);
    assert.equal(server.photoObjects.size, 0);
  } finally { device.dispose(); }
});

function fakePhotoFiles(...names) {
  return names.map(name => ({ name, type: 'image/jpeg', size: 100 }));
}

async function openFakePhotoDialog(server) {
  seedCrew(server); server.photoReady = true;
  const device = makeDevice(server, {}, { confirm: () => true });
  await device.login(); device.exec("openJobPhotos('far')"); await wait(10);
  device.exec("prepareJobPhoto=async()=>({size:3,type:'image/jpeg'})");
  return device;
}

test('one selection uploads every before or after photo and another device can see them', async () => {
  const server = new FakeServer(), first = await openFakePhotoDialog(server);
  const second = makeDevice(server);
  try {
    await second.login();
    // A browser clears its FileList when input.value is reset. The snapshot must survive it.
    first.context.photoInput = { files: fakePhotoFiles('one.jpg', 'two.jpg', 'three.jpg'), set value(v) { if (!v) this.files = []; } };
    await first.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(first.context.photoInput.files.length, 0);
    assert.equal(server.photoUploads, 3);
    assert.equal(server.photoObjects.size, 3);
    assert.equal(first.element('#ph_status').textContent, '3 of 3 before photos uploaded.');
    assert.equal((first.element('#ph_before_list').innerHTML.match(/Before photo/g) || []).length, 3);
    first.context.photoInput = { value: 'chosen', files: fakePhotoFiles('four.jpg', 'five.jpg') };
    await first.exec("uploadJobPhoto(photoInput,'after')");
    assert.equal(server.photoUploads, 5);
    assert.equal(first.element('#ph_status').textContent, '2 of 2 after photos uploaded.');
    const paths = [...server.photoObjects.keys()];
    assert.equal(paths.filter(p => p.startsWith('j-666172/before/')).length, 3);
    assert.equal(paths.filter(p => p.startsWith('j-666172/after/')).length, 2);
    assert.ok(paths.every(p => !/one|two|three|four|five/.test(p)));
    assert.ok(server.photoRpcCalls >= 8, 'private readiness was checked for every upload as well as the photo lists');
    assert.equal(first.exec('Object.keys(pending).length'), 0);
    second.exec("openJobPhotos('far')"); await wait(10);
    assert.equal((second.element('#ph_before_list').innerHTML.match(/Before photo/g) || []).length, 3);
    assert.equal((second.element('#ph_after_list').innerHTML.match(/After photo/g) || []).length, 2);
  } finally { first.dispose(); second.dispose(); }
});

test('a bad image is reported as not sent and does not block valid photos', async () => {
  const server = new FakeServer(), device = await openFakePhotoDialog(server);
  try {
    device.exec(`prepareJobPhoto=async f=>{if(f.name.includes('bad'))throw new Error('Unsupported <image>');return {size:3,type:'image/jpeg'}}`);
    device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'bad<img>.jpg', 'last.jpg') };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(server.photoUploads, 2); assert.equal(server.photoObjects.size, 2);
    assert.match(device.element('#ph_status').textContent, /2 of 3 before photos uploaded\. 1 not sent/);
    assert.match(device.element('#ph_errors').innerHTML, /bad&lt;img&gt;\.jpg — Not sent: Unsupported &lt;image&gt;/);
    assert.doesNotMatch(device.element('#ph_errors').innerHTML, /<img>/);
  } finally { device.dispose(); }
});

test('an unconfirmed upload stops the batch without retrying or claiming it failed to save', async () => {
  const server = new FakeServer(), device = await openFakePhotoDialog(server);
  try {
    // Simulate the server saving a photo but the response being lost.
    server.photoUnconfirmedAt = 2;
    device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'uncertain.jpg', 'unsent.jpg') };
    await device.exec("uploadJobPhoto(photoInput,'after')");
    assert.equal(server.photoUploads, 2);
    assert.equal(server.photoObjects.size, 2);
    assert.match(device.element('#ph_status').textContent, /1 of 3 after photos uploaded\. 1 upload not confirmed\. 1 not sent/);
    assert.match(device.element('#ph_errors').innerHTML, /uncertain\.jpg — Upload not confirmed/);
    assert.match(device.element('#ph_errors').innerHTML, /may have been saved/);
    assert.match(device.element('#ph_errors').innerHTML, /unsent\.jpg — Not sent/);
    assert.match(device.element('#ph_after_list').innerHTML, /After photo 2/);
    device.exec('refreshJobPhotos()'); await wait(10);
    assert.match(device.element('#ph_errors').innerHTML, /may have been saved/, 'the warning remains visible after refresh');
    assert.equal(server.photoUploads, 2, 'refresh must not retry or duplicate the uncertain upload');
  } finally { device.dispose(); }
});

test('partial results remain visible while a slow photo-list refresh is pending', async () => {
  const server = new FakeServer(), device = await openFakePhotoDialog(server);
  try {
    let releaseList, notifyListStarted;
    const started = new Promise(resolve => { notifyListStarted = resolve; });
    const gate = new Promise(resolve => { releaseList = resolve; });
    server.photoUnconfirmedAt = 2;
    server.photoBeforeList = async () => { notifyListStarted(); await gate; };
    device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'uncertain.jpg', 'unsent.jpg') };
    const batch = device.exec("uploadJobPhoto(photoInput,'after')"); await started;
    assert.match(device.element('#ph_status').textContent, /1 of 3 after photos uploaded\. 1 upload not confirmed\. 1 not sent/);
    assert.match(device.element('#ph_status').textContent, /Refreshing the photo list/);
    assert.match(device.element('#ph_errors').innerHTML, /uncertain\.jpg — Upload not confirmed/);
    assert.match(device.element('#ph_errors').innerHTML, /unsent\.jpg — Not sent/);
    assert.equal(device.element('#ph_after_input').disabled, true);
    releaseList(); await batch;
    assert.doesNotMatch(device.element('#ph_status').textContent, /Refreshing/);
  } finally { device.dispose(); }
});

test('a batch over the limit sends nothing, while the 100-photo limit is accepted', async () => {
  const server = new FakeServer(), device = await openFakePhotoDialog(server);
  try {
    const files = Array.from({ length: 101 }, (_, i) => ({ name: `photo-${i}.jpg`, type: 'image/jpeg', size: 100 }));
    device.context.photoInput = { value: 'chosen', files };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(server.photoUploads, 0);
    assert.match(device.element('#ph_status').textContent, /up to 100 photos.*None were uploaded/);
    device.context.photoInput = { value: 'chosen', files: files.slice(0, 100) };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(server.photoUploads, 100); assert.equal(server.photoObjects.size, 100);
    assert.match(device.element('#ph_status').textContent, /100 of 100 before photos uploaded/);
  } finally { device.dispose(); }
});

test('a private-storage readiness change halts the rest of a batch', async () => {
  const server = new FakeServer(), device = await openFakePhotoDialog(server);
  try {
    server.photoAfterUpload = ({ attempt }) => { if (attempt === 1) server.photoReady = false; };
    device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'second.jpg', 'third.jpg') };
    await device.exec("uploadJobPhoto(photoInput,'before')");
    assert.equal(server.photoUploads, 1); assert.equal(server.photoObjects.size, 1);
    assert.match(device.element('#ph_status').textContent, /1 of 3 before photos uploaded\. 2 not sent/);
    assert.match(device.element('#ph_errors').innerHTML, /Private photo storage is not ready/);
    assert.equal(device.element('#ph_before_input').disabled, true);
  } finally { device.dispose(); }
});

test('a sync interruption or deleted job stops subsequent photos', async () => {
  for (const change of ['sync', 'delete']) {
    const server = new FakeServer(), device = await openFakePhotoDialog(server);
    try {
      server.photoAfterUpload = ({ attempt }) => { if (attempt === 1) device.exec(change === 'sync' ? 'synced=false' : 'delete S.jobs.far'); };
      device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'second.jpg', 'third.jpg') };
      await device.exec("uploadJobPhoto(photoInput,'before')");
      assert.equal(server.photoUploads, 1, change);
      assert.match(device.element('#ph_status').textContent, /1 of 3 before photos uploaded\. 2 not sent/);
      if (change === 'delete') assert.match(device.element('#ph_status').textContent, /job was deleted while uploading/);
      assert.equal(device.element('#ph_before_input').disabled, true, change);
    } finally { device.dispose(); }
  }
});

test('closing during preparation sends nothing; changing jobs during an upload sends no further photos', async () => {
  const server = new FakeServer(), device = await openFakePhotoDialog(server);
  try {
    let resolvePreparation;
    device.context.preparation = new Promise(resolve => { resolvePreparation = resolve; });
    device.exec('prepareJobPhoto=()=>preparation');
    device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'second.jpg') };
    let batch = device.exec("uploadJobPhoto(photoInput,'before')");
    assert.match(device.element('#ph_status').textContent, /photo 1 of 2/);
    assert.equal(device.element('#ph_before_input').disabled, true);
    assert.equal(device.element('#ph_after_input').disabled, true);
    assert.equal(device.element('#ph_refresh').disabled, true);
    device.exec('closeD()'); resolvePreparation({ size: 3, type: 'image/jpeg' }); await batch;
    assert.equal(server.photoUploads, 0);

    device.exec("openJobPhotos('far');prepareJobPhoto=async()=>({size:3,type:'image/jpeg'})"); await wait(10);
    let releaseUpload, notifyStarted;
    const started = new Promise(resolve => { notifyStarted = resolve; });
    const gate = new Promise(resolve => { releaseUpload = resolve; });
    server.photoBeforeUpload = async () => { notifyStarted(); await gate; };
    device.context.photoInput = { value: 'chosen', files: fakePhotoFiles('first.jpg', 'second.jpg', 'third.jpg') };
    batch = device.exec("uploadJobPhoto(photoInput,'before')"); await started;
    device.exec("openJobPhotos('near')"); await wait(10);
    const newDialogStatus = device.element('#ph_status').textContent;
    releaseUpload(); await batch;
    assert.equal(server.photoUploads, 1);
    assert.equal(server.photoObjects.size, 1, 'the in-flight upload may finish for the original job');
    assert.ok([...server.photoObjects.keys()][0].startsWith('j-666172/before/'));
    assert.equal(device.element('#ph_status').textContent, newDialogStatus, 'the old batch must not update the new dialog');
    assert.equal(device.exec('photoJobId'), 'near');
  } finally { device.dispose(); }
});

test('GPS import skips an existing coordinate even when its decimal formatting differs', async () => {
  const server = new FakeServer(); seedClient(server, { props: '30.10000,-97.20000' });
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    importSetup(device, { mode: 'properties', client: 'c-import', text: '30.1, -97.2\n30.30, -97.40' });
    device.element('#imp_format').value = 'gps';
    device.exec('reviewImport()');
    assert.match(device.element('#imp_preview').innerHTML, /<b>1<\/b> property/);
    assert.match(device.element('#imp_preview').innerHTML, /1 already in the destination will be skipped/);
    device.exec('confirmImport()');
    assert.equal(device.exec('S.clients["c-import"].props'), '30.10000,-97.20000\n30.3, -97.4');
  } finally { device.dispose(); }
});

test('new manually entered jobs are appended after a previously ordered route', async () => {
  const server = new FakeServer(); seedCrew(server);
  const device = makeDevice(server);
  try {
    await device.login(); device.exec("rd='2026-11-04';openJob(null,{date:rd})");
    for (const [selector, value] of Object.entries({
      '#j_client': 'c1', '#j_service': 'Mow / edge / blow', '#j_prop': 'New Example Road',
      '#j_date': '2026-11-04', '#j_status': 'Scheduled', '#j_rep': 'One-time',
      '#j_items': '', '#j_price': '0', '#j_notes': '',
    })) device.element(selector).value = value;
    device.exec('saveJob("")');
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.prop)')), ['Far Example Road', 'Near Example Road', 'Middle Example Road', 'New Example Road']);
  } finally { device.dispose(); }
});

// Road-routing UI tests use only fictional locations and a fake same-origin API.
const fakeSession = () => ({ data: { session: { access_token: 'fictional.jwt.token' } }, error: null });
const fakeRoadResponse = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const fakeMatches = addresses => addresses.map((address, i) => ({
  formatted: address + ', Austin, TX 78701', location: [30.1 + i * 0.1, -97], accuracy: 1, accuracyType: 'rooftop', ambiguous: false,
}));

test('driving route requires consent, match review and save, then syncs only job order', async () => {
  const server = new FakeServer(); seedCrew(server); const requests = [];
  const first = makeDevice(server, {}, { confirm: () => true, fetch: async (url, options) => {
    assert.equal(url, '/api/crm-route'); assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, 'Bearer fictional.jwt.token');
    const body = JSON.parse(options.body); requests.push(body);
    if (body.action === 'geocode') return fakeRoadResponse({ matches: fakeMatches(body.addresses) });
    assert.equal(body.action, 'optimize'); return fakeRoadResponse({ order: [1, 2, 0] });
  } });
  const second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.client.auth.getSession = async () => fakeSession();
    first.exec("rd='2026-11-04';tab='Route';S.meta.start='30,-97';openRoadRoute()");
    assert.equal(requests.length, 0);
    assert.match(first.element('#dlg').innerHTML, /Nothing has been sent yet/);
    assert.match(first.element('#dlg').innerHTML, /customer names, phone numbers and notes are not sent/);
    await first.exec('roadBegin()');
    assert.equal(requests.length, 1); assert.deepEqual(Object.keys(requests[0]).sort(), ['action', 'addresses']);
    assert.deepEqual(requests[0].addresses, ['Far Example Road', 'Near Example Road', 'Middle Example Road']);
    assert.doesNotMatch(JSON.stringify(requests[0]), /Example client|555-0100|fictional\.jwt/);
    assert.match(first.element('#rr_preview').innerHTML, /Review address matches/);
    assert.equal(first.element('#rr_opt').hidden, false);
    assert.deepEqual(Array.from(first.exec('dayJobs().map(j=>j.id)')), ['far', 'near', 'mid']);
    await first.exec('roadOptimize()');
    assert.equal(requests.length, 2); assert.deepEqual(Object.keys(requests[1]).sort(), ['action', 'fixedFirst', 'returnToStart', 'start', 'stops']);
    assert.doesNotMatch(JSON.stringify(requests[1]), /Example|Road|555/);
    assert.match(first.element('#rr_preview').innerHTML, /Proposed driving order/);
    assert.match(first.element('#rr_status').textContent, /not saved yet/);
    assert.deepEqual(Array.from(first.exec('dayJobs().map(j=>j.id)')), ['far', 'near', 'mid']);
    first.exec('roadSave()');
    assert.deepEqual(Array.from(first.exec('dayJobs().map(j=>j.id)')), ['near', 'mid', 'far']);
    assert.match(first.element('#rr_status').textContent, /Route order saved/);
    await wait(150); second.exec("rd='2026-11-04'");
    assert.deepEqual(Array.from(second.exec('dayJobs().map(j=>j.id)')), ['near', 'mid', 'far']);
    assert.equal(second.exec('S.jobs.mid.client'), 'c2');
    assert.equal(second.exec('S.jobs.mid.date'), '2026-11-04');
    assert.equal(second.exec('Object.keys(S.jobs).length'), 3);
  } finally { first.dispose(); second.dispose(); }
});

test('duplicate addresses share a lookup but remain separate jobs in the optimized route', async () => {
  const server = new FakeServer(), state = seedCrew(server), requests = [];
  state.jobs.mid.prop = state.jobs.far.prop;
  server.rows.set('jobs/mid', { coll: 'jobs', id: 'mid', data: clone(state.jobs.mid) });
  const device = makeDevice(server, {}, { confirm: () => true, fetch: async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return body.action === 'geocode' ? fakeRoadResponse({ matches: fakeMatches(body.addresses) }) : fakeRoadResponse({ order: [2, 0, 1] });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openRoadRoute()");
    await device.exec('roadBegin()'); assert.equal(requests[0].addresses.length, 2);
    assert.match(device.element('#rr_preview').innerHTML, /Second example/);
    await device.exec('roadOptimize()'); assert.equal(requests[1].stops.length, 3);
    device.exec('roadSave()');
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['mid', 'far', 'near']);
  } finally { device.dispose(); }
});

test('GPS-only routes skip geocoding, and without a start keep the first stop fixed', async () => {
  const server = new FakeServer(); const state = seedCrew(server), requests = [];
  state.jobs.far.prop = '30.3,-97'; state.jobs.near.prop = '30.1,-97'; state.jobs.mid.prop = '30.2,-97';
  for (const [id, data] of Object.entries(state.jobs)) server.rows.set(`jobs/${id}`, { coll: 'jobs', id, data: clone(data) });
  const device = makeDevice(server, {}, { confirm: () => true, fetch: async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body); return fakeRoadResponse({ order: [0, 2, 1] });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';openRoadRoute()");
    assert.match(device.element('#dlg').innerHTML, /current first stop stays first/);
    await device.exec('roadBegin()');
    assert.equal(requests.length, 1); assert.equal(requests[0].action, 'optimize');
    assert.deepEqual(requests[0].start, [30.3, -97]); assert.equal(requests[0].fixedFirst, true);
    device.exec('roadSave()'); assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['far', 'mid', 'near']);
  } finally { device.dispose(); }
});

test('unmatched or uncertain address results require attention and do not silently route', async () => {
  const server = new FakeServer(); seedCrew(server); let requests = 0;
  const device = makeDevice(server, {}, { fetch: async (_url, options) => {
    requests++; const addresses = JSON.parse(options.body).addresses, matches = fakeMatches(addresses);
    matches[0].formatted = '<img src=x onerror=alert(1)>'; matches[0].ambiguous = true; matches[1] = { location: null };
    return fakeRoadResponse({ matches });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openRoadRoute()");
    await device.exec('roadBegin()');
    assert.equal(requests, 1); assert.equal(device.element('#rr_opt').hidden, true);
    assert.match(device.element('#rr_preview').innerHTML, /uncertain match/);
    assert.match(device.element('#rr_preview').innerHTML, /&lt;img/);
    assert.doesNotMatch(device.element('#rr_preview').innerHTML, /<img/);
    assert.match(device.element('#rr_status').textContent, /not found/);
    await device.exec('roadOptimize()'); device.exec('roadSave()');
    assert.equal(requests, 1); assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('a route changed during a lookup is not previewed or saved', async () => {
  const server = new FakeServer(); seedCrew(server); let resolveFetch;
  const device = makeDevice(server, {}, { fetch: async (_url, options) => {
    const body = JSON.parse(options.body);
    return new Promise(resolve => { resolveFetch = () => resolve(fakeRoadResponse({ matches: fakeMatches(body.addresses) })); });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openRoadRoute()");
    const ongoing = device.exec('roadBegin()'); await wait(0);
    device.exec("S.jobs.far.prop='Changed Example Road'"); resolveFetch(); await ongoing;
    assert.match(device.element('#rr_status').textContent, /route changed/i);
    assert.equal(device.exec('roadPlan.order'), null);
    assert.equal(device.exec('S.jobs.far.ord'), 0); assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('a route changed after optimization or during confirmation cannot be saved', async () => {
  const server = new FakeServer(); seedCrew(server);
  const device = makeDevice(server, {}, { confirm: () => { device.exec("S.jobs.far.prop='Changed during confirmation'"); return true; },
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      return body.action === 'geocode' ? fakeRoadResponse({ matches: fakeMatches(body.addresses) }) : fakeRoadResponse({ order: [1, 2, 0] });
    } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openRoadRoute()");
    await device.exec('roadBegin()'); await device.exec('roadOptimize()'); device.exec('roadSave()');
    assert.match(device.element('#rr_status').textContent, /route changed/i);
    assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.ord)')), [0, 1, 2]);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('quota errors and incomplete routes do not reorder any jobs', async () => {
  for (const failingAction of ['geocode', 'optimize']) {
    const server = new FakeServer(); seedCrew(server);
    const device = makeDevice(server, {}, { fetch: async (_url, options) => {
      const body = JSON.parse(options.body);
      if (body.action === failingAction) return failingAction === 'geocode' ? fakeRoadResponse({ error: 'Geocodio daily limit reached.' }, 429) : fakeRoadResponse({ order: [1, 1, 0] });
      return fakeRoadResponse({ matches: fakeMatches(body.addresses) });
    } });
    try {
      await device.login(); device.client.auth.getSession = async () => fakeSession();
      device.exec("rd='2026-11-04';S.meta.start='30,-97';openRoadRoute()");
      await device.exec('roadBegin()'); if (failingAction === 'optimize') await device.exec('roadOptimize()');
      assert.match(device.element('#rr_status').textContent, /limit|incomplete/i);
      device.exec('roadSave()');
      assert.deepEqual(Array.from(device.exec('dayJobs().map(j=>j.id)')), ['far', 'near', 'mid']);
      assert.equal(device.exec('Object.keys(pending).length'), 0);
    } finally { device.dispose(); }
  }
});

test('driving routes reject unsynced, missing, invalid or too many locations before opening', async () => {
  const device = makeDevice(new FakeServer());
  try {
    seedRoute(device); device.exec('openRoadRoute()');
    assert.match(device.element('#rmsg').textContent, /Synced across devices/);
    device.exec('db=sb;hasSnapshot=true;synced=true');
    device.exec("S.jobs.near.prop='91,-97';openRoadRoute()");
    assert.match(device.element('#rmsg').textContent, /invalid|out of range/);
    device.exec("S.jobs.near.prop='';S.clients.c1.props='';openRoadRoute()");
    assert.match(device.element('#rmsg').textContent, /location to every stop/);
    device.exec("S.jobs.near.prop='Near Example Road';S.meta.start='';S.meta.round=true;openRoadRoute()");
    assert.match(device.element('#rmsg').textContent, /Add a start location/);
    device.exec("S.meta.round=false;for(let i=0;i<101;i++)S.jobs['x'+i]={id:'x'+i,client:'c1',date:rd,status:'Scheduled',prop:'30,-97'};openRoadRoute()");
    assert.match(device.element('#rmsg').textContent, /100 stops/);
  } finally { device.dispose(); }
});

test('a high-scoring city or street-centroid match is blocked as too imprecise', async () => {
  const server = new FakeServer(); seedCrew(server); let requests = 0;
  const device = makeDevice(server, {}, { fetch: async (_url, options) => {
    requests++; const matches = fakeMatches(JSON.parse(options.body).addresses);
    matches[0].accuracy = 1; matches[0].accuracyType = 'place';
    return fakeRoadResponse({ matches });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openRoadRoute()");
    await device.exec('roadBegin()');
    assert.equal(device.element('#rr_opt').hidden, true);
    assert.match(device.element('#rr_preview').innerHTML, /Too imprecise/);
    assert.match(device.element('#rr_status').textContent, /too imprecise/);
    await device.exec('roadOptimize()');
    assert.equal(requests, 1); assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('driving routes reject duplicate or mismatched CRM job identifiers', () => {
  const device = makeDevice(new FakeServer());
  try {
    seedRoute(device); device.exec('db=sb;hasSnapshot=true;synced=true');
    device.exec("S.jobs.near.id='far';openRoadRoute()");
    assert.match(device.element('#rmsg').textContent, /invalid or duplicate IDs/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

// Weekly planning exercises the real CRM state/outbox with fictional services.
const weekEngine = require('../frontend/public/crm-week.js');
function futureMonday() {
  const d = new Date(); const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return weekEngine.defaultMonday(weekEngine.addDays(local, 7));
}
function weeklySeed(server, monday) {
  const client = record('Fictional weekly client', 'c-week');
  const old = { id: 'old-week', client: client.id, date: monday, status: 'Scheduled', service: 'Mow / edge / blow', prop: '9 Existing Example St, Austin, TX 78701', ord: 2 };
  server.rows.set('clients/c-week', { coll: 'clients', id: client.id, data: client });
  server.rows.set('jobs/old-week', { coll: 'jobs', id: old.id, data: old });
}
function weeklySetup(device, monday, text) {
  device.exec(`openWeekPlanner();weekPlan.setup.monday=${JSON.stringify(monday)};weekPlan.setup.flags=[true,true,true,true,true,false,false];weekPlan.setup.clientId='c-week';weekPlan.setup.text=${JSON.stringify(text)};weekReviewJobs();weekReviewSharing()`);
}
function weeklyFakeProvider(requests) {
  return async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer fictional.jwt.token');
    const body = JSON.parse(options.body); requests.push(body);
    if (body.action === 'geocode') return fakeRoadResponse({ matches: fakeMatches(body.addresses) });
    const order = Array.from({ length: body.stops.length }, (_, i) => i);
    if (body.fixedFirst) order.splice(1, order.length - 1, ...order.slice(1).reverse()); else order.reverse();
    return fakeRoadResponse({ order });
  };
}

test('weekly new jobs and constraints sync to a second device without changing existing jobs', async () => {
  const server = new FakeServer(), monday = futureMonday(), tuesday = weekEngine.addDays(monday, 1), thursday = weekEngine.addDays(monday, 3), requests = [];
  weeklySeed(server, monday); const originalJob = clone(server.rows.get('jobs/old-week').data);
  const first = makeDevice(server, {}, { confirm: () => true, fetch: weeklyFakeProvider(requests) }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.client.auth.getSession = async () => fakeSession();
    const text = [
      `100 Example St, Austin, TX 78701 | exact ${tuesday}`,
      `200 Example St, Austin, TX 78701 | due ${thursday}`,
      '300 Example St, Austin, TX 78701',
      '300 Example St, Austin, TX 78701',
      '400 Example St, Austin, TX 78701',
      '500 Example St, Austin, TX 78701',
    ].join('\n');
    weeklySetup(first, monday, text);
    assert.equal(first.exec('weekPlan.stage'), 'share'); assert.equal(requests.length, 0);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 1);
    await first.exec('weekBegin()'); assert.equal(first.exec('weekPlan.stage'), 'matches');
    assert.equal(requests[0].addresses.length, 5);
    await first.exec('weekSuggest()'); assert.equal(first.exec('weekPlan.stage'), 'preview');
    assert.equal(first.exec('Object.keys(S.jobs).length'), 1);
    first.exec('weekSave()'); assert.equal(first.exec('weekPlan.stage'), 'saved');
    assert.match(first.element('#wk_status').textContent, /Added 6 jobs/);
    await wait(240);
    const jobs = clone(second.exec('Object.values(S.jobs)'));
    assert.equal(jobs.length, 7);
    assert.deepEqual(jobs.find(j => j.id === 'old-week'), originalJob);
    const fixed = jobs.find(j => j.prop.startsWith('100 Example'));
    assert.equal(fixed.date, tuesday); assert.equal(fixed.dateRequirement, 'exact'); assert.equal(fixed.requiredDate, tuesday);
    const due = jobs.find(j => j.prop.startsWith('200 Example'));
    assert.ok(due.date <= thursday && due.date >= monday); assert.equal(due.dateRequirement, 'deadline');
    assert.equal(jobs.filter(j => j.prop.startsWith('300 Example')).length, 2);
    assert.equal(second.exec('synced'), true);
    assert.ok(requests.filter(x => x.action === 'optimize').every(x => !JSON.stringify(x).includes('Example')));
  } finally { first.dispose(); second.dispose(); }
});

test('a CRM change while a weekly lookup is running prevents both preview and saving', async () => {
  const server = new FakeServer(), monday = futureMonday(); weeklySeed(server, monday); let resolveFetch;
  const device = makeDevice(server, {}, { confirm: () => true, fetch: async (_url, options) => {
    const addresses = JSON.parse(options.body).addresses;
    return new Promise(resolve => { resolveFetch = () => resolve(fakeRoadResponse({ matches: fakeMatches(addresses) })); });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    weeklySetup(device, monday, '100 Example St, Austin, TX 78701\n200 Example St, Austin, TX 78701');
    const pendingRequest = device.exec('weekBegin()'); await wait(0);
    device.exec("S.jobs['old-week'].prop='Changed Example St'"); resolveFetch(); await pendingRequest;
    assert.match(device.element('#wk_status').textContent, /CRM changed/i);
    assert.equal(device.exec('weekPlan.stage'), 'share');
    assert.equal(device.exec('Object.keys(S.jobs).length'), 1);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('changed CRM data after final confirmation, insufficient storage, and bad daily orders fail safely', async () => {
  for (const mode of ['confirm-change', 'storage', 'bad-order']) {
    const server = new FakeServer(), monday = futureMonday(), requests = []; weeklySeed(server, monday);
    let device;
    device = makeDevice(server, {}, { confirm: () => { if (mode === 'confirm-change') device.exec("S.jobs['old-week'].prop='Changed during confirmation'"); return true; },
      fetch: async (url, options) => {
        const body = JSON.parse(options.body);
        if (mode === 'bad-order' && body.action === 'optimize') { requests.push(body); return fakeRoadResponse({ order: body.stops.map(() => 0) }); }
        return weeklyFakeProvider(requests)(url, options);
      } });
    try {
      await device.login(); device.client.auth.getSession = async () => fakeSession();
      // All three exact-day jobs force a multi-stop optimize request.
      const text = [1, 2, 3].map(i => `${i} Example St, Austin, TX 78701 | exact ${monday}`).join('\n');
      weeklySetup(device, monday, text); await device.exec('weekBegin()'); await device.exec('weekSuggest()');
      if (mode === 'bad-order') assert.match(device.element('#wk_status').textContent, /incomplete/i);
      else {
        assert.equal(device.exec('weekPlan.stage'), 'preview');
        if (mode === 'storage') device.exec("const origSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k.startsWith('mib_week_probe_'))throw new Error('full');return origSet(k,v)}");
        device.exec('weekSave()');
        assert.match(device.element('#wk_status').textContent, mode === 'storage' ? /storage/i : /CRM changed/i);
      }
      assert.equal(device.exec('Object.keys(S.jobs).length'), 1);
      assert.equal(device.exec('Object.keys(pending).length'), 0);
    } finally { device.dispose(); }
  }
});

test('date requirements prevent a job from being moved beyond its deadline or off its exact day', async () => {
  const server = new FakeServer(), monday = futureMonday(), tuesday = weekEngine.addDays(monday, 1); weeklySeed(server, monday);
  const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    device.exec(`S.jobs.fixed={id:'fixed',client:'c-week',date:${JSON.stringify(monday)},status:'Scheduled',service:'Other',prop:'30,-97',dateRequirement:'exact',requiredDate:${JSON.stringify(monday)}};rd=${JSON.stringify(tuesday)};addStop('fixed')`);
    assert.equal(device.exec('S.jobs.fixed.date'), monday); assert.match(device.element('#rmsg').textContent, /must be done on/i);
    device.exec(`S.jobs.due={id:'due',client:'c-week',date:${JSON.stringify(monday)},status:'Scheduled',service:'Other',prop:'30,-97',dateRequirement:'deadline',requiredDate:${JSON.stringify(monday)}};addStop('due')`);
    assert.equal(device.exec('S.jobs.due.date'), monday); assert.match(device.element('#rmsg').textContent, /due by/i);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('weekly address lookup batches more than 101 distinct locations without saving or routing', async () => {
  const server = new FakeServer(), monday = futureMonday(), requests = []; weeklySeed(server, monday);
  const device = makeDevice(server, {}, { confirm: () => true, fetch: weeklyFakeProvider(requests) });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    const text = Array.from({ length: 155 }, (_, i) => `${1000 + i} Example St, Austin, TX 78701`).join('\n');
    weeklySetup(device, monday, text);
    assert.equal(device.exec('weekPlan.stage'), 'share'); assert.equal(requests.length, 0);
    await device.exec('weekBegin()');
    assert.equal(device.exec('weekPlan.stage'), 'matches');
    assert.deepEqual(requests.map(x => [x.action, x.addresses.length]), [['geocode', 101], ['geocode', 54]]);
    assert.equal(device.exec('weekPlan.jobPoints.length'), 155);
    assert.equal(device.exec('Object.keys(S.jobs).length'), 1);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('weekly save cancellation and a failure on the second daily route add no jobs', async () => {
  for (const mode of ['cancel', 'second-route']) {
    const server = new FakeServer(), monday = futureMonday(), tuesday = weekEngine.addDays(monday, 1), requests = []; weeklySeed(server, monday);
    const device = makeDevice(server, {}, { confirm: () => mode !== 'cancel', fetch: async (url, options) => {
      const body = JSON.parse(options.body), routeCount = requests.filter(r => r.action === 'optimize').length;
      if (mode === 'second-route' && body.action === 'optimize' && routeCount === 1) {
        requests.push(body); return fakeRoadResponse({ error: 'Simple Routing daily limit reached.' }, 429);
      }
      return weeklyFakeProvider(requests)(url, options);
    } });
    try {
      await device.login(); device.client.auth.getSession = async () => fakeSession();
      const text = [
        `1 Example St, Austin, TX 78701 | exact ${monday}`,
        `2 Example St, Austin, TX 78701 | exact ${monday}`,
        `3 Example St, Austin, TX 78701 | exact ${tuesday}`,
        `4 Example St, Austin, TX 78701 | exact ${tuesday}`,
      ].join('\n');
      weeklySetup(device, monday, text); await device.exec('weekBegin()'); await device.exec('weekSuggest()');
      if (mode === 'cancel') { assert.equal(device.exec('weekPlan.stage'), 'preview'); device.exec('weekSave()'); }
      else { assert.equal(requests.filter(r => r.action === 'optimize').length, 2); assert.match(device.element('#wk_status').textContent, /limit/i); }
      assert.equal(device.exec('Object.keys(S.jobs).length'), 1);
      assert.equal(device.exec('Object.keys(pending).length'), 0);
    } finally { device.dispose(); }
  }
});

test('job editor preserves hard date rules unless the user explicitly changes them', async () => {
  const server = new FakeServer(), monday = futureMonday(), tuesday = weekEngine.addDays(monday, 1); weeklySeed(server, monday);
  const device = makeDevice(server);
  try {
    await device.login();
    device.exec(`S.jobs.fixed={id:'fixed',client:'c-week',date:${JSON.stringify(monday)},status:'Scheduled',service:'Other',prop:'30,-97',dateRequirement:'exact',requiredDate:${JSON.stringify(monday)}};openJob('fixed')`);
    for (const [selector, value] of Object.entries({ '#j_client': 'c-week', '#j_service': 'Other', '#j_prop': '30,-97', '#j_date': tuesday, '#j_rule': 'exact', '#j_required': monday, '#j_status': 'Scheduled', '#j_rep': 'One-time' })) device.element(selector).value = value;
    device.exec("saveJob('fixed')"); assert.equal(device.exec('S.jobs.fixed.date'), monday); assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.element('#j_required').value = tuesday;
    device.exec("saveJob('fixed')"); assert.equal(device.exec('S.jobs.fixed.date'), tuesday); assert.equal(device.exec('S.jobs.fixed.requiredDate'), tuesday);
  } finally { device.dispose(); }
});

test('a week can create clients for distinct addresses and sync them before their jobs', async () => {
  const server = new FakeServer(), monday = futureMonday(), requests = [], confirmations = [];
  const first = makeDevice(server, {}, { confirm: text => { confirmations.push(text); return true; }, fetch: weeklyFakeProvider(requests) }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.client.auth.getSession = async () => fakeSession();
    const text = [
      `123 Example St, Austin, TX 78701 | exact ${monday}`,
      `123 Example St, Austin, TX 78701 | exact ${monday}`,
      `456 Example St, Austin, TX 78701 | exact ${monday}`,
    ].join('\n');
    first.exec(`openWeekPlanner();weekPlan.setup.monday=${JSON.stringify(monday)};weekPlan.setup.flags=[true,true,true,true,true,false,false];weekPlan.setup.clientId=WEEK_NEW_CLIENT;weekPlan.setup.newType='Property manager';weekPlan.setup.newStage='Won';weekPlan.setup.text=${JSON.stringify(text)};weekReviewJobs();weekReviewSharing()`);
    assert.equal(first.exec('weekPlan.stage'), 'share'); assert.equal(first.exec('weekPlan.duplicates.length'), 1);
    assert.equal(first.exec('Object.keys(S.clients).length'), 0); assert.equal(first.exec('Object.keys(S.jobs).length'), 0);
    await first.exec('weekBegin()'); assert.equal(requests[0].addresses.length, 2);
    await first.exec('weekSuggest()'); first.exec('weekSave()');
    assert.match(confirmations.at(-1), /3 new scheduled jobs and 2 new clients/);
    assert.match(first.element('#wk_status').textContent, /Added 3 jobs and 2 new clients/);
    await wait(220);
    const clients = clone(second.exec('Object.values(S.clients)')), jobs = clone(second.exec('Object.values(S.jobs)'));
    assert.equal(clients.length, 2); assert.equal(jobs.length, 3);
    assert.ok(clients.every(c => c.type === 'Property manager' && c.stage === 'Won'));
    const pair = jobs.filter(j => j.prop.startsWith('123 Example'));
    assert.equal(pair.length, 2); assert.equal(pair[0].client, pair[1].client);
    assert.ok(jobs.every(j => clients.some(c => c.id === j.client)));
    assert.equal(second.exec('synced'), true);
  } finally { first.dispose(); second.dispose(); }
});

test('new-client duplicate detection and combined storage checks protect existing data', async () => {
  const server = new FakeServer(), monday = futureMonday(), requests = [];
  const existing = record('Fictional client', 'c-existing'); existing.props = '123 Example St, Austin, TX 78701';
  server.rows.set('clients/c-existing', { coll: 'clients', id: existing.id, data: existing });
  const device = makeDevice(server, {}, { confirm: () => true, fetch: weeklyFakeProvider(requests) });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    const text = `123 Example St, Austin, TX 78701 | exact ${monday}`;
    device.exec(`openWeekPlanner();weekPlan.setup.monday=${JSON.stringify(monday)};weekPlan.setup.flags=[true,true,true,true,true,false,false];weekPlan.setup.clientId=WEEK_NEW_CLIENT;weekPlan.setup.text=${JSON.stringify(text)};weekReviewJobs();weekReviewSharing()`);
    assert.equal(device.exec('weekPlan.duplicates.length'), 1);
    await device.exec('weekBegin()'); await device.exec('weekSuggest()');
    device.exec("const setBefore=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k.startsWith('mib_week_probe_'))throw new Error('full');return setBefore(k,v)};weekSave()");
    assert.match(device.element('#wk_status').textContent, /storage/i);
    assert.equal(device.exec('Object.keys(S.clients).length'), 1); assert.equal(device.exec('Object.keys(S.jobs).length'), 0);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

// Picked-stop routes use only fictional jobs, a fake provider, and no writes.
test('a picked route includes only chosen scheduled jobs across dates and changes no CRM records', async () => {
  const server = new FakeServer(); seedCrew(server); const requests = [];
  const extra = { id: 'later', client: 'c1', date: '2026-11-05', status: 'Scheduled', prop: 'Later Example Road', service: 'Mow', ord: 3, dateRequirement: 'deadline', requiredDate: '2026-11-06' };
  const done = { ...extra, id: 'done', status: 'Done', prop: 'Done Example Road' };
  server.rows.set('jobs/later', { coll: 'jobs', id: 'later', data: extra });
  server.rows.set('jobs/done', { coll: 'jobs', id: 'done', data: done });
  const first = makeDevice(server, {}, { fetch: async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return body.action === 'geocode' ? fakeRoadResponse({ matches: fakeMatches(body.addresses) }) : fakeRoadResponse({ order: [1, 0] });
  } });
  const second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.client.auth.getSession = async () => fakeSession();
    first.exec("rd='2026-11-04';S.meta.start='30,-97';tab='Route';openPickRoute()");
    assert.equal(first.exec("pickedRoute.candidates.some(x=>x.record.id==='done')"), false);
    first.exec("pickedRoute.selected.add('far');pickedRoute.selected.add('later');pickContinue()");
    assert.equal(requests.length, 0);
    assert.deepEqual(Array.from(first.exec('roadPlan.snapshot.stops.map(j=>j.id)')), ['far', 'later']);
    await first.exec('roadBegin()');
    assert.deepEqual(requests[0].addresses, ['Far Example Road', 'Later Example Road']);
    assert.doesNotMatch(JSON.stringify(requests[0]), /Near Example|Middle Example|Done Example|555/);
    await first.exec('roadOptimize()');
    assert.equal(requests[1].stops.length, 2); assert.deepEqual(requests[1].start, [30, -97]);
    assert.doesNotMatch(JSON.stringify(requests[1]), /Example|555/);
    assert.match(first.element('#rr_preview').innerHTML, /Later Example Road/);
    assert.match(first.element('#rr_preview').innerHTML, /Far Example Road/);
    assert.doesNotMatch(first.element('#rr_preview').innerHTML, /Near Example|Middle Example|Done Example/);
    assert.match(first.element('#rr_status').textContent, /not saved or synced/);
    first.exec('roadSave()'); // no hidden code path may rewrite picked stops
    assert.equal(first.exec('Object.keys(pending).length'), 0);
    await wait(40);
    assert.equal(second.exec("S.jobs.later.date"), '2026-11-05');
    assert.equal(second.exec("S.jobs.far.ord"), 0);
    assert.equal(second.exec("S.jobs.near.ord"), 1);
    assert.equal(second.exec("S.jobs.mid.ord"), 2);
    assert.equal(server.rows.get('jobs/later').data.status, 'Scheduled');
  } finally { first.dispose(); second.dispose(); }
});

test('picked routes honor date requirements and refuse stale selection or unsynced data', async () => {
  const server = new FakeServer(); seedCrew(server);
  const fixed = { id: 'fixed', client: 'c1', date: '2026-11-05', status: 'Scheduled', prop: 'Fixed Example Road', service: 'Mow', dateRequirement: 'exact', requiredDate: '2026-11-05' };
  const late = { ...fixed, id: 'late', prop: 'Late Example Road', dateRequirement: 'deadline', requiredDate: '2026-11-03' };
  server.rows.set('jobs/fixed', { coll: 'jobs', id: 'fixed', data: fixed });
  server.rows.set('jobs/late', { coll: 'jobs', id: 'late', data: late });
  const device = makeDevice(server);
  try {
    await device.login(); device.exec("rd='2026-11-04';openPickRoute()");
    assert.match(device.exec("pickedRoute.candidates.find(x=>x.record.id==='fixed').problem"), /must be done on 2026-11-05/);
    assert.match(device.exec("pickedRoute.candidates.find(x=>x.record.id==='late').problem"), /due by 2026-11-03/);
    device.exec("pickedRoute.selected.add('fixed');pickContinue()");
    assert.match(device.element('#pick_status').textContent, /changed/);
    assert.equal(device.exec('roadPlan'), null);
    device.exec("pickedRoute.selected.clear();pickedRoute.selected.add('far');S.jobs.far.prop='Edited since choosing';pickContinue()");
    assert.match(device.element('#pick_status').textContent, /changed/);
    device.exec("pickedRoute.selected.clear();pickedRoute.selected.add('near');synced=false;pickContinue()");
    assert.match(device.element('#pick_status').textContent, /sync state changed/i);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('a single picked stop opens Google Maps without calling a routing provider or saving', async () => {
  const server = new FakeServer(); seedCrew(server); let calls = 0;
  const device = makeDevice(server, {}, { fetch: async () => { calls++; throw new Error('unexpected provider request'); } });
  try {
    await device.login(); device.exec("rd='2026-11-04';S.meta.start='';openPickRoute();pickedRoute.selected.add('near');pickContinue()");
    assert.equal(calls, 0); assert.equal(device.exec('roadPlan.order.length'), 1);
    assert.match(device.element('#rr_status').textContent, /No optimization request was needed/);
    const part = clone(device.exec('pickMapParts(roadPlan)'))[0], url = new URL(part.url);
    assert.equal(url.searchParams.get('origin'), null);
    assert.equal(url.searchParams.get('destination'), 'Near Example Road, Austin, TX');
    assert.equal(device.exec('roadMapGuard()'), true);
    device.exec("S.jobs.near.status='Done'");
    assert.equal(device.exec('roadMapGuard()'), false);
    assert.match(device.element('#rr_status').textContent, /no longer scheduled/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('Google Maps parts cover every selected stop in order with at most three waypoints', () => {
  const device = makeDevice(new FakeServer());
  try {
    for (const n of [1, 2, 3, 4, 5, 8, 9, 99, 100]) {
      for (const round of [false, true]) {
        device.context.n = n; device.context.roundTrip = round;
        const parts = clone(device.exec(`(() => {
          const stops=Array.from({length:n},(_,i)=>({location:(30+i/1000)+',-97'}));
          return pickMapParts({snapshot:{start:'30,-98',round:roundTrip,stops},points:null,order:stops.map((_,i)=>i)})
        })()`));
        const expected = Array.from({ length: n }, (_, i) => `${30 + i / 1000},-97`);
        if (round) expected.push('30,-98');
        const actual = [];
        for (let i = 0; i < parts.length; i++) {
          const url = new URL(parts[i].url), waypoints = url.searchParams.get('waypoints');
          const intermediate = waypoints ? waypoints.split('|') : [];
          assert.ok(intermediate.length <= 3, `part ${i + 1} exceeds mobile waypoint limit`);
          assert.equal(url.searchParams.get('origin'), i ? actual.at(-1) : '30,-98');
          actual.push(...intermediate, url.searchParams.get('destination'));
        }
        assert.deepEqual(actual, expected, `${n} stops, return=${round}`);
      }
    }
  } finally { device.dispose(); }
});

test('a changed selected job blocks provider responses and opening stale map links', async () => {
  const server = new FakeServer(); seedCrew(server); let release;
  const device = makeDevice(server, {}, { fetch: async (_url, options) => {
    const body = JSON.parse(options.body);
    return new Promise(resolve => { release = () => resolve(fakeRoadResponse({ matches: fakeMatches(body.addresses) })); });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openPickRoute();pickedRoute.selected.add('far');pickedRoute.selected.add('near');pickContinue()");
    const pendingLookup = device.exec('roadBegin()'); await wait(0);
    device.exec("S.jobs.near.requiredDate='2026-11-05';S.jobs.near.dateRequirement='exact'"); release(); await pendingLookup;
    assert.match(device.element('#rr_status').textContent, /must be done on|changed/);
    assert.equal(device.exec('roadPlan.order'), null);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('picked routes reject more than 100 selections and invalid location IDs', async () => {
  const server = new FakeServer(); seedCrew(server);
  const device = makeDevice(server);
  try {
    await device.login();
    device.exec(`rd='2026-11-04';for(let i=0;i<101;i++)S.jobs['batch'+i]={id:'batch'+i,client:'c1',date:rd,status:'Scheduled',prop:'30,-97'};openPickRoute();
      pickedRoute.candidates.forEach(x=>{if(!x.problem)pickedRoute.selected.add(x.record.id)});pickUpdateCount();pickContinue()`);
    assert.match(device.element('#pick_status').textContent, /100 stops/);
    assert.equal(device.exec('roadPlan'), null);
    device.exec("S.jobs.batch0.id='batch1';openPickRoute()");
    assert.ok(device.exec("pickedRoute.candidates.filter(x=>/invalid or duplicate ID/.test(x.problem)).length") >= 2);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('picked duplicate addresses share a lookup but remain separate jobs', async () => {
  const server = new FakeServer(); const state = seedCrew(server), requests = [];
  state.jobs.near.prop = state.jobs.far.prop;
  server.rows.set('jobs/near', { coll: 'jobs', id: 'near', data: clone(state.jobs.near) });
  const device = makeDevice(server, {}, { fetch: async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    return body.action === 'geocode' ? fakeRoadResponse({ matches: fakeMatches(body.addresses) }) : fakeRoadResponse({ order: [0, 1] });
  } });
  try {
    await device.login(); device.client.auth.getSession = async () => fakeSession();
    device.exec("rd='2026-11-04';S.meta.start='30,-97';openPickRoute();pickedRoute.selected.add('far');pickedRoute.selected.add('near');pickContinue()");
    await device.exec('roadBegin()'); assert.equal(requests[0].addresses.length, 1);
    await device.exec('roadOptimize()'); assert.equal(requests[1].stops.length, 2);
    assert.equal(device.exec('roadPlan.order.length'), 2);
    assert.match(device.element('#rr_preview').innerHTML, /Repeated addresses are separate jobs/);
    assert.equal((device.element('#rr_preview').innerHTML.match(/Navigate to this stop/g) || []).length, 2);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('picked routes reject imprecise matches or quota errors without producing map links', async () => {
  for (const type of ['coarse', 'quota']) {
    const server = new FakeServer(); seedCrew(server); let calls = 0;
    const device = makeDevice(server, {}, { fetch: async (_url, options) => {
      calls++; const body = JSON.parse(options.body), matches = fakeMatches(body.addresses);
      if (type === 'quota') return fakeRoadResponse({ error: 'Geocodio daily limit reached.' }, 429);
      matches[0].accuracyType = 'city'; return fakeRoadResponse({ matches });
    } });
    try {
      await device.login(); device.client.auth.getSession = async () => fakeSession();
      device.exec("rd='2026-11-04';S.meta.start='30,-97';openPickRoute();pickedRoute.selected.add('far');pickedRoute.selected.add('near');pickContinue()");
      await device.exec('roadBegin()'); await device.exec('roadOptimize()');
      assert.equal(calls, 1); assert.equal(device.exec('roadPlan.order'), null);
      assert.match(device.element('#rr_status').textContent, /imprecise|limit|resolve/i);
      assert.doesNotMatch(device.element('#rr_preview').innerHTML, /google\.com\/maps/);
      assert.equal(device.exec('Object.keys(pending).length'), 0);
    } finally { device.dispose(); }
  }
});

test('picker safely escapes untrusted customer text and job identifiers', async () => {
  const server = new FakeServer(); seedCrew(server);
  const unsafe = { id: "unsafe'\"id", client: 'c1', date: '2026-11-04', status: 'Scheduled', prop: '<img src=x onerror=alert(1)>', service: '<script>bad</script>' };
  server.rows.set(`jobs/${unsafe.id}`, { coll: 'jobs', id: unsafe.id, data: unsafe });
  const device = makeDevice(server);
  try {
    await device.login(); device.exec("rd='2026-11-04';openPickRoute()");
    const list = device.element('#pick_list').innerHTML;
    assert.match(list, /&lt;img/); assert.match(list, /&lt;script/);
    assert.doesNotMatch(list, /<img|<script|unsafe'\"id/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

// Additional operations use fictional records and the same in-memory two-device server.
test('confirmed client and linked-job deletion retries from the outbox without deleting photo files', async () => {
  const server = new FakeServer(), warnings = [];
  const c1 = record('Fictional delete target', 'c-del2'), c2 = record('Fictional keep', 'c-keep');
  const jobs = [
    { id:'j-del1', client:c1.id, date:'2026-11-04', status:'Scheduled', prop:'Fictional address', service:'Mow' },
    { id:'j-del2', client:c1.id, date:'2026-10-04', status:'Paid', prop:'Fictional address', service:'Mow' },
    { id:'j-keep', client:c2.id, date:'2026-11-04', status:'Scheduled', prop:'Fictional address', service:'Mow' },
  ];
  for (const c of [c1,c2]) server.rows.set(`clients/${c.id}`, {coll:'clients',id:c.id,data:c});
  for (const j of jobs) server.rows.set(`jobs/${j.id}`, {coll:'jobs',id:j.id,data:j});
  server.photoObjects.set('j-del1/before/fictional.jpg', 'private mock image');
  const first = makeDevice(server, {}, { confirm: message => { warnings.push(message); return true; } }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    server.failWrites = true; first.exec("delClient('c-del2')"); await wait(40);
    assert.match(warnings[0], /1 client AND 2 linked jobs/);
    assert.match(warnings[0], /photo files are NOT deleted/i);
    assert.equal(first.exec("!!S.clients['c-del2'] || !!S.jobs['j-del1'] || !!S.jobs['j-del2']"), false);
    assert.equal(first.exec('Object.keys(pending).length'), 3);
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    assert.equal(server.rows.has('jobs/j-del1'), true);
    assert.equal(second.exec("!!S.clients['c-del2']"), true);
    server.failWrites = false; first.client.reconnect(); await wait(160);
    assert.equal(server.rows.has('clients/c-del2'), false);
    assert.equal(server.rows.has('jobs/j-del1'), false);
    assert.equal(server.rows.has('jobs/j-del2'), false);
    assert.equal(second.exec("!!S.clients['c-del2'] || !!S.jobs['j-del1']"), false);
    assert.equal(second.exec("!!S.clients['c-keep'] && !!S.jobs['j-keep']"), true);
    assert.equal(server.photoObjects.has('j-del1/before/fictional.jpg'), true);
    assert.equal(first.element('#st').textContent, 'Synced across devices');
  } finally { first.dispose(); second.dispose(); }
});

test('client deletion refuses stale confirmation and insufficient outbox storage', async () => {
  const server = new FakeServer(), messages = []; const c = record('Fictional target', 'c-stale');
  const j = {id:'j-stale', client:c.id, date:'2026-11-04', status:'Scheduled', prop:'Fictional address', service:'Mow'};
  server.rows.set(`clients/${c.id}`, {coll:'clients',id:c.id,data:c}); server.rows.set(`jobs/${j.id}`, {coll:'jobs',id:j.id,data:j});
  let device, confirmations = 0;
  device = makeDevice(server, {}, { alert: x => messages.push(x), confirm: () => { confirmations++; device.exec("S.jobs['j-stale'].service='Changed while confirming'"); return true; } });
  try {
    await device.login(); device.exec("delClient('c-stale')");
    assert.match(messages.pop(), /client or its linked jobs changed/i);
    assert.equal(device.exec("!!S.clients['c-stale'] && !!S.jobs['j-stale']"), true);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.exec(`{ const old=localStorage.setItem; localStorage.setItem=(k,v)=>{if(k.startsWith('mib_delete_probe_'))throw Error('quota');return old(k,v)}; }`);
    device.exec("delClient('c-stale')");
    assert.match(messages.pop(), /not enough device storage/i);
    assert.equal(confirmations, 1);
    assert.equal(server.rows.has('clients/c-stale'), true);
    assert.equal(server.rows.has('jobs/j-stale'), true);
  } finally { device.dispose(); }
});

test('a linked numeric client reference is counted and property imports cannot redirect fallback jobs', async () => {
  const server = new FakeServer(), c = record('Fictional numeric client', '1');
  const j = {id:'j-num', client:1, date:'2026-11-04', status:'Scheduled', prop:'', service:'Mow'};
  server.rows.set('clients/1', {coll:'clients',id:'1',data:c}); server.rows.set('jobs/j-num', {coll:'jobs',id:'j-num',data:j});
  const device = makeDevice(server);
  try {
    await device.login();
    assert.equal(device.exec("clientDeleteSnapshot(['1']).jobs.length"), 1);
    assert.throws(() => device.exec("importRecords({mode:'properties',clientId:'1',entries:['100 Fictional St']})"), /first property.*explicit address/i);
    assert.equal(device.exec("S.clients['1'].props"), '');
    assert.equal(device.exec("jaddr(S.jobs['j-num'])"), '');
  } finally { device.dispose(); }
});

test('edited job estimates retry and sync to a second device and recurring jobs inherit them', async () => {
  const server = new FakeServer(), messages = [], c = record('Fictional estimate', 'c-est');
  const j = {id:'j-est',client:c.id,date:'2026-11-04',status:'Scheduled',service:'Mow / edge / blow',prop:'Fictional address',repeat:'Weekly',dateRequirement:'deadline',requiredDate:'2026-11-04'};
  server.rows.set('clients/c-est',{coll:'clients',id:c.id,data:c});server.rows.set('jobs/j-est',{coll:'jobs',id:j.id,data:j});
  const first = makeDevice(server, {}, { alert:x=>messages.push(x) }), second = makeDevice(server);
  try {
    await Promise.all([first.login(),second.login()]); first.exec("openJob('j-est')");
    const values = {'#j_client':'c-est','#j_service':'Mow / edge / blow','#j_prop':'Fictional address','#j_date':'2026-11-04','#j_rule':'deadline','#j_required':'2026-11-04','#j_status':'Scheduled','#j_rep':'Weekly','#j_items':'','#j_price':'0','#j_notes':'','#j_minutes':'0'};
    for (const [selector,value] of Object.entries(values)) first.element(selector).value = value;
    first.exec("saveJob('j-est')"); assert.match(messages.pop(), /whole number of minutes/i);
    assert.equal(first.exec('Object.keys(pending).length'), 0);
    server.failWrites=true; first.element('#j_minutes').value='75'; first.exec("saveJob('j-est')"); await wait(40);
    assert.equal(first.exec("S.jobs['j-est'].estimatedMinutes"),75);
    assert.equal(second.exec("S.jobs['j-est'].estimatedMinutes"),undefined);
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    server.failWrites=false; first.client.reconnect(); await wait(130);
    assert.equal(second.exec("S.jobs['j-est'].estimatedMinutes"),75);
    first.exec("setStatus('j-est','Done')"); await wait(130);
    const next = clone(second.exec("Object.values(S.jobs).find(j=>j.id!=='j-est')"));
    assert.equal(next.estimatedMinutes,75); assert.equal(next.date,'2026-11-11');
    assert.equal(next.dateRequirement,undefined); assert.equal(next.requiredDate,undefined);
  } finally { first.dispose(); second.dispose(); }
});

test('weekly estimates survive an offline save and later sync, including an unknown estimate', async () => {
  const server = new FakeServer(), monday=futureMonday(), requests=[]; weeklySeed(server,monday);
  server.rows.get('jobs/old-week').data.estimatedMinutes=180;
  const first=makeDevice(server, {}, {confirm:()=>true,fetch:weeklyFakeProvider(requests)}),second=makeDevice(server);
  try {
    await Promise.all([first.login(),second.login()]);first.client.auth.getSession=async()=>fakeSession();
    first.exec(`openWeekPlanner();weekPlan.setup.monday=${JSON.stringify(monday)};weekPlan.setup.flags=[true,true,true,true,true,false,false];weekPlan.setup.clientId='c-week';weekPlan.setup.defaultMinutes='60';weekPlan.setup.text='100 Example St, Austin, TX 78701\\n200 Example St, Austin, TX 78701';weekReviewJobs();weekPlan.entries[0].estimatedMinutes='120';weekPlan.entries[1].estimatedMinutes='';weekReviewSharing()`);
    await first.exec('weekBegin()');await first.exec('weekSuggest()');
    assert.equal(first.exec('weekPlan.stage'),'preview'); assert.equal(first.exec('weekExistingWork(weekPlan).minutes[weekPlan.days[0]]'),180);
    server.failWrites=true;first.exec('weekSave()');await wait(50);
    assert.equal(first.exec('weekPlan.stage'),'saved');assert.equal(first.exec('Object.keys(pending).length'),2);
    assert.equal(second.exec('Object.keys(S.jobs).length'),1);
    server.failWrites=false;first.client.reconnect();await wait(160);
    const jobs=clone(second.exec('Object.values(S.jobs)'));
    assert.equal(jobs.find(j=>j.prop.startsWith('100 Example')).estimatedMinutes,120);
    assert.equal(jobs.find(j=>j.prop.startsWith('200 Example')).estimatedMinutes,null);
    assert.equal(jobs.find(j=>j.id==='old-week').estimatedMinutes,180);
    assert.equal(second.exec('synced'),true);
  } finally {first.dispose();second.dispose()}
});

test('a required date without a rule remains visible for correction and cannot be routed or moved', () => {
  const server = new FakeServer(), device = makeDevice(server);
  try {
    device.exec("S.clients.c1={id:'c1',name:'Fictional',props:'100 Fictional St'};S.jobs.j1={id:'j1',client:'c1',date:'2026-11-04',status:'Scheduled',service:'Mow',prop:'100 Fictional St',requiredDate:'2026-11-05'};rd='2026-11-05'");
    assert.match(device.exec("jobDateProblem(S.jobs.j1,rd)"), /no valid requirement/i);
    assert.match(device.exec("pickCandidates()[0].problem"), /no valid requirement/i);
    assert.match(device.exec('vDue()'), /Needs a valid requirement \(1\)/i);
    device.exec("addStop('j1')");
    assert.equal(device.exec('S.jobs.j1.date'), '2026-11-04');
    assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

// Customer-price estimates and job quotes: all records below are fictional.
function priceEstimate(id, client = 'c1', name = 'Fictional Client') {
  return { id, client, clientName: name, service: 'Mow / edge / blow', property: '123 Example Road, Austin, TX', date: '2026-11-01', status: 'Draft',
    lines: [{ description: 'Fictional work', quantityMilli: 1000, unitCents: 12500 }], totalCents: 12500,
    notes: 'Customer-visible note', teamNotes: 'Private team note' };
}
function seedPrice(server, coll, data) { server.rows.set(`${coll}/${data.id}`, { coll, id: data.id, data: clone(data) }); }
function fillPriceEstimate(device, { client = 'c1', status = 'Draft', property = '123 Example Road, Austin, TX', date = '2026-11-01', notes = 'Customer-visible note', teamNotes = 'Private team note' } = {}) {
  for (const [field, value] of Object.entries({ es_client: client, es_service: 'Mow / edge / blow', es_date: date, es_status: status, es_property: property, es_notes: notes, es_team_notes: teamNotes })) device.element('#' + field).value = value;
  device.exec('estimateClientChanged()');
}

test('price estimate calculations validate decimals and round each line in integer cents', () => {
  const device = makeDevice(new FakeServer());
  try {
    const parsed = clone(device.exec(`estimateParseRows([
      {description:'Mulch',quantity:'2.5',rate:'19.99'},
      {description:'Seed',quantity:'.5',rate:'.10'}])`));
    assert.equal(parsed.totalCents, 5003);
    assert.deepEqual(parsed.lines.map(line => [line.quantityMilli, line.unitCents]), [[2500, 1999], [500, 10]]);
    const extreme = device.exec(`estimateSum([{description:'Large',quantityMilli:999999999,unitCents:9000501}])`);
    assert.equal(extreme, Number((999999999n * 9000501n + 500n) / 1000n));
    for (const row of [
      { description: 'Work', quantity: '0', rate: '1' },
      { description: 'Work', quantity: '-1', rate: '1' },
      { description: 'Work', quantity: '1.0001', rate: '1' },
      { description: 'Work', quantity: '1', rate: '-2' },
      { description: 'Work', quantity: '1', rate: '1.001' },
      { description: 'Work', quantity: '1e3', rate: '1' },
      { description: 'Work', quantity: '999999999', rate: '999999999' },
      { description: 'Work | hidden', quantity: '1', rate: '1' },
      { description: '', quantity: '1', rate: '1' },
    ]) assert.throws(() => device.exec(`estimateParseRows(${JSON.stringify([row])})`));
    assert.throws(() => device.exec(`estimateStored(${JSON.stringify({ ...priceEstimate('e-bad'), totalCents: 1 })})`), /total needs review/i);
  } finally { device.dispose(); }
});

test('a customer estimate survives a failed save and reload, syncs, and hides private notes in copy and print', async () => {
  const server = new FakeServer();
  seedPrice(server, 'clients', record('Fictional <Client>', 'c1'));
  const clipboard = [], alerts = [];
  const options = { navigator: { clipboard: { writeText: async text => clipboard.push(text) } }, alert: message => alerts.push(message) };
  const first = makeDevice(server, {}, options), second = makeDevice(server);
  let reloaded;
  try {
    await Promise.all([first.login(), second.login()]);
    second.exec(`tab='Estimates';render()`);
    first.exec('openEstimate()'); fillPriceEstimate(first, { notes: 'Customer <visible>\nsecond line', teamNotes: 'Private team-only secret' });
    first.exec(`estimateDraft.rows=[{description:'<img src=x>',quantity:'2.5',rate:'19.99'},{description:'Seed',quantity:'.5',rate:'.10'}]`);
    server.failWrites = true;
    first.exec('saveEstimate()');
    await wait(30);
    const id = first.exec('Object.keys(S.estimates)[0]');
    assert.ok(id); assert.equal(first.exec(`S.estimates[${JSON.stringify(id)}].totalCents`), 5003);
    assert.match(first.storage.get('mib_pending_v1'), /Private team-only secret/);
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    const persisted = Object.fromEntries(first.storage); first.dispose(); server.failWrites = false;
    reloaded = makeDevice(server, persisted, options); await reloaded.login(); await wait(100);
    assert.equal(server.rows.get(`estimates/${id}`).data.totalCents, 5003);
    assert.equal(second.exec(`S.estimates[${JSON.stringify(id)}].clientName`), 'Fictional <Client>');
    assert.match(second.element('#est_saved').innerHTML, /Fictional &lt;Client&gt;/);
    reloaded.exec(`viewEstimate(${JSON.stringify(id)})`);
    const doc = reloaded.element('#doc').innerHTML;
    assert.match(doc, /&lt;img src=x&gt;/); assert.match(doc, /Customer &lt;visible&gt;<br>second line/);
    assert.match(doc, /\$50\.03/); assert.doesNotMatch(doc, /Private team-only secret|<img src=x>/);
    await reloaded.exec('copyEstimateDocument()');
    assert.match(clipboard.at(-1), /Customer <visible>/); assert.match(clipboard.at(-1), /Total: \$50\.03/);
    assert.doesNotMatch(clipboard.at(-1), /Private team-only secret/);
    reloaded.exec(`S.estimates[${JSON.stringify(id)}].notes='Changed elsewhere'`);
    await reloaded.exec('copyEstimateDocument()');
    assert.equal(clipboard.length, 1); assert.match(alerts.at(-1), /changed or was deleted/i);
  } finally { first.dispose(); second.dispose(); if (reloaded) reloaded.dispose(); }
});

test('saved estimate edits reject stale data, invalid fields and insufficient local storage', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'estimates', priceEstimate('e1'));
  const device = makeDevice(server);
  try {
    await device.login(); device.exec(`openEstimate('e1')`); fillPriceEstimate(device);
    device.exec(`S.estimates.e1.notes='Changed remotely';saveEstimate()`);
    assert.match(device.element('#es_error').textContent, /changed.*reopen/i); assert.equal(device.exec('S.estimates.e1.notes'), 'Changed remotely');
    device.exec(`openEstimate('e1')`); fillPriceEstimate(device); device.element('#es_date').value = '2026-02-30'; device.exec('saveEstimate()');
    assert.match(device.element('#es_error').textContent, /valid estimate date/i);
    device.element('#es_date').value = '2026-11-01'; device.exec(`estimateDraft.rows[0].rate='-1';saveEstimate()`);
    assert.match(device.element('#es_error').textContent, /rate needs a number/i);
    device.exec(`estimateDraft.rows[0].rate='125.00'`);
    const original = device.context.localStorage.setItem;
    device.context.localStorage.setItem = (key, value) => { if (key.startsWith('mib_import_probe_')) throw new Error('quota'); return original(key, value); };
    device.exec('saveEstimate()'); assert.match(device.element('#es_error').textContent, /not enough device storage/i);
    assert.equal(device.exec('S.estimates.e1.notes'), 'Changed remotely');
  } finally { device.dispose(); }
});

test('existing jobs expose a quote without changing their normal invoice behavior', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  seedPrice(server, 'jobs', { id: 'job-done', client: 'c1', service: 'Mow', prop: '123 Example Road', date: '2026-11-02', status: 'Done', items: 'Mow | 1 | 55', price: 55, notes: 'Job note' });
  const clipboard = [], device = makeDevice(server, {}, { navigator: { clipboard: { writeText: async text => clipboard.push(text) } } });
  try {
    await device.login(); device.exec(`tab='Estimates';render()`);
    assert.match(device.element('#est_jobs').innerHTML, /View quote/);
    device.exec(`openDoc('job-done','quote')`); assert.match(device.element('#doc').innerHTML, />Quote<\/h2>/);
    await device.exec(`dcopy('job-done','Quote')`); assert.match(clipboard.at(-1), /^Maintain It Bandits — Quote/);
    device.exec(`openDoc('job-done')`); assert.match(device.element('#doc').innerHTML, />Invoice<\/h2>/);
    await device.exec(`dcopy('job-done','Invoice')`); assert.match(clipboard.at(-1), /^Maintain It Bandits — Invoice/);
    assert.equal(server.rows.get('jobs/job-done').data.status, 'Done');
  } finally { device.dispose(); }
});

test('scheduling is explicit, syncs a fresh job, preserves the estimate, and prevents duplicate jobs', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'estimates', priceEstimate('e1'));
  const warnings = [], alerts = [], first = makeDevice(server, {}, { confirm: text => { warnings.push(text); return true; }, alert: text => alerts.push(text) }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    first.exec(`scheduleEstimate('e1')`); assert.equal(first.exec('Object.keys(S.jobs).length'), 0);
    first.element('#es_job_date').value = '2026-11-10'; first.element('#es_job_property').value = '123 Example Road';
    server.failWrites = true; first.exec('createJobFromEstimate()');
    const firstId = first.exec('Object.keys(S.jobs)[0]'); assert.ok(firstId); assert.match(firstId, /^j/);
    assert.match(warnings[0], /Create a scheduled job/); assert.equal(first.exec('S.estimates.e1.status'), 'Draft');
    const job = clone(first.exec(`S.jobs[${JSON.stringify(firstId)}]`));
    assert.equal(job.status, 'Scheduled'); assert.equal(job.date, '2026-11-10'); assert.equal(job.price, 125);
    assert.equal(job.sourceEstimateId, 'e1'); assert.equal(job.notes, 'Customer-visible note'); assert.equal(job.teamNotes, undefined);
    assert.match(first.storage.get('mib_pending_v1'), /sourceEstimateId/);
    server.failWrites = false; first.client.reconnect(); await wait(130);
    assert.equal(second.exec(`S.jobs[${JSON.stringify(firstId)}].sourceEstimateId`), 'e1');
    first.exec(`scheduleEstimate('e1')`); assert.match(alerts.at(-1), /already has a linked job/i);
    // Deleting the first job must not recycle its ID or reattach its orphaned photos.
    const photoPath = `jobs/${firstId}/before/fictional.jpg`; server.photoObjects.set(photoPath, 'fictional');
    first.exec(`rm('jobs',${JSON.stringify(firstId)})`); await wait(100);
    first.exec(`scheduleEstimate('e1')`); first.element('#es_job_date').value = '2026-11-11'; first.element('#es_job_property').value = '123 Example Road'; first.exec('createJobFromEstimate()');
    const nextId = first.exec('Object.keys(S.jobs)[0]'); assert.ok(nextId); assert.notEqual(nextId, firstId); assert.equal(server.photoObjects.get(photoPath), 'fictional');
  } finally { first.dispose(); second.dispose(); }
});

test('scheduling blocks stale, orphaned, unsynced, or concurrently linked estimates', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'estimates', priceEstimate('e1'));
  const alerts = []; let device, changeAtConfirm = false;
  device = makeDevice(server, {}, { alert: text => alerts.push(text), confirm: () => { if (changeAtConfirm) device.exec(`S.estimates.e1.notes='Changed while confirming'`); return true; } });
  try {
    await device.login(); device.exec(`scheduleEstimate('e1')`); device.element('#es_job_date').value = '2026-11-10'; device.element('#es_job_property').value = '123 Example Road';
    changeAtConfirm = true; device.exec('createJobFromEstimate()'); assert.equal(device.exec('Object.keys(S.jobs).length'), 0);
    assert.match(device.element('#es_job_error').textContent, /changed.*review/i);
    changeAtConfirm = false; device.exec(`scheduleEstimate('e1')`); device.element('#es_job_date').value = '2026-11-10'; device.element('#es_job_property').value = '123 Example Road';
    device.exec(`S.jobs.other={id:'other',sourceEstimateId:'e1'};createJobFromEstimate()`);
    assert.match(device.element('#es_job_error').textContent, /already has a linked job/i); assert.equal(device.exec('Object.keys(S.jobs).length'), 1);
    device.exec(`delete S.jobs.other;delete S.clients.c1;scheduleEstimate('e1')`); assert.match(alerts.at(-1), /client was deleted/i);
    device.exec(`synced=false;scheduleEstimate('e1')`); assert.match(alerts.at(-1), /Synced across devices/i);
  } finally { device.dispose(); }
});

test('client deletion requires a choice; kept estimates retain details and can be reassigned', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'clients', record('Replacement Client', 'c2'));
  seedPrice(server, 'estimates', priceEstimate('e1')); seedPrice(server, 'jobs', { id: 'j1', client: 'c1', date: '2026-11-10', status: 'Scheduled' });
  server.photoObjects.set('jobs/j1/before/fictional.jpg', 'fictional');
  const warnings = []; let allow = false;
  const first = makeDevice(server, {}, { confirm: text => { warnings.push(text); return allow; } }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.exec(`delClient('c1')`);
    assert.match(first.element('#dlg').innerHTML, /Choose keep or delete/); first.exec('confirmClientDeletion()');
    assert.match(first.element('#client_delete_status').textContent, /Choose whether to keep or delete/i); assert.ok(first.exec('S.clients.c1'));
    first.element('#client_estimate_choice').value = 'keep'; first.exec('confirmClientDeletion()'); assert.ok(first.exec('S.clients.c1'));
    assert.match(warnings.at(-1), /KEEP 1 saved estimate.*including customer details/i); assert.match(warnings.at(-1), /1 linked job/);
    allow = true; server.failWrites = true; first.exec('confirmClientDeletion()'); await wait(35);
    assert.equal(first.exec('S.clients.c1'), undefined); assert.equal(first.exec('S.jobs.j1'), undefined); assert.equal(first.exec('S.estimates.e1.clientName'), 'Fictional Client');
    assert.equal(server.photoObjects.size, 1); assert.match(first.storage.get('mib_pending_v1'), /deleted/);
    server.failWrites = false; first.client.reconnect(); await wait(130);
    assert.equal(second.exec('S.clients.c1'), undefined); assert.equal(second.exec('S.estimates.e1.clientName'), 'Fictional Client');
    second.exec(`tab='Estimates';render()`); assert.match(second.element('#est_saved').innerHTML, /Client deleted \(estimate kept\)/);
    second.exec(`viewEstimate('e1')`); assert.match(second.element('#doc').innerHTML, /Fictional Client/);
    first.exec(`openEstimate('e1')`); fillPriceEstimate(first, { client: 'c2' }); first.exec('saveEstimate()'); await wait(110);
    assert.equal(second.exec('S.estimates.e1.client'), 'c2'); assert.equal(second.exec('S.estimates.e1.clientName'), 'Replacement Client');
  } finally { first.dispose(); second.dispose(); }
});

test('client and multi-lead deletion can explicitly delete estimates and reject stale choices', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Lead One', 'c1')); seedPrice(server, 'clients', record('Lead Two', 'c2'));
  seedPrice(server, 'estimates', priceEstimate('e1', 'c1', 'Lead One')); seedPrice(server, 'estimates', priceEstimate('e2', 'c2', 'Lead Two'));
  const warnings = []; let device, change = false;
  device = makeDevice(server, {}, { confirm: text => { warnings.push(text); if (change) device.exec(`S.estimates.e1.notes='Changed while confirming'`); return true; } });
  try {
    await device.login(); device.exec(`delClient('c1')`); device.element('#client_estimate_choice').value = 'delete'; change = true; device.exec('confirmClientDeletion()');
    assert.match(device.element('#client_delete_status').textContent, /changed.*review/i); assert.ok(device.exec('S.clients.c1')); assert.ok(device.exec('S.estimates.e1'));
    change = false; device.exec('openLeadDeletion();leadSelectShown()'); assert.match(device.element('#lead_count').textContent, /2 selected.*2 saved estimates/);
    device.exec('deleteSelectedLeads()'); assert.match(device.element('#lead_status').textContent, /Choose whether to keep or delete/i);
    assert.equal(device.exec('Object.keys(S.clients).length'), 2);
    device.element('#lead_estimate_choice').value = 'delete'; device.exec('deleteSelectedLeads()');
    assert.match(warnings.at(-1), /DELETE 2 saved estimates/); assert.equal(device.exec('Object.keys(S.clients).length'), 0); assert.equal(device.exec('Object.keys(S.estimates).length'), 0);
    await wait(120); assert.equal(server.rows.has('estimates/e1'), false); assert.equal(server.rows.has('estimates/e2'), false);
  } finally { device.dispose(); }
});

test('multi-lead selection preserves a deliberate keep choice for all selected estimates', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Lead One', 'c1')); seedPrice(server, 'clients', record('Lead Two', 'c2'));
  seedPrice(server, 'estimates', priceEstimate('e1', 'c1', 'Lead One')); seedPrice(server, 'estimates', priceEstimate('e2', 'c2', 'Lead Two'));
  const warnings = [], device = makeDevice(server, {}, { confirm: text => { warnings.push(text); return true; } });
  try {
    await device.login(); device.exec('openLeadDeletion();leadSelectShown()'); device.element('#lead_estimate_choice').value = 'keep'; device.exec('deleteSelectedLeads()');
    assert.match(warnings.at(-1), /KEEP 2 saved estimates/); assert.equal(device.exec('Object.keys(S.clients).length'), 0); assert.equal(device.exec('Object.keys(S.estimates).length'), 2);
    await wait(100); assert.equal(server.rows.has('estimates/e1'), true); assert.equal(server.rows.has('estimates/e2'), true);
  } finally { device.dispose(); }
});

test('backup includes estimates; older restores keep them and new restores replace them only after confirmation', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'estimates', priceEstimate('e1'));
  const warnings = [], alerts = []; let allow = false;
  const device = makeDevice(server, {}, { confirm: text => { warnings.push(text); return allow; }, alert: text => alerts.push(text) });
  try {
    await device.login(); device.exec('openBackup()'); assert.match(device.element('#dlg').innerHTML, /&quot;estimates&quot;/);
    const old = { clients: { c2: record('Restored Client', 'c2') }, jobs: {}, meta: {} };
    device.element('#bk').value = JSON.stringify(old); device.exec('restore()'); assert.ok(device.exec('S.clients.c1')); assert.match(warnings.at(-1), /older backup.*Current estimates will be kept/i);
    allow = true; device.exec('restore()'); assert.equal(device.exec('S.clients.c1'), undefined); assert.ok(device.exec('S.estimates.e1'));
    device.exec(`viewEstimate('e1')`); assert.match(device.element('#doc').innerHTML, /Fictional Client/); await wait(100);
    const full = { clients: { c2: record('Restored Client', 'c2') }, jobs: {}, estimates: { e2: priceEstimate('e2', 'c2', 'Restored Client') }, meta: {} };
    device.element('#bk').value = JSON.stringify(full); device.exec('restore()'); assert.match(warnings.at(-1), /clients, jobs, saved estimates and settings/i);
    assert.equal(device.exec('S.estimates.e1'), undefined); assert.ok(device.exec('S.estimates.e2')); await wait(110);
    assert.equal(server.rows.has('estimates/e1'), false); assert.equal(server.rows.has('estimates/e2'), true);
    device.element('#bk').value = JSON.stringify({ clients: {}, jobs: {}, estimates: null }); device.exec('restore()');
    assert.match(alerts.at(-1), /valid backup/i); assert.ok(device.exec('S.estimates.e2'));
  } finally { device.dispose(); }
});

test('client changes while editing and linked jobs block accidental customer reassignment', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'clients', record('Other Client', 'c2'));
  seedPrice(server, 'estimates', priceEstimate('e1')); seedPrice(server, 'jobs', { id: 'j1', client: 'c1', sourceEstimateId: 'e1', date: '2026-11-10', status: 'Scheduled' });
  const device = makeDevice(server);
  try {
    await device.login(); device.exec(`openEstimate('e1')`); fillPriceEstimate(device);
    device.exec(`S.clients.c1.name='Changed remotely';saveEstimate()`);
    assert.match(device.element('#es_error').textContent, /selected client changed/i); assert.equal(device.exec('S.estimates.e1.clientName'), 'Fictional Client');
    device.exec(`S.clients.c1.name='Fictional Client';openEstimate('e1')`); fillPriceEstimate(device, { client: 'c2' }); device.exec('saveEstimate()');
    assert.match(device.element('#es_error').textContent, /linked jobs for another client/i); assert.equal(device.exec('S.estimates.e1.client'), 'c1');
    device.exec(`S.jobs.j1.client='c2';saveEstimate()`); assert.equal(device.exec('S.estimates.e1.client'), 'c2');
  } finally { device.dispose(); }
});

test('deleting an estimate requires confirmation and leaves linked jobs and photos intact', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'estimates', priceEstimate('e1'));
  seedPrice(server, 'jobs', { id: 'j1', client: 'c1', sourceEstimateId: 'e1', date: '2026-11-10', status: 'Scheduled', price: 125 });
  server.photoObjects.set('jobs/j1/before/fictional.jpg', 'fictional');
  const warnings = []; let allow = false;
  const device = makeDevice(server, {}, { confirm: text => { warnings.push(text); return allow; } });
  try {
    await device.login(); device.exec(`deleteEstimate('e1')`); assert.ok(device.exec('S.estimates.e1')); assert.match(warnings.at(-1), /1 linked job will remain unchanged/);
    allow = true; server.failWrites = true; device.exec(`deleteEstimate('e1')`); await wait(30);
    assert.equal(device.exec('S.estimates.e1'), undefined); assert.ok(device.exec('S.jobs.j1')); assert.equal(server.photoObjects.size, 1);
    assert.match(device.storage.get('mib_pending_v1'), /estimates/); server.failWrites = false; device.client.reconnect(); await wait(110);
    assert.equal(server.rows.has('estimates/e1'), false); assert.equal(server.rows.has('jobs/j1'), true); assert.equal(server.photoObjects.size, 1);
  } finally { device.dispose(); }
});

test('local-only estimates seed an empty cloud and stale fetches do not erase later edits', async () => {
  const server = new FakeServer(), cached = { clients: {}, jobs: {}, estimates: { e1: priceEstimate('e1') }, meta: {} };
  const first = makeDevice(server, { mib: JSON.stringify(cached) }), second = makeDevice(server);
  try {
    await first.login(); await wait(110); assert.equal(server.rows.get('estimates/e1').data.clientName, 'Fictional Client');
    await second.login(); assert.equal(second.exec('S.estimates.e1.totalCents'), 12500);
    server.selectDelay = 60; first.exec('load()');
    first.exec(`w('estimates',Object.assign({},S.estimates.e1,{notes:'Edited during load'}))`);
    await wait(160); assert.equal(first.exec('S.estimates.e1.notes'), 'Edited during load');
    assert.equal(second.exec('S.estimates.e1.notes'), 'Edited during load');
  } finally { first.dispose(); second.dispose(); }
});

// Completed work is a view of fictional existing jobs, not a new collection.
test('Completed includes existing Done, Invoiced and Paid jobs without changing Open or records', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  const jobs = [
    { id:'scheduled', client:'c1', service:'Scheduled work', prop:'1 Fictional Road', date:'2026-11-06', status:'Scheduled', price:60 },
    { id:'done', client:'c1', service:'Done work', prop:'2 Fictional Road', date:'2026-11-03', status:'Done', price:70 },
    { id:'invoice', client:'c1', service:'Invoiced work', prop:'3 Fictional Road', date:'2026-11-04', status:'Invoiced', price:80 },
    { id:'paid', client:'c1', service:'Paid work', prop:'4 Fictional Road', date:'2026-11-05', status:'Paid', price:'' },
    { id:'unknown', client:'c1', service:'Unknown work', prop:'5 Fictional Road', date:'2026-11-02', status:'Unknown' },
  ];
  jobs.forEach(job => seedPrice(server, 'jobs', job));
  const device = makeDevice(server);
  try {
    await device.login(); const before=JSON.stringify(clone(device.exec('S.jobs')));
    device.exec(`tab='Completed';render()`);
    let html=device.element('#completed_list').innerHTML;
    assert.match(device.element('#main').innerHTML, /scheduled job dates, not completion dates/i);
    assert.equal(device.element('#completed_count').textContent, '3 completed jobs shown');
    assert.match(html, /Done work/); assert.match(html, /Invoiced work/); assert.match(html, /Paid work/);
    assert.doesNotMatch(html, /Scheduled work|Unknown work/); assert.match(html, /Scheduled: 2026-11-05/); assert.match(html, /Price not set/);
    assert.ok(html.indexOf('Paid work')<html.indexOf('Invoiced work')&&html.indexOf('Invoiced work')<html.indexOf('Done work'));
    assert.match(html, /Edit job/); assert.match(html, /Invoice/); assert.match(html, /Before \/ after photos/); assert.match(html, /Delete job/);
    device.exec(`completedFilter='Done';completedList()`); assert.equal(device.element('#completed_count').textContent, '1 completed job shown');
    assert.match(device.element('#completed_list').innerHTML, /Done work/); assert.doesNotMatch(device.element('#completed_list').innerHTML, /Invoiced work|Paid work/);
    device.exec(`completedFilter='All';completedQuery='3 Fictional';completedList()`); assert.match(device.element('#completed_list').innerHTML, /Invoiced work/);
    device.exec(`completedQuery='2026-11-05';completedList()`); assert.match(device.element('#completed_list').innerHTML, /Paid work/);
    device.exec(`completedQuery='no matching work';completedList()`); assert.equal(device.element('#completed_count').textContent, '0 completed jobs shown');
    assert.match(device.element('#completed_list').innerHTML, /No completed jobs match/);
    device.exec(`completedQuery='';completedFilter='All';tab='Jobs';jf='Open';render()`);
    html=device.element('#main').innerHTML; assert.match(html, /Done work/); assert.match(html, /Invoiced work/); assert.doesNotMatch(html, /Paid work/);
    assert.equal(JSON.stringify(clone(device.exec('S.jobs'))), before); assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.exec(`openDoc('paid')`); assert.match(device.element('#doc').innerHTML, />Invoice<\/h2>/);
  } finally { device.dispose(); }
});

test('marking done appears in Completed and remains Open; invoiced and paid stay visible after syncing', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  seedPrice(server, 'jobs', { id:'j-work', client:'c1', service:'Fictional work', prop:'123 Example Road', date:'2026-11-04', status:'Scheduled', repeat:'One-time', price:80 });
  const [first, second] = await devices(server);
  try {
    second.exec(`tab='Completed';render()`); assert.equal(second.element('#completed_count').textContent, '0 completed jobs shown');
    server.failWrites=true; first.exec(`setStatus('j-work','Done')`); await wait(35);
    assert.equal(first.exec(`S.jobs['j-work'].status`), 'Done'); assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    assert.match(first.storage.get('mib_pending_v1'), /j-work/);
    first.exec(`tab='Completed';render()`); assert.match(first.element('#completed_list').innerHTML, /Fictional work/);
    first.exec(`tab='Jobs';jf='Open';render()`); assert.match(first.element('#main').innerHTML, /Fictional work/);
    server.failWrites=false; first.client.reconnect(); await wait(150);
    assert.equal(server.rows.get('jobs/j-work').data.status, 'Done');
    assert.equal(second.exec(`S.jobs['j-work'].status`), 'Done'); assert.match(second.element('#completed_list').innerHTML, /Fictional work/);
    first.exec(`setStatus('j-work','Invoiced')`); await wait(110);
    assert.equal(second.exec(`S.jobs['j-work'].status`), 'Invoiced'); assert.match(second.element('#completed_list').innerHTML, /Invoiced/);
    first.exec(`tab='Jobs';jf='Open';render()`); assert.match(first.element('#main').innerHTML, /Fictional work/);
    first.exec(`setStatus('j-work','Paid')`); await wait(110);
    assert.equal(second.exec(`S.jobs['j-work'].status`), 'Paid'); assert.match(second.element('#completed_list').innerHTML, /Paid/);
    first.exec(`tab='Jobs';jf='Open';render()`); assert.doesNotMatch(first.element('#main').innerHTML, /Fictional work/);
    first.exec(`tab='Completed';render()`); assert.match(first.element('#completed_list').innerHTML, /Fictional work/);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 1);
  } finally { first.dispose(); second.dispose(); }
});

test('a repeating job keeps its next occurrence scheduled, while the finished occurrence appears once', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  seedPrice(server, 'jobs', { id:'j-repeat', client:'c1', service:'Repeat work', prop:'123 Example Road', date:'2026-11-04', status:'Scheduled', repeat:'Weekly', estimatedMinutes:45 });
  const device = makeDevice(server);
  try {
    await device.login(); device.exec(`setStatus('j-repeat','Done');tab='Completed';render()`);
    const all=clone(device.exec('Object.values(S.jobs)')), finished=all.find(j=>j.id==='j-repeat'), next=all.find(j=>j.id!=='j-repeat');
    assert.equal(finished.status, 'Done'); assert.ok(finished.spawned); assert.equal(next.status, 'Scheduled'); assert.equal(next.date, '2026-11-11'); assert.equal(next.estimatedMinutes,45);
    const html=device.element('#completed_list').innerHTML; assert.match(html, /j-repeat/); assert.doesNotMatch(html, new RegExp(next.id));
    assert.equal(device.element('#completed_count').textContent, '1 completed job shown');
    device.exec(`setStatus('j-repeat','Invoiced');setStatus('j-repeat','Paid')`); assert.equal(device.exec('Object.keys(S.jobs).length'), 2);
  } finally { device.dispose(); }
});

test('Completed escapes customer content and invalid job IDs cannot trigger actions', async () => {
  const server = new FakeServer(), id='job" onmouseover="bad';
  seedPrice(server, 'clients', record('<img src=x onerror=bad()>', 'c1'));
  seedPrice(server, 'jobs', { id, client:'c1', service:'<svg onload=bad()>', prop:'123 <b>Example</b>', date:'2026-11-04', status:'Done' });
  const device=makeDevice(server);
  try {
    await device.login(); device.exec(`S.jobs.invalid={id:'',client:'c1',service:'Invalid ID',date:'',status:'Done'};tab='Completed';render()`);
    const html=device.element('#completed_list').innerHTML;
    assert.match(html, /&lt;img src=x onerror=bad\(\)&gt;/); assert.match(html, /&lt;svg onload=bad\(\)&gt;/);
    assert.match(html, /job&quot; onmouseover=&quot;bad/); assert.doesNotMatch(html, /<img|<svg/);
    assert.match(html, /invalid ID; review your backup/i); assert.doesNotMatch(html, /data-job=""/);
  } finally { device.dispose(); }
});

test('deleting a completed job still requires confirmation and never removes its photo files', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  seedPrice(server, 'jobs', { id:'j-done', client:'c1', service:'Done work', prop:'123 Example Road', date:'2026-11-04', status:'Done' });
  server.photoObjects.set('jobs/j-done/before/fictional.jpg', 'fictional');
  let accept=false; const warnings=[], device=makeDevice(server, {}, { confirm: text => {warnings.push(text);return accept;} });
  try {
    await device.login(); device.exec(`tab='Completed';render();delJob('j-done')`);
    assert.ok(device.exec(`S.jobs['j-done']`)); assert.match(warnings.at(-1), /photo files are NOT deleted/i);
    accept=true; device.exec(`delJob('j-done')`); await wait(110);
    assert.equal(device.exec(`S.jobs['j-done']`), undefined); assert.equal(server.rows.has('jobs/j-done'), false);
    assert.equal(server.photoObjects.size, 1); assert.equal(device.element('#completed_count').textContent, '0 completed jobs shown');
  } finally { device.dispose(); }
});

test('Completed refuses to edit a deleted job or silently reassign a job whose client is missing', async () => {
  const server=new FakeServer(); seedPrice(server, 'clients', record('Other fictional client', 'c2'));
  seedPrice(server, 'jobs', { id:'orphan', client:'missing-client', service:'Orphaned work', prop:'123 Example Road', date:'2026-11-04', status:'Done' });
  const alerts=[],device=makeDevice(server, {}, { alert: message=>alerts.push(message) });
  try {
    await device.login(); device.exec(`tab='Completed';render();editCompletedJob('orphan')`);
    assert.match(alerts.at(-1), /client is missing/i); assert.equal(device.element('#dlg').open, false);
    assert.equal(device.exec('S.jobs.orphan.client'), 'missing-client'); assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.exec(`delete S.jobs.orphan;editCompletedJob('orphan')`);
    assert.match(alerts.at(-1), /job no longer exists/i); assert.equal(device.element('#completed_count').textContent, '0 completed jobs shown');
  } finally { device.dispose(); }
});

// Bulk deletion uses only fictional records and an in-memory Supabase substitute.
function selectBulk(device, id, checked = true) {
  device.exec(`{const i=bulkDeletion.candidates.findIndex(c=>c.id===${JSON.stringify(id)});if(i<0)throw Error('missing test candidate');bulkToggle({dataset:{index:String(i)},checked:${checked}})}`);
}

test('bulk Completed deletion respects filters, confirms hidden selections and retries without deleting photos or estimates', async () => {
  const server = new FakeServer();
  seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  for (const job of [
    { id:'done', client:'c1', status:'Done', service:'Mow', prop:'100 Fictional Rd', date:'2026-10-01', sourceEstimateId:'e1' },
    { id:'paid', client:'c1', status:'Paid', service:'Trim', prop:'200 Fictional Rd', date:'2026-10-02' },
    { id:'scheduled', client:'c1', status:'Scheduled', service:'Future', prop:'300 Fictional Rd', date:'2026-11-01' },
    { id:'invoiced', client:'c1', status:'Invoiced', service:'Other', prop:'400 Fictional Rd', date:'2026-10-03' },
  ]) seedPrice(server, 'jobs', job);
  seedPrice(server, 'estimates', priceEstimate('e1'));
  server.photoObjects.set('jobs/done/before/fictional.jpg', 'fictional');
  const warnings = []; let accept = false;
  const first = makeDevice(server, {}, { confirm: text => { warnings.push(text); return accept; } }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    first.exec("tab='Completed';completedFilter='All';render();openBulkDeletion('completed')");
    assert.equal(first.exec('bulkDeletion.selected.size'), 0);
    assert.equal(first.exec("bulkDeletion.candidates.some(c=>c.id==='scheduled')"), false);
    first.element('#bulk_filter').value = 'Done'; first.exec('bulkFilter();bulkSelectShown()');
    first.element('#bulk_filter').value = 'Paid'; first.exec('bulkFilter();bulkSelectShown()');
    assert.match(first.element('#bulk_count').textContent, /2 selected.*1 hidden by filters/);
    assert.match(first.element('#bulk_review_list').innerHTML, /100 Fictional Rd/);
    assert.match(first.element('#bulk_review_list').innerHTML, /200 Fictional Rd/);
    first.exec('deleteBulkSelected()');
    assert.match(warnings.at(-1), /Delete 2 selected jobs/);
    assert.match(warnings.at(-1), /1 selected record.*hidden by the current filters/);
    assert.match(warnings.at(-1), /photo files are NOT deleted/i);
    assert.ok(first.exec('S.jobs.done && S.jobs.paid')); assert.equal(first.exec('Object.keys(pending).length'), 0);
    accept = true; server.failWrites = true; first.exec('deleteBulkSelected()'); await wait(45);
    assert.equal(first.exec('S.jobs.done'), undefined); assert.equal(first.exec('S.jobs.paid'), undefined);
    assert.ok(first.exec('S.jobs.scheduled && S.jobs.invoiced && S.clients.c1 && S.estimates.e1'));
    assert.equal(server.rows.has('jobs/done'), true); assert.equal(server.photoObjects.size, 1);
    assert.match(first.storage.get('mib_pending_v1'), /"deleted":true/);
    server.failWrites = false; first.client.reconnect(); await wait(150);
    assert.equal(second.exec('S.jobs.done'), undefined); assert.equal(second.exec('S.jobs.paid'), undefined);
    assert.ok(second.exec('S.jobs.scheduled && S.jobs.invoiced && S.estimates.e1 && S.clients.c1'));
    assert.equal(server.photoObjects.size, 1); assert.equal(first.element('#st').textContent, 'Synced across devices');
  } finally { first.dispose(); second.dispose(); }
});

test('bulk job picker inherits its view, excludes malformed records, and escapes displayed data', async () => {
  const server = new FakeServer();
  seedPrice(server, 'clients', record('Client <img src=x onerror=alert(1)>', 'c1'));
  seedPrice(server, 'jobs', { id:`j'\" onclick=\"alert(2)`, client:'c1', status:'Done', service:'Mow <script>', date:'2026-10-01' });
  seedPrice(server, 'jobs', { id:'paid', client:'c1', status:'Paid', service:'Paid work', date:'2026-10-02' });
  server.rows.set('jobs/bad', { coll:'jobs', id:'bad', data:{id:'different', client:'c1', status:'Done', service:'Bad ID', date:'2026-10-03'} });
  const warnings=[], device=makeDevice(server, {}, {confirm:message=>{warnings.push(message);return false}});
  try {
    await device.login(); device.exec("jf='Open';tab='Jobs';render();openBulkDeletion('jobs')");
    assert.match(device.element('#dlg').innerHTML, /value="Open" selected/);
    assert.doesNotMatch(device.element('#bulk_list').innerHTML, /Paid work/);
    assert.match(device.element('#bulk_list').innerHTML, /&lt;img/); assert.doesNotMatch(device.element('#bulk_list').innerHTML, /<img/);
    assert.match(device.element('#bulk_list').innerHTML, /disabled/); assert.doesNotMatch(device.element('#bulk_list').innerHTML, /onclick=\"alert\(2\)/);
    device.exec('bulkSelectShown()'); assert.equal(device.exec('bulkDeletion.selected.size'), 1);
    device.exec('deleteBulkSelected()'); assert.match(warnings.at(-1), /Delete 1 selected job/);
    assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.element('#bulk_filter').value='All'; device.exec('bulkFilter();bulkSelectShown()');
    assert.equal(device.exec('bulkDeletion.selected.size'), 2); device.exec('bulkClear()'); assert.equal(device.exec('bulkDeletion.selected.size'), 0);
  } finally { device.dispose(); }
});

test('bulk clients require a fresh keep/delete choice, confirm counts, and can keep estimates', async () => {
  const server=new FakeServer();
  seedPrice(server,'clients',record('Fictional One','c1'));
  seedPrice(server,'clients',{...record('Fictional Two','c2'),stage:'Recurring'});
  seedPrice(server,'clients',{...record('Unselected Client','c3'),stage:'Won'});
  for(const id of ['1','2','3']){
    seedPrice(server,'jobs',{id:'j'+id,client:'c'+id,status:id==='2'?'Paid':'Scheduled',service:'Job '+id,date:'2026-10-0'+id});
    seedPrice(server,'estimates',priceEstimate('e'+id,'c'+id,id==='3'?'Unselected Client':'Fictional '+(id==='1'?'One':'Two')));
  }
  server.photoObjects.set('jobs/j2/after/fictional.jpg','fictional');
  const warnings=[];let accept=false;const first=makeDevice(server,{}, {confirm:message=>{warnings.push(message);return accept}}),second=makeDevice(server);
  try{
    await Promise.all([first.login(),second.login()]);first.exec("tab='Clients';q='';render();openBulkDeletion('clients')");
    selectBulk(first,'c1');first.element('#bulk_estimate_choice').value='keep';
    first.element('#bulk_search').value='Fictional Two';first.exec('bulkFilter()');selectBulk(first,'c2');
    assert.equal(first.element('#bulk_estimate_choice').value,'');
    assert.match(first.element('#bulk_count').textContent,/2 selected.*1 hidden.*2 linked jobs.*2 saved estimates/);
    first.exec('deleteBulkSelected()');assert.match(first.element('#bulk_status').textContent,/Choose whether to keep or delete/i);assert.equal(warnings.length,0);
    first.element('#bulk_estimate_choice').value='keep';first.exec('deleteBulkSelected()');
    assert.match(warnings.at(-1),/2 clients AND 2 linked jobs/);assert.match(warnings.at(-1),/KEEP 2 saved estimates/);
    assert.match(warnings.at(-1),/1 selected record.*hidden/);assert.equal(first.exec('Object.keys(S.clients).length'),3);
    accept=true;first.exec('deleteBulkSelected()');await wait(140);
    assert.equal(second.exec('S.clients.c1'),undefined);assert.equal(second.exec('S.clients.c2'),undefined);
    assert.ok(second.exec('S.clients.c3 && S.jobs.j3 && S.estimates.e1 && S.estimates.e2 && S.estimates.e3'));
    assert.equal(second.exec('S.jobs.j1'),undefined);assert.equal(second.exec('S.jobs.j2'),undefined);assert.equal(server.photoObjects.size,1);
  }finally{first.dispose();second.dispose()}
});

test('bulk clients can delete estimates but reject stale records, changed choices and insufficient storage', async () => {
  const server=new FakeServer();
  for(const id of ['1','2']){
    seedPrice(server,'clients',{...record('Client '+id,'c'+id),stage:id==='1'?'Lead':'Won'});
    seedPrice(server,'jobs',{id:'j'+id,client:'c'+id,status:'Done',service:'Work '+id,date:'2026-10-0'+id});
    seedPrice(server,'estimates',priceEstimate('e'+id,'c'+id,'Client '+id));
  }
  server.photoObjects.set('jobs/j1/before/fictional.jpg','fictional');
  let device,changeChoice=false;const warnings=[];
  device=makeDevice(server,{}, {confirm:message=>{warnings.push(message);if(changeChoice)device.element('#bulk_estimate_choice').value='keep';return true}});
  try{
    await device.login();device.exec("openBulkDeletion('clients');bulkSelectShown()");device.element('#bulk_estimate_choice').value='delete';
    device.exec("S.jobs.j1.service='Changed after selection';deleteBulkSelected()");
    assert.match(device.element('#bulk_status').textContent,/changed.*select again/i);assert.equal(warnings.length,0);assert.equal(device.exec('Object.keys(pending).length'),0);
    device.exec("openBulkDeletion('clients');bulkSelectShown()");device.element('#bulk_estimate_choice').value='delete';changeChoice=true;device.exec('deleteBulkSelected()');
    assert.match(warnings.at(-1),/DELETE 2 saved estimates/);assert.match(device.element('#bulk_status').textContent,/choice changed/i);
    assert.equal(device.exec('Object.keys(S.clients).length'),2);assert.equal(device.exec('Object.keys(pending).length'),0);
    changeChoice=false;device.element('#bulk_estimate_choice').value='delete';
    device.exec("globalThis.savedSetItem=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k.startsWith('mib_delete_probe_'))throw Error('quota');return savedSetItem(k,v)};deleteBulkSelected()");
    assert.match(device.element('#bulk_status').textContent,/Not enough device storage/i);assert.equal(device.exec('Object.keys(S.clients).length'),2);
    device.exec('localStorage.setItem=savedSetItem;deleteBulkSelected()');await wait(130);
    assert.equal(device.exec('Object.keys(S.clients).length'),0);assert.equal(device.exec('Object.keys(S.jobs).length'),0);assert.equal(device.exec('Object.keys(S.estimates).length'),0);
    assert.equal(server.rows.size,0);assert.equal(server.photoObjects.size,1);
  }finally{device.dispose()}
});

test('bulk estimate deletion leaves linked jobs and photos, rejecting linked-job changes during confirmation', async () => {
  const server=new FakeServer();seedPrice(server,'clients',record('Fictional Client','c1'));
  for(const id of ['1','2','3']){
    seedPrice(server,'estimates',priceEstimate('e'+id));
    seedPrice(server,'jobs',{id:'j'+id,client:'c1',sourceEstimateId:'e'+id,status:'Scheduled',service:'Work '+id,date:'2026-11-0'+id});
  }
  server.photoObjects.set('jobs/j1/before/fictional.jpg','fictional');
  let device,mutate=false,accept=false;const warnings=[];
  device=makeDevice(server,{}, {confirm:message=>{warnings.push(message);if(mutate)device.exec("S.jobs.j1.service='changed during confirmation'");return accept}});
  try{
    await device.login();device.exec("tab='Estimates';render();openBulkDeletion('estimates')");selectBulk(device,'e1');selectBulk(device,'e2');
    device.exec('deleteBulkSelected()');assert.match(warnings.at(-1),/Delete 2 selected saved estimates/);assert.match(warnings.at(-1),/2 linked jobs.*remain unchanged/);
    assert.equal(device.exec('Object.keys(S.estimates).length'),3);
    accept=true;mutate=true;device.exec('deleteBulkSelected()');assert.match(device.element('#bulk_status').textContent,/changed.*select again/i);
    assert.equal(device.exec('Object.keys(pending).length'),0);assert.equal(device.exec('Object.keys(S.estimates).length'),3);
    mutate=false;device.exec("openBulkDeletion('estimates')");selectBulk(device,'e1');selectBulk(device,'e2');
    device.exec('deleteBulkSelected()');await wait(120);
    assert.equal(server.rows.has('estimates/e1'),false);assert.equal(server.rows.has('estimates/e2'),false);assert.equal(server.rows.has('estimates/e3'),true);
    assert.equal(server.rows.has('jobs/j1'),true);assert.equal(server.rows.has('jobs/j2'),true);assert.equal(server.photoObjects.size,1);
  }finally{device.dispose()}
});

test('bulk deletion refuses unsynced state and a selection changed during confirmation', async () => {
  const server=new FakeServer();seedPrice(server,'clients',record('Fictional Client','c1'));
  for(const id of ['1','2'])seedPrice(server,'jobs',{id:'j'+id,client:'c1',status:'Done',service:'Work '+id,date:'2026-10-0'+id});
  let device,mutateSelection=true,confirms=0;const alerts=[];
  device=makeDevice(server,{}, {alert:message=>alerts.push(message),confirm:()=>{confirms++;if(mutateSelection)device.exec("bulkDeletion.selected.add('j2')");return true}});
  try{
    device.exec("openBulkDeletion('jobs')");assert.match(alerts.at(-1),/Synced across devices/);
    await device.login();device.exec("openBulkDeletion('jobs')");selectBulk(device,'j1');device.exec('deleteBulkSelected()');
    assert.match(device.element('#bulk_status').textContent,/selection changed/i);assert.equal(device.exec('Object.keys(S.jobs).length'),2);assert.equal(device.exec('Object.keys(pending).length'),0);
    mutateSelection=false;device.exec("openBulkDeletion('jobs')");selectBulk(device,'j1');device.exec('hasSnapshot=false;head();deleteBulkSelected()');
    assert.match(device.element('#bulk_status').textContent,/Synced across devices/);assert.equal(confirms,1);
    assert.equal(device.exec('Object.keys(S.jobs).length'),2);assert.equal(server.rows.size,3);
  }finally{device.dispose()}
});

test('bulk client deletion retries a partial batch without restoring deleted jobs, estimates or clients', async () => {
  const server=new FakeServer();
  for(const id of ['1','2']){
    seedPrice(server,'clients',record('Fictional '+id,'c'+id));
    seedPrice(server,'jobs',{id:'j'+id,client:'c'+id,status:'Done',service:'Work '+id,date:'2026-10-0'+id});
    seedPrice(server,'estimates',priceEstimate('e'+id,'c'+id,'Fictional '+id));
  }
  server.photoObjects.set('jobs/j1/after/fictional.jpg','fictional');
  const originalBroadcast=server.broadcast.bind(server);let deletes=0;
  server.broadcast=event=>{originalBroadcast(event);if(event.eventType==='DELETE'&&++deletes===1)server.failWrites=true};
  const first=makeDevice(server,{}, {confirm:()=>true}),second=makeDevice(server);
  try{
    await Promise.all([first.login(),second.login()]);first.exec("openBulkDeletion('clients');bulkSelectShown()");
    first.element('#bulk_estimate_choice').value='delete';first.exec('deleteBulkSelected()');await wait(80);
    assert.equal(deletes,1);assert.equal(server.rows.size,5);assert.equal(first.exec('Object.keys(pending).length'),5);
    assert.equal(first.exec('Object.keys(S.clients).length+Object.keys(S.jobs).length+Object.keys(S.estimates).length'),0);
    assert.notEqual(first.element('#st').textContent,'Synced across devices');
    server.failWrites=false;server.broadcast=originalBroadcast;first.client.reconnect();await wait(180);
    assert.equal(server.rows.size,0);assert.equal(first.exec('Object.keys(pending).length'),0);
    assert.equal(second.exec('Object.keys(S.clients).length+Object.keys(S.jobs).length+Object.keys(S.estimates).length'),0);
    assert.equal(server.photoObjects.size,1);assert.equal(first.element('#st').textContent,'Synced across devices');
  }finally{first.dispose();second.dispose()}
});

test('bulk clients with malformed linked records are disabled without preventing safe selections', async () => {
  const server=new FakeServer();seedPrice(server,'clients',record('Needs review','c1'));seedPrice(server,'clients',record('Safe client','c2'));
  server.rows.set('jobs/bad',{coll:'jobs',id:'bad',data:{id:'wrong',client:'c1',status:'Done',service:'Malformed linked job',date:'2026-10-01'}});
  const device=makeDevice(server,{}, {confirm:()=>true});
  try{
    await device.login();device.exec("openBulkDeletion('clients');bulkSelectShown()");
    assert.equal(device.exec("bulkDeletion.candidates.find(c=>c.id==='c1').valid"),false);
    assert.equal(device.exec("bulkDeletion.candidates.find(c=>c.id==='c2').valid"),true);
    assert.equal(device.exec('bulkDeletion.selected.size'),1);assert.match(device.element('#bulk_list').innerHTML,/disabled/);
    device.exec('deleteBulkSelected()');await wait(100);
    assert.ok(device.exec('S.clients.c1 && S.jobs.bad'));assert.equal(device.exec('S.clients.c2'),undefined);
    assert.equal(server.rows.has('clients/c1'),true);assert.equal(server.rows.has('jobs/bad'),true);assert.equal(server.rows.has('clients/c2'),false);
  }finally{device.dispose()}
});

test('bulk pickers show identifying details so similarly named records can be reviewed safely', async () => {
  const server=new FakeServer();
  seedPrice(server,'clients',{...record('Same Name','c1'),props:'111 Fictional Road',phone:'555-0101'});
  seedPrice(server,'clients',{...record('Same Name','c2'),props:'222 Fictional Road',phone:'555-0102'});
  seedPrice(server,'jobs',{id:'j1',client:'c1',service:'Mow',status:'Done',date:'2026-10-01',price:11});
  seedPrice(server,'jobs',{id:'j2',client:'c2',service:'Mow',status:'Done',date:'2026-10-01',price:22});
  seedPrice(server,'estimates',priceEstimate('e1','c1','Same Name'));
  const e2=priceEstimate('e2','c2','Same Name');e2.lines[0].unitCents=9900;e2.totalCents=9900;seedPrice(server,'estimates',e2);
  const warnings=[],device=makeDevice(server,{}, {confirm:message=>{warnings.push(message);return false}});
  try{
    await device.login();device.exec("openBulkDeletion('clients')");
    assert.match(device.element('#bulk_list').innerHTML,/111 Fictional Road/);assert.match(device.element('#bulk_list').innerHTML,/222 Fictional Road/);
    assert.match(device.element('#bulk_list').innerHTML,/555-0101/);selectBulk(device,'c1');device.element('#bulk_estimate_choice').value='keep';device.exec('deleteBulkSelected()');
    assert.match(warnings.at(-1),/Selected details:[\s\S]*111 Fictional Road/);
    device.exec("openBulkDeletion('jobs')");assert.match(device.element('#bulk_list').innerHTML,/\$11/);assert.match(device.element('#bulk_list').innerHTML,/\$22/);
    device.exec("openBulkDeletion('estimates')");assert.match(device.element('#bulk_list').innerHTML,/\$125\.00/);assert.match(device.element('#bulk_list').innerHTML,/\$99\.00/);
    assert.equal(device.exec('Object.keys(pending).length'),0);
  }finally{device.dispose()}
});

// AppFolio importer state tests use fictional, pre-extracted text and the same
// in-memory outbox as the rest of this suite. No PDF or customer data leaves it.
function fictionalAppfolioEntry(overrides = {}) {
  return { name: 'fictional.pdf', include: true, error: '', managerId: 'c-af1', managerName: 'Fictional Manager One', number: '250-1', location: '100 Example Road, Austin, TX', service: 'Other', date: '', description: 'Fictional work description', details: 'Fictional work order text', pages: 1, pagesWithoutText: 0, ...overrides };
}
function seedAppfolio(server) {
  for (const client of [record('Fictional Manager One', 'c-af1'), record('Fictional Manager Two', 'c-af2')]) {
    client.type = 'Property manager'; server.rows.set(`clients/${client.id}`, { coll: 'clients', id: client.id, data: client });
  }
}
function setupAppfolio(device, entries) {
  device.context.fictionalAppfolioEntries = clone(entries);
  device.exec('openAppfolioImport(); appfolioImport.entries=fictionalAppfolioEntries; appfolioRender()');
}

test('PDF import queues multiple reviewed jobs, keeps unscheduled work off routes, and retries a failed sync', async () => {
  const server = new FakeServer(); seedAppfolio(server);
  server.rows.set('jobs/existing', { coll: 'jobs', id: 'existing', data: { id: 'existing', client: 'c-af1', status: 'Scheduled', date: '2026-11-10', service: 'Other', prop: 'Old fictional address', ord: 4 } });
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    setupAppfolio(first, [fictionalAppfolioEntry(), fictionalAppfolioEntry({ name: 'second.pdf', managerId: 'c-af2', managerName: 'Fictional Manager Two', number: '251-1', date: '2026-11-10' })]);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 1);
    server.failWrites = true; first.exec('appfolioAdd()'); await wait(45);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 3); assert.equal(first.exec('Object.keys(pending).length'), 2);
    assert.equal(second.exec('Object.keys(S.jobs).length'), 1);
    assert.notEqual(first.element('#st').textContent, 'Synced across devices');
    const saved = clone(first.exec('Object.values(S.jobs).filter(j=>j.sourceAppfolio)'));
    const unscheduled = saved.find(j => j.sourceAppfolio.number === '250-1'), scheduled = saved.find(j => j.sourceAppfolio.number === '251-1');
    assert.equal(unscheduled.status, 'Unscheduled'); assert.equal(unscheduled.date, ''); assert.equal(unscheduled.price, '');
    assert.equal(unscheduled.workDescription, 'Fictional work description'); assert.equal(unscheduled.workOrderDetails, 'Fictional work order text');
    assert.equal(scheduled.status, 'Scheduled'); assert.equal(scheduled.ord, 5);
    assert.equal(first.exec("pickCandidates().some(c=>c.record.id===" + JSON.stringify(unscheduled.id) + ")"), false);
    assert.equal(first.exec("!!appfolioDuplicate('c-af1','#250-1')"), true);
    assert.match(first.storage.get('mib_pending_v1'), /Fictional work description/);
    server.failWrites = false; first.client.reconnect(); await wait(220);
    assert.equal(second.exec('Object.keys(S.jobs).length'), 3);
    assert.equal(first.element('#st').textContent, 'Synced across devices');
    assert.equal(second.exec("Object.values(S.jobs).filter(j=>j.sourceAppfolio&&j.status==='Unscheduled').length"), 1);
  } finally { first.dispose(); second.dispose(); }
});

test('PDF import rejects duplicates, missing fields, invalid dates and oversized details without writes', async () => {
  const server = new FakeServer(); seedAppfolio(server); const device = makeDevice(server, {}, { confirm: () => true });
  try {
    await device.login();
    setupAppfolio(device, [fictionalAppfolioEntry(), fictionalAppfolioEntry({ name: 'same.pdf', number: '# 250-1' })]);
    device.exec("S.clients['c-af1'].name=' Fictional Manager One '");
    assert.equal(device.exec('appfolioClientName(S.clients["c-af1"].name)'), 'Fictional Manager One');
    device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /same work order number.*twice/i);
    assert.equal(device.exec('Object.keys(S.jobs).length'), 0);
    device.exec("appfolioImport.entries[1].managerId='c-af2';appfolioImport.entries[1].managerName='Fictional Manager Two'");
    assert.equal(device.exec('appfolioPlan(appfolioImport).jobs.length'), 2);
    device.exec("appfolioImport.entries[0].number=''"); device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /Enter a work order number/i);
    device.exec("appfolioImport.entries[0].number='250-1';appfolioImport.entries[0].location=''"); device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /enter the property/i);
    device.exec("appfolioImport.entries[0].location='100 Example Road';appfolioImport.entries[0].date='2026-02-30'"); device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /valid planned date/i);
    device.exec("appfolioImport.entries[0].date='';appfolioImport.entries[0].description='  '"); device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /enter the work description/i);
    device.exec("appfolioImport.entries[0].description='x'.repeat(10001)"); device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /10,000 characters/i);
    device.exec("appfolioImport.entries[0].description='Fictional description';appfolioImport.entries[0].details='x'.repeat(50001)"); device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /50,000 characters/i);
    assert.equal(device.exec('Object.keys(S.jobs).length'), 0); assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('PDF import rechecks clients and duplicates after confirmation, and checks device storage before queueing', async () => {
  const server = new FakeServer(); seedAppfolio(server); let device, action = 'client', approve = true;
  device = makeDevice(server, {}, { confirm: () => {
    if (action === 'client') device.exec("S.clients['c-af1'].name='Changed Fictional Manager'");
    if (action === 'duplicate') device.exec("S.jobs.incoming={id:'incoming',client:'c-af1',sourceAppfolio:{managerId:'c-af1',number:'250-1'}}");
    return approve;
  } });
  try {
    await device.login(); setupAppfolio(device, [fictionalAppfolioEntry()]);
    device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /client changed/i);
    assert.equal(device.exec('Object.keys(S.jobs).length'), 0); assert.equal(device.exec('Object.keys(pending).length'), 0);
    device.exec("S.clients['c-af1'].name='Fictional Manager One'");
    action = 'duplicate'; device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /already imported/i);
    assert.equal(device.exec('Object.keys(pending).length'), 0); device.exec('delete S.jobs.incoming');
    action = 'none'; approve = false; device.exec('appfolioAdd()'); assert.equal(device.exec('Object.keys(S.jobs).length'), 0);
    approve = true; const old = device.context.localStorage.setItem;
    device.context.localStorage.setItem = (k, v) => { if (k.startsWith('mib_import_probe_')) throw new Error('fictional quota'); return old(k, v); };
    device.exec('appfolioAdd()'); assert.match(device.element('#af_status').textContent, /not enough device storage/i);
    assert.equal(device.exec('Object.keys(S.jobs).length'), 0); assert.equal(device.exec('Object.keys(pending).length'), 0);
  } finally { device.dispose(); }
});

test('unscheduled work is not a last service, can have a due date, and a repeat does not reuse the AppFolio identity', async () => {
  const server = new FakeServer(); seedAppfolio(server);
  const client = server.rows.get('clients/c-af1'); client.data.props = '100 Example Road';
  const job = { id: 'j-af', client: 'c-af1', prop: '100 Example Road', service: 'Other', workCategory: 'Tree Trimming', status: 'Unscheduled', date: '', repeat: 'One-time', dateRequirement: 'deadline', requiredDate: '2026-11-03', sourceAppfolio: { managerId: 'c-af1', number: '250-1' }, workDescription: 'Fictional description', workOrderDetails: 'Fictional text', price: '' };
  server.rows.set('jobs/j-af', { coll: 'jobs', id: 'j-af', data: job });
  const device = makeDevice(server);
  try {
    await device.login();
    assert.match(device.exec('vJobs()'), /Unscheduled/);
    assert.match(device.exec('vDue()'), /Not scheduled/);
    assert.match(device.exec('vProps()'), /Last service: —/);
    assert.equal(device.exec("pickCandidates().some(c=>c.record.id==='j-af')"), false);
    device.exec("S.jobs['j-af'].status='Scheduled';S.jobs['j-af'].date='2026-11-03';S.jobs['j-af'].repeat='Weekly';setStatus('j-af','Done')");
    const next = clone(device.exec("Object.values(S.jobs).find(j=>j.id!=='j-af')"));
    assert.equal(next.date, '2026-11-10'); assert.equal(next.status, 'Scheduled');
    assert.equal(next.sourceAppfolio, undefined); assert.equal(next.workDescription, undefined); assert.equal(next.workOrderDetails, undefined);
    assert.equal(next.workCategory, 'Tree Trimming');
  } finally { device.dispose(); }
});

// Job categories are an explicit, optional label on the existing job record.
// These tests use fictional records and the in-memory server only.
function fillJobForCategory(device, id, category) {
  const job = clone(device.exec(`S.jobs[${JSON.stringify(id)}]`));
  device.exec(`openJob(${JSON.stringify(id)})`);
  const values = {
    j_client: job.client, j_service: job.service, j_prop: job.prop || '',
    j_date: job.date || '', j_rule: job.dateRequirement || 'any', j_required: job.requiredDate || '',
    j_minutes: job.estimatedMinutes == null ? '' : String(job.estimatedMinutes),
    j_status: job.status, j_rep: job.repeat || 'One-time', j_items: job.items || '',
    j_price: job.price == null ? '' : String(job.price), j_notes: job.notes || '', j_category: category,
  };
  Object.entries(values).forEach(([field, value]) => { device.element('#' + field).value = value; });
  device.exec(`saveJob(${JSON.stringify(id)})`);
}

test('legacy jobs remain uncategorized until explicitly assigned, moved or cleared, and sync with backups', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  const oldTrim = { id:'old-trim', client:'c1', service:'Trim / prune', prop:'111 Legacy Trim Example', date:'2026-11-01', status:'Scheduled', repeat:'One-time', price:'', notes:'Fictional original' };
  const oldCleanup = { id:'old-clean', client:'c1', service:'Make-ready cleanup', prop:'222 Legacy Cleanup Example', date:'2026-11-02', status:'Done', repeat:'One-time', price:'' };
  const tree = { id:'tree', client:'c1', service:'Tree Trimming', workCategory:'Tree Trimming', prop:'333 Tree Example', date:'2026-11-03', status:'Scheduled', price:'' };
  const paid = { id:'paid', client:'c1', service:'Maintenance', workCategory:'Maintenance', prop:'444 Paid Example', date:'2026-11-04', status:'Paid', price:'' };
  [oldTrim, oldCleanup, tree, paid].forEach(j => seedPrice(server, 'jobs', j));
  const first = makeDevice(server), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    first.exec("tab='Jobs';jf='All';render()");
    for (const address of ['111 Legacy Trim','222 Legacy Cleanup','333 Tree','444 Paid']) assert.match(first.element('#main').innerHTML, new RegExp(address));
    first.exec("tab='Tree Trimming';render()");
    assert.match(first.element('#main').innerHTML, /333 Tree Example/);
    assert.doesNotMatch(first.element('#main').innerHTML, /111 Legacy Trim|222 Legacy Cleanup|444 Paid/);
    first.exec("tab='Cleaning';render()");
    assert.match(first.element('#main').innerHTML, /No jobs match this category and status/);
    assert.doesNotMatch(first.element('#main').innerHTML, /222 Legacy Cleanup/);
    first.exec("tab='Maintenance';render()");
    assert.doesNotMatch(first.element('#main').innerHTML, /444 Paid Example/);
    first.exec("categoryFilters['Maintenance']='All';render()");
    assert.match(first.element('#main').innerHTML, /444 Paid Example/);
    assert.equal(first.exec('Object.keys(pending).length'), 0);
    assert.deepEqual(server.rows.get('jobs/old-trim').data, oldTrim);
    assert.deepEqual(server.rows.get('jobs/old-clean').data, oldCleanup);

    server.failWrites = true;
    fillJobForCategory(first, 'old-trim', 'Tree Trimming'); await wait(45);
    assert.equal(first.exec("S.jobs['old-trim'].workCategory"), 'Tree Trimming');
    assert.equal(first.exec("S.jobs['old-trim'].service"), 'Trim / prune');
    assert.equal(first.exec("S.jobs['old-trim'].notes"), 'Fictional original');
    assert.equal(second.exec("S.jobs['old-trim'].workCategory"), undefined);
    assert.match(first.storage.get('mib_pending_v1'), /Tree Trimming/);
    first.exec('openBackup()'); assert.match(first.element('#dlg').innerHTML, /workCategory.*Tree Trimming/);
    server.failWrites = false; first.client.reconnect(); await wait(150);
    assert.equal(second.exec("S.jobs['old-trim'].workCategory"), 'Tree Trimming');
    assert.equal(second.exec("S.jobs['old-trim'].service"), 'Trim / prune');
    assert.equal(first.element('#st').textContent, 'Synced across devices');

    fillJobForCategory(first, 'old-trim', 'Cleaning'); await wait(120);
    assert.equal(second.exec("S.jobs['old-trim'].workCategory"), 'Cleaning');
    assert.doesNotMatch(first.exec("vJobs('Tree Trimming')"), /111 Legacy Trim Example/);
    assert.match(first.exec("vJobs('Cleaning')"), /111 Legacy Trim Example/);
    fillJobForCategory(first, 'old-trim', ''); await wait(120);
    assert.equal(second.exec("S.jobs['old-trim'].workCategory"), undefined);
    assert.match(first.exec('vJobs()'), /111 Legacy Trim Example/);
    assert.doesNotMatch(first.exec("vJobs('Cleaning')"), /111 Legacy Trim Example/);
    assert.equal(first.exec("S.jobs['old-clean'].workCategory"), undefined);
  } finally { first.dispose(); second.dispose(); }
});

test('category bulk deletion stays scoped and rejects a job changed after selection', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1'));
  const jobs = [
    { id:'clean-open', workCategory:'Cleaning', status:'Scheduled', prop:'101 Clean Open' },
    { id:'clean-paid', workCategory:'Cleaning', status:'Paid', prop:'102 Clean Paid' },
    { id:'moving', workCategory:'Cleaning', status:'Done', prop:'103 Moving Job' },
    { id:'tree', workCategory:'Tree Trimming', status:'Scheduled', prop:'104 Tree Job' },
    { id:'legacy', status:'Scheduled', prop:'105 Legacy Job' },
  ];
  jobs.forEach(j => seedPrice(server, 'jobs', { client:'c1', service:'Other', date:'2026-11-01', ...j }));
  const confirmations = [], first = makeDevice(server, {}, { confirm: text => { confirmations.push(text); return true; } }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    first.exec("tab='Cleaning';render();openBulkDeletion('jobs','Cleaning')");
    assert.match(first.element('#dlg').innerHTML, /Only Cleaning jobs are selectable here/);
    assert.equal(first.exec('bulkDeletion.candidates.length'), 3);
    assert.equal(first.exec('bulkDeletion.initialFilter'), 'Open');
    first.exec('bulkSelectShown()'); assert.equal(first.exec('bulkDeletion.selected.size'), 2);
    first.element('#bulk_filter').value = 'All'; first.exec('bulkFilter();bulkSelectShown()');
    assert.equal(first.exec('bulkDeletion.selected.size'), 3);
    assert.equal(first.exec("bulkDeletion.selected.has('tree') || bulkDeletion.selected.has('legacy')"), false);
    second.exec("w('jobs',Object.assign({},S.jobs.moving,{workCategory:'Maintenance'}))"); await wait(130);
    first.exec('deleteBulkSelected()');
    assert.match(first.element('#bulk_status').textContent, /changed.*close and select again/i);
    assert.ok(first.exec('S.jobs["clean-open"] && S.jobs["clean-paid"] && S.jobs.moving'));
    assert.equal(confirmations.length, 0);

    first.exec("categoryFilters['Cleaning']='All';openBulkDeletion('jobs','Cleaning');bulkSelectShown()");
    assert.equal(first.exec('bulkDeletion.candidates.length'), 2);
    assert.equal(first.exec('bulkDeletion.selected.size'), 2);
    first.exec('deleteBulkSelected()'); await wait(150);
    assert.match(confirmations.at(-1), /Delete 2 selected jobs/);
    assert.equal(server.rows.has('jobs/clean-open'), false); assert.equal(server.rows.has('jobs/clean-paid'), false);
    assert.equal(server.rows.get('jobs/moving').data.workCategory, 'Maintenance');
    assert.ok(server.rows.has('jobs/tree') && server.rows.has('jobs/legacy') && server.rows.has('clients/c1'));
  } finally { first.dispose(); second.dispose(); }
});

test('PDF review categories are optional, batch-editable, rechecked and synced without inference', async () => {
  const server = new FakeServer(); seedAppfolio(server); let first, mutate = false;
  first = makeDevice(server, {}, { confirm: () => { if (mutate) first.exec("appfolioImport.entries[0].workCategory='Maintenance'"); return true; } });
  const second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]);
    setupAppfolio(first, [fictionalAppfolioEntry(), fictionalAppfolioEntry({ name:'second.pdf', number:'251-1', service:'Make-ready cleanup', date:'2026-11-10' })]);
    assert.equal(first.exec('appfolioPlan(appfolioImport).jobs[0].workCategory'), '');
    assert.equal(first.exec('appfolioPlan(appfolioImport).jobs[1].workCategory'), '');
    first.element('#af_batch_category').value = 'Cleaning'; first.exec('appfolioApplyCategory()');
    assert.equal(first.exec('appfolioImport.entries[0].workCategory'), 'Cleaning');
    assert.equal(first.exec('appfolioImport.entries[1].workCategory'), 'Cleaning');
    first.exec("appfolioEdit({dataset:{afIndex:'1'},value:'Tree Trimming'},'workCategory')");
    first.exec("appfolioImport.entries[0].workCategory='invalid';appfolioAdd()");
    assert.match(first.element('#af_status').textContent, /valid work category/i);
    assert.equal(first.exec('Object.keys(pending).length'), 0);
    first.exec("appfolioImport.entries[0].workCategory='Cleaning'"); mutate = true; first.exec('appfolioAdd()');
    assert.match(first.element('#af_status').textContent, /selected jobs or CRM changed/i);
    assert.equal(first.exec('Object.keys(S.jobs).length'), 0);
    mutate = false; first.exec("appfolioImport.entries[0].workCategory='Cleaning';appfolioAdd()"); await wait(160);
    const imported = clone(second.exec('Object.values(S.jobs)'));
    assert.equal(imported.find(j => j.sourceAppfolio.number === '250-1').workCategory, 'Cleaning');
    assert.equal(imported.find(j => j.sourceAppfolio.number === '250-1').status, 'Unscheduled');
    assert.equal(imported.find(j => j.sourceAppfolio.number === '251-1').workCategory, 'Tree Trimming');
    assert.equal(imported.find(j => j.sourceAppfolio.number === '251-1').service, 'Make-ready cleanup');
    assert.equal(imported.find(j => j.sourceAppfolio.number === '251-1').status, 'Scheduled');
  } finally { first.dispose(); second.dispose(); }
});

test('address import and scheduling from an estimate preserve explicitly chosen categories', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client', 'c1')); seedPrice(server, 'estimates', priceEstimate('e1'));
  const first = makeDevice(server, {}, { confirm: () => true }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.exec('openImport()');
    for (const [field, value] of Object.entries({ imp_mode:'jobs', imp_client:'c1', imp_format:'address', imp_date:'2026-11-12', imp_service:'Trim / prune', imp_category:'Cleaning', imp_text:'99 Fictional Road' })) first.element('#' + field).value = value;
    first.exec('reviewImport()'); assert.match(first.element('#imp_preview').innerHTML, /Cleaning/);
    first.element('#imp_category').value = 'Maintenance'; first.exec('confirmImport()');
    assert.match(first.element('#imp_status').textContent, /changed.*review/i); assert.equal(first.exec('Object.keys(S.jobs).length'), 0);
    first.exec('reviewImport();confirmImport()'); await wait(120);
    const imported = clone(second.exec('Object.values(S.jobs)[0]'));
    assert.equal(imported.workCategory, 'Maintenance'); assert.equal(imported.service, 'Trim / prune');
    first.exec("scheduleEstimate('e1')");
    first.element('#es_job_date').value = '2026-11-13'; first.element('#es_job_property').value = '100 Fictional Road';
    first.element('#es_job_category').value = 'Tree Trimming'; first.exec('createJobFromEstimate()'); await wait(120);
    const scheduled = clone(second.exec("Object.values(S.jobs).find(j=>j.sourceEstimateId==='e1')"));
    assert.equal(scheduled.workCategory, 'Tree Trimming'); assert.equal(scheduled.service, 'Mow / edge / blow');
    assert.equal(scheduled.price, 125); assert.equal(second.exec('S.estimates.e1.status'), 'Draft');
  } finally { first.dispose(); second.dispose(); }
});

test('weekly planner applies an optional default and a per-job override without sending categories to routing', async () => {
  const server = new FakeServer(), monday = futureMonday(), requests = []; weeklySeed(server, monday);
  const first = makeDevice(server, {}, { confirm: () => true, fetch: weeklyFakeProvider(requests) }), second = makeDevice(server);
  try {
    await Promise.all([first.login(), second.login()]); first.client.auth.getSession = async () => fakeSession();
    first.exec(`openWeekPlanner();weekPlan.setup.monday=${JSON.stringify(monday)};weekPlan.setup.flags=[true,true,true,true,true,false,false];weekPlan.setup.clientId='c-week';weekPlan.setup.workCategory='Cleaning';weekPlan.setup.text='101 Fictional Road, Austin, TX 78701\\n102 Fictional Road, Austin, TX 78701';weekReviewJobs()`);
    assert.equal(first.exec('weekPlan.entries[0].workCategory'), 'Cleaning');
    first.exec("weekEditEntry({dataset:{i:'1'},value:'Maintenance'},'workCategory');weekReviewSharing()");
    await first.exec('weekBegin()'); await first.exec('weekSuggest()');
    assert.equal(first.exec('weekPlan.stage'), 'preview');
    assert.match(first.element('#dlg').innerHTML, /Cleaning/); assert.match(first.element('#dlg').innerHTML, /Maintenance/);
    first.exec('weekSave()'); await wait(180);
    const jobs = clone(second.exec("Object.values(S.jobs).filter(j=>j.id!=='old-week')"));
    assert.equal(jobs.find(j => j.prop.startsWith('101 Fictional')).workCategory, 'Cleaning');
    assert.equal(jobs.find(j => j.prop.startsWith('102 Fictional')).workCategory, 'Maintenance');
    assert.equal(second.exec("S.jobs['old-week'].workCategory"), undefined);
    assert.ok(requests.every(body => !JSON.stringify(body).includes('workCategory')));
  } finally { first.dispose(); second.dispose(); }
});

test('unrecognized future categories are escaped and preserved unless the user explicitly changes them', async () => {
  const server = new FakeServer(); seedPrice(server, 'clients', record('Fictional Client','c1'));
  const future = '<future category>'; seedPrice(server, 'jobs', {id:'future',client:'c1',service:'Other',workCategory:future,prop:'900 Fictional Example',date:'2026-11-12',status:'Scheduled',repeat:'One-time'});
  const alerts=[],device=makeDevice(server,{}, {alert:text=>alerts.push(text)});
  try {
    await device.login(); device.exec("openJob('future')");
    assert.match(device.element('#dlg').innerHTML,/Unrecognized category: &lt;future category&gt;/);
    fillJobForCategory(device,'future',future);await wait(100);
    assert.equal(server.rows.get('jobs/future').data.workCategory,future);
    fillJobForCategory(device,'future','not-an-allowed-category');
    assert.match(alerts.at(-1),/valid work category/i);
    assert.equal(server.rows.get('jobs/future').data.workCategory,future);
    fillJobForCategory(device,'future','Maintenance');await wait(100);
    assert.equal(server.rows.get('jobs/future').data.workCategory,'Maintenance');
  } finally {device.dispose()}
});
