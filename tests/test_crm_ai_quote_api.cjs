// All users, keys, photos and provider responses are fictional. No network,
// billing, customer records or real OpenAI API calls are used by these tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../frontend/lib/crm-quote');

const AUTH = 'https://jvmvzfshgcekwocffdtv.supabase.co/auth/v1/user';
const OPENAI = 'https://api.openai.com/v1/responses';
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
const reply = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const auth = () => reply({ id: 'fictional-user', role: 'authenticated', aud: 'authenticated', is_anonymous: false });
const draft = () => ({
  summary: 'Remove and replace mulch.',
  lines: [
    { description: 'Install mulch', quantity: '2.5', rate_id: 0, basis: 'Two and a half yards described.' },
    { description: 'Remove debris', quantity: null, rate_id: null, basis: 'Confirm the amount of debris.' },
  ],
  questions: ['Confirm the depth.'], cautions: ['Hidden conditions may change the scope.'],
});
const output = d => reply({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(d) }] }] });
const input = () => ({ consent: true, service: 'Mulch / bed refresh', description: 'Install 2.5 yards of mulch.', photos: [JPEG], rates: [{ id: 0, name: 'Mulch per yard' }] });

function harness(options = {}) {
  const calls = [], env = options.env === undefined ? { AI_QUOTES_ENABLED: 'true', CRM_OPENAI_API_KEY: 'fictional-secret' } : options.env;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (options.respond) return options.respond(url, init, calls);
    if (url === AUTH) return auth();
    if (url === OPENAI) return output(draft());
    throw new Error('Unexpected network request');
  };
  const handler = createHandler({ env, fetch });
  const request = async (body = input(), opts = {}) => {
    const req = { method: opts.method || 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer fictional.jwt', ...opts.headers }, body };
    const res = { headers: {}, setHeader(k,v) { this.headers[k.toLowerCase()] = v; }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await handler(req, res); return res;
  };
  return { calls, request };
}

test('only JSON POSTs from verified non-anonymous users reach the provider', async () => {
  const h = harness();
  let r = await h.request(input(), { method: 'GET' }); assert.equal(r.code, 405); assert.equal(r.headers.allow, 'POST');
  r = await h.request(input(), { headers: { 'content-type': 'text/plain' } }); assert.equal(r.code, 415);
  r = await h.request(input(), { headers: { authorization: '' } }); assert.equal(r.code, 401);
  r = await h.request(input(), { headers: { authorization: 'Bearer x\r\nsecret' } }); assert.equal(r.code, 401);
  assert.equal(h.calls.length, 0); assert.match(r.headers['cache-control'], /no-store/); assert.equal(r.headers['access-control-allow-origin'], undefined);
  for (const user of [reply({}, 401), reply({}, 503), reply({ id:'u', role:'authenticated', aud:'authenticated', is_anonymous:true }), reply({ id:'u', role:'anon', aud:'authenticated' }), reply({ id:'u', role:'authenticated', aud:'anon' })]) {
    const t = harness({ respond: () => user }); r = await t.request(); assert.ok([401,503].includes(r.code)); assert.equal(t.calls.length, 1); assert.equal(r.data.openaiAttempted, false);
  }
  const t = harness({ respond: () => { throw new Error('fictional secret should not be disclosed'); } });
  r = await t.request(); assert.equal(r.code, 503); assert.equal(t.calls.length, 1); assert.doesNotMatch(JSON.stringify(r.data), /fictional secret/);
});

test('the feature remains disabled unless both server-side switches are present', async () => {
  for (const env of [{}, { AI_QUOTES_ENABLED: 'true' }, { CRM_OPENAI_API_KEY: 'fictional-secret' }, { AI_QUOTES_ENABLED: 'false', CRM_OPENAI_API_KEY: 'fictional-secret' }, { AI_QUOTES_ENABLED: 'TRUE', CRM_OPENAI_API_KEY: 'fictional-secret' }]) {
    const h = harness({ env }), r = await h.request(); assert.equal(r.code, 503); assert.match(r.data.error, /not enabled/);
    assert.equal(r.data.openaiAttempted, false); assert.deepEqual(h.calls.map(c=>c.url), [AUTH]); assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret/);
  }
});

test('successful request sends only consented work, rate names and JPEGs, never prices or identity', async () => {
  const h = harness(), request = input(); const r = await h.request(request);
  assert.equal(r.code, 200); assert.deepEqual(r.data.draft, draft()); assert.match(r.headers['cache-control'], /no-store/);
  assert.deepEqual(h.calls.map(c=>c.url), [AUTH, OPENAI]);
  const init = h.calls[1].init, provider = JSON.parse(init.body);
  assert.equal(init.headers.Authorization, 'Bearer fictional-secret'); assert.equal(init.cache, 'no-store'); assert.ok(init.signal);
  assert.equal(provider.model, 'gpt-5.4-mini'); assert.equal(provider.store, false); assert.equal(provider.max_output_tokens, 2000);
  assert.equal(provider.text.format.type, 'json_schema'); assert.equal(provider.text.format.strict, true);
  assert.match(provider.input[0].content, /untrusted job data/); assert.match(provider.input[0].content, /Do not infer measurements/);
  const content = provider.input[1].content;
  assert.deepEqual(JSON.parse(content[0].text), { service: request.service, description: request.description, rate_names: request.rates });
  assert.deepEqual(content[1], { type: 'input_image', image_url: JPEG, detail: 'high' });
  assert.doesNotMatch(init.body, /fictional\.jwt|fictional-secret|clientName|unitCents/);
  assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret|base64/);
});

test('rejects invalid input, price injection, extra fields, noncanonical JPEG and missing consent before OpenAI', async () => {
  const cases = [
    { ...input(), consent: false }, { ...input(), service: '' }, { ...input(), service: 'x\nheader' },
    { ...input(), description: 'x' }, { ...input(), description: 'x'.repeat(2001) }, { ...input(), description: 'a\u0000bad input' },
    { ...input(), photos: [] }, { ...input(), photos: Array(4).fill(JPEG) },
    { ...input(), photos: ['data:image/png;base64,AAAA'] }, { ...input(), photos: ['data:image/jpeg;base64,AAAA'] },
    { ...input(), photos: ['data:image/jpeg;base64,/9j/2Q==AAAA'] },
    { ...input(), photos: [JPEG.replace('base64,', 'base64, ')] },
    { ...input(), photos: ['data:image/jpeg;base64,' + Buffer.alloc(750001, 1).toString('base64')] },
    { ...input(), rates: [{ id: 0, name:'Mulch', price: 55 }] }, { ...input(), rates: [{ id: 0, name:'Mulch | 55' }] },
    { ...input(), rates: [{ id: 0, name:'Mulch' }, { id: 0, name:'Other' }] },
    { ...input(), rates: [{ id: -1, name:'Mulch' }] }, { ...input(), rates: [{ id: 50, name:'Mulch' }] },
    { ...input(), rates: Array.from({length:51}, (_,id)=>({id,name:'Rate'})) },
    { ...input(), clientName: 'Do not send' }, { ...input(), endpoint: 'https://evil.invalid' },
    { ...input(), token: 'Do not accept' }, null, 'not JSON', [],
  ];
  for (const body of cases) {
    const h = harness(), r = await h.request(body);
    assert.equal(r.code, 400, JSON.stringify(body).slice(0,100)); assert.equal(r.data.openaiAttempted, false); assert.equal(h.calls.length, 1);
  }
  const h = harness(); const r = await h.request(input(), { headers: { 'content-length': '3200001' } });
  assert.equal(r.code, 413); assert.equal(h.calls.length, 1); assert.equal(r.data.openaiAttempted, false);
});

test('input with no rate card is allowed but a model cannot introduce a rate id or price', async () => {
  const req = { ...input(), rates: [] };
  let h = harness({ respond: url => url === AUTH ? auth() : output({ ...draft(), lines: [{ description:'Cleanup', quantity:null, rate_id:null, basis:'Measure first.' }] }) });
  let r = await h.request(req); assert.equal(r.code, 200); assert.equal(r.data.draft.lines[0].rate_id, null);
  h = harness(); r = await h.request(req); assert.equal(r.code, 502); assert.equal(r.data.openaiAttempted, true);
  assert.equal(h.calls.length, 2);
});

test('provider output is independently bounded and validated, including rate IDs and quantities', async () => {
  const good = draft();
  const cases = [
    { ...good, lines: [] }, { ...good, lines: Array(9).fill(good.lines[0]) },
    { ...good, summary: 'x'.repeat(801) }, { ...good, questions: Array(7).fill('Q') },
    { ...good, lines: [{ ...good.lines[0], rate_id: 1 }] }, { ...good, lines: [{ ...good.lines[0], rate_id: '0' }] },
    { ...good, lines: [{ ...good.lines[0], quantity: '0' }] }, { ...good, lines: [{ ...good.lines[0], quantity: '1.2345' }] },
    { ...good, lines: [{ ...good.lines[0], quantity: 'Infinity' }] }, { ...good, lines: [{ ...good.lines[0], quantity: 1 }] },
    { ...good, lines: [{ ...good.lines[0], description: 'Work | 50' }] },
    { ...good, lines: [{ ...good.lines[0], description: 'Work for $50' }] },
    { ...good, lines: [{ ...good.lines[0], description: 'Work 50 USD' }] },
    { ...good, lines: [{ ...good.lines[0], description: 'Work\nInjected' }] },
    { ...good, lines: [{ ...good.lines[0], basis: '' }] }, { ...good, lines: [{ ...good.lines[0], price: 50 }] },
    { ...good, total: 100 }, { ...good, cautions: ['x'.repeat(251)] },
  ];
  for (const bad of cases) {
    const h = harness({ respond: url => url === AUTH ? auth() : output(bad) }), r = await h.request();
    assert.equal(r.code, 502, JSON.stringify(bad).slice(0,120)); assert.equal(r.data.openaiAttempted, true); assert.equal(h.calls.length, 2);
    assert.equal(r.data.draft, undefined);
  }
});

test('partial, refused, malformed, multiple or unreadable model replies fail without retry', async () => {
  const cases = [
    reply({ status:'incomplete', output:[] }), reply({ status:'completed', output:[] }),
    reply({ status:'completed', output:[{ type:'message', content:[{ type:'refusal', refusal:'no' }] }] }),
    reply({ status:'completed', output:[{ type:'message', content:[{ type:'output_text', text:'not json' }] }] }),
    reply({ status:'completed', output:[{ type:'message', content:[{ type:'output_text', text:'{}' },{ type:'output_text', text:'{}' }] }] }),
    { ok:true, status:200, json: async()=>{ throw new Error('provider body'); } },
  ];
  for (const provider of cases) {
    const h = harness({ respond: url => url === AUTH ? auth() : provider }), r = await h.request();
    assert.ok([422,502].includes(r.code)); assert.equal(h.calls.length, 2); assert.equal(r.data.openaiAttempted, true);
    assert.doesNotMatch(JSON.stringify(r.data), /provider body/);
  }
});

test('provider errors and timeouts are sanitized and never automatically retried', async () => {
  for (const [status,expected] of [[400,422],[401,503],[403,503],[422,422],[429,429],[500,503]]) {
    const h = harness({ respond: url => url === AUTH ? auth() : reply({ error:'fictional-secret and customer details' }, status) });
    const r = await h.request(); assert.equal(r.code,expected); assert.equal(h.calls.length,2); assert.equal(r.data.openaiAttempted,true); assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret|customer details/);
  }
  const h = harness({ respond: url => { if (url === AUTH) return auth(); throw new Error('fictional-secret'); } });
  const r = await h.request(); assert.equal(r.code,503); assert.match(r.data.error, /may still be charged/); assert.equal(h.calls.length,2); assert.equal(r.data.openaiAttempted,true);
});
