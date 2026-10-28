// Contract tests for the Vercel routing function. All providers and users are
// fictional in-memory fakes; these tests make no network requests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../frontend/lib/crm-route');

const AUTH = 'https://jvmvzfshgcekwocffdtv.supabase.co/auth/v1/user';
const GEO = 'https://api.geocod.io/v2/geocode?limit=3';
const ROUTE = 'https://api.simplerouting.io/vroom/';
const reply = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const authUser = () => reply({ id: 'fictional-user', aud: 'authenticated', role: 'authenticated', is_anonymous: false });
const geoRow = (formatted, lat, lng, accuracy = 1) => ({
  response: { results: [{ formatted_address: formatted, location: { lat, lng }, accuracy, accuracy_type: 'rooftop' }] },
});
const routeReply = ids => reply({ code: 0, unassigned: [], routes: [{ vehicle: 1, steps: [
  { type: 'start' }, ...ids.map(id => ({ type: 'job', id, job: id })), { type: 'end' },
], violations: [] }] });

function harness({ env = { SIMPLEROUTING_API_KEY: 'routing-secret', GEOCODIO_API_KEY: 'geocode-secret' }, respond } = {}) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (respond) return respond(url, options, calls);
    if (url === AUTH) return authUser();
    throw new Error('A real network request is not allowed: ' + url);
  };
  const handler = createHandler({ env, fetch });
  async function request(body, options = {}) {
    const headers = { 'content-type': 'application/json', authorization: 'Bearer fictional.jwt.token', ...options.headers };
    const req = { method: options.method || 'POST', headers, body };
    const res = { headers: {}, code: null, data: null,
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      status(code) { this.code = code; return this; },
      json(data) { this.data = data; return this; },
    };
    await handler(req, res); return res;
  }
  return { calls, request };
}
const validOptimize = {
  action: 'optimize', start: [30, -97], stops: [[30.1, -97.1], [30.2, -97.2], [30.3, -97.3]],
  fixedFirst: false, returnToStart: false,
};

test('method, media type and authentication fail closed without touching providers', async () => {
  const h = harness();
  let r = await h.request(validOptimize, { method: 'GET' });
  assert.equal(r.code, 405); assert.equal(r.headers.allow, 'POST');
  r = await h.request(validOptimize, { headers: { 'content-type': 'text/plain' } });
  assert.equal(r.code, 415);
  r = await h.request(validOptimize, { headers: { authorization: '' } });
  assert.equal(r.code, 401);
  r = await h.request(validOptimize, { headers: { authorization: 'Bearer injected\r\nheader' } });
  assert.equal(r.code, 401); assert.equal(h.calls.length, 0);
  assert.match(r.headers['cache-control'], /no-store/);
  assert.equal(r.headers['access-control-allow-origin'], undefined);
});

test('expired, anonymous, or unverifiable CRM sessions never reach a provider', async () => {
  for (const response of [reply({}, 401), reply({ id: 'x', role: 'anon', aud: 'authenticated' }),
    reply({ id: 'x', role: 'authenticated', aud: 'authenticated', is_anonymous: true }), reply({}, 503)]) {
    const h = harness({ respond: url => { assert.equal(url, AUTH); return response; } });
    const r = await h.request(validOptimize);
    assert.ok([401, 503].includes(r.code)); assert.equal(h.calls.length, 1);
  }
  const h = harness({ respond() { throw new Error('network unavailable'); } });
  assert.equal((await h.request(validOptimize)).code, 503);
  assert.equal(h.calls.length, 1);
});

test('configuration is checked before any address or GPS coordinates leave the server', async () => {
  for (const env of [{}, { SIMPLEROUTING_API_KEY: 'only-one' }, { GEOCODIO_API_KEY: 'only-one' }]) {
    const h = harness({ env });
    const r = await h.request({ action: 'geocode', addresses: ['101 Example Road, Austin, TX 78701'] });
    assert.equal(r.code, 503); assert.equal(h.calls.length, 1);
    assert.doesNotMatch(JSON.stringify(r.data), /only-one/);
  }
  const h = harness({ env: {} });
  assert.equal((await h.request(validOptimize)).code, 503);
  assert.equal(h.calls.length, 1);
});

test('geocoding uses a batch of only addresses, header-only key, and returns reviewable matches', async () => {
  const h = harness({ respond(url, options) {
    if (url === AUTH) {
      assert.equal(options.headers.Authorization, 'Bearer fictional.jwt.token');
      return authUser();
    }
    assert.equal(url, GEO); assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer geocode-secret');
    assert.deepEqual(JSON.parse(options.body), ['101 Example Road, Austin, TX 78701', '202 Example Road, Austin, TX 78702']);
    return reply({ results: [geoRow('101 Example Rd, Austin, TX 78701', 30.1, -97.1),
      { response: { results: [] } }] });
  } });
  const r = await h.request({ action: 'geocode', addresses: ['101 Example Road, Austin, TX 78701', '202 Example Road, Austin, TX 78702'] });
  assert.equal(r.code, 200); assert.equal(h.calls.length, 2);
  assert.deepEqual(r.data.matches[0].location, [30.1, -97.1]);
  assert.equal(r.data.matches[0].formatted, '101 Example Rd, Austin, TX 78701');
  assert.equal(r.data.matches[1].location, null);
  assert.doesNotMatch(JSON.stringify(r.data), /secret/);
});

test('geocoder marks similarly scored alternatives and rejects malformed or incomplete responses', async () => {
  const h = harness({ respond(url) {
    if (url === AUTH) return authUser();
    const row = geoRow('101 Example Rd, Austin, TX 78701', 30.1, -97.1, 0.93);
    row.response.results.push({ formatted_address: '101 Example Rd, Round Rock, TX 78664', location: { lat: 30.5, lng: -97.6 }, accuracy: 0.92 });
    return reply({ results: [row] });
  } });
  let r = await h.request({ action: 'geocode', addresses: ['101 Example Road'] });
  assert.equal(r.code, 200); assert.equal(r.data.matches[0].ambiguous, true);
  const incomplete = harness({ respond: url => url === AUTH ? authUser() : reply({ results: [] }) });
  r = await incomplete.request({ action: 'geocode', addresses: ['101 Example Road'] });
  assert.equal(r.code, 502); assert.match(r.data.error, /incomplete/);
});

test('GPS optimization sends only longitude/latitude jobs and preserves all job indices', async () => {
  const h = harness({ respond(url, options) {
    if (url === AUTH) return authUser();
    assert.equal(url, ROUTE); assert.equal(options.headers.Authorization, 'Bearer routing-secret');
    assert.deepEqual(JSON.parse(options.body), {
      vehicles: [{ id: 1, start: [-97, 30] }],
      jobs: [{ id: 1, location: [-97.1, 30.1] }, { id: 2, location: [-97.2, 30.2] }, { id: 3, location: [-97.3, 30.3] }],
    });
    return routeReply([2, 3, 1]);
  } });
  const r = await h.request(validOptimize);
  assert.equal(r.code, 200); assert.deepEqual(r.data.order, [1, 2, 0]);
  assert.equal(h.calls.length, 2); assert.doesNotMatch(JSON.stringify(r.data), /secret/);
});

test('return-to-start and an anchored first stop are translated correctly', async () => {
  let input;
  const h = harness({ respond(url, options) {
    if (url === AUTH) return authUser();
    input = JSON.parse(options.body); return routeReply(input.jobs.map(j => j.id).reverse());
  } });
  let r = await h.request({ ...validOptimize, returnToStart: true });
  assert.equal(r.code, 200); assert.deepEqual(input.vehicles[0].end, [-97, 30]);
  r = await h.request({ ...validOptimize, start: validOptimize.stops[0], fixedFirst: true });
  assert.equal(r.code, 200); assert.equal(input.vehicles[0].end, undefined);
  assert.deepEqual(input.jobs.map(j => j.id), [2, 3]); assert.deepEqual(r.data.order, [0, 2, 1]);
});

test('invalid input, unexpected fields and oversized requests never consume provider quota', async () => {
  const invalid = [
    { ...validOptimize, stops: [[91, 0], [30, -97]] },
    { ...validOptimize, stops: [[30, 181], [30, -97]] },
    { ...validOptimize, stops: [[30, -97]] },
    { ...validOptimize, stops: Array.from({ length: 101 }, () => [30, -97]) },
    { ...validOptimize, fixedFirst: true },
    { ...validOptimize, fixedFirst: true, start: validOptimize.stops[0], returnToStart: true },
    { ...validOptimize, providerUrl: 'https://evil.example' },
    { action: 'geocode', addresses: ['101 Example Road\nsecret'] },
    { action: 'geocode', addresses: Array.from({ length: 102 }, () => '101 Example Road') },
    { action: 'geocode', addresses: ['x'.repeat(501)] },
    { action: 'geocode', addresses: ['101 Example Road'], notes: 'not allowed' },
    { action: 'anything-else' },
  ];
  for (const body of invalid) {
    const h = harness(); const r = await h.request(body);
    assert.equal(r.code, 400, JSON.stringify(body).slice(0, 120)); assert.equal(h.calls.length, 1);
  }
  const h = harness();
  const r = await h.request(validOptimize, { headers: { 'content-length': '999999' } });
  assert.equal(r.code, 413); assert.equal(h.calls.length, 1);
});

test('partial, duplicate, unknown, or malformed routes are never returned as a saveable order', async () => {
  const cases = [
    { code: 0, unassigned: [{ id: 1 }], routes: [{ vehicle: 1, steps: [] }] },
    { code: 0, unassigned: [], routes: [{ vehicle: 1, steps: [{ type: 'job', id: 1 }, { type: 'job', id: 1 }, { type: 'job', id: 3 }] }] },
    { code: 0, unassigned: [], routes: [{ vehicle: 1, steps: [{ type: 'job', id: 1 }, { type: 'job', id: 2 }, { type: 'job', id: 999 }] }] },
    { code: 0, unassigned: [], routes: [{ vehicle: 1, steps: [{ type: 'job', id: 1 }, { type: 'job', id: 2 }] }] },
    { code: 0, unassigned: [], routes: [{ vehicle: 1, steps: [{ type: 'job', id: 1, job: 2 }, { type: 'job', id: 2 }, { type: 'job', id: 3 }] }] },
    { code: 0, unassigned: [], routes: [{ vehicle: 1, steps: [{ type: 'delivery', id: 1 }] }] },
    { code: 0, unassigned: [], routes: [{ vehicle: 2, steps: [] }] },
  ];
  for (const bad of cases) {
    const h = harness({ respond: url => url === AUTH ? authUser() : reply(bad) });
    const r = await h.request(validOptimize);
    assert.ok([422, 502].includes(r.code)); assert.equal(r.data.order, undefined);
  }
});

test('provider quota, authorization, malformed JSON and network failures are reported without secrets', async () => {
  for (const [providerReply, expected] of [
    [reply({ error: 'raw provider detail' }, 429), 429],
    [reply({ error: 'routing-secret' }, 401), 503],
    [{ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }, 502],
  ]) {
    const h = harness({ respond: url => url === AUTH ? authUser() : providerReply });
    const r = await h.request(validOptimize);
    assert.equal(r.code, expected); assert.doesNotMatch(JSON.stringify(r.data), /routing-secret|raw provider detail/);
  }
  const h = harness({ respond: url => { if (url === AUTH) return authUser(); throw new Error('secret leak'); } });
  const r = await h.request(validOptimize);
  assert.equal(r.code, 503); assert.doesNotMatch(JSON.stringify(r.data), /secret leak/);
});
