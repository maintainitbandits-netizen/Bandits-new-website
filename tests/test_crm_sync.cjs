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

function makeDevice(server, initialStorage = {}) {
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
    navigator: {}, location: { reload() {} },
    supabase: { createClient: () => client },
    alert() {}, confirm: () => false,
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
