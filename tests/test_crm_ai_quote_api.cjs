// All users, tokens, photos and provider responses are fictional. These tests
// intercept every request: no live CRM, Cloudflare, billing, or customer data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../frontend/lib/crm-quote');

const AUTH = 'https://jvmvzfshgcekwocffdtv.supabase.co/auth/v1/user';
const ACCOUNT = 'a1'.repeat(16);
const CLOUDFLARE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run/@cf/google/gemma-4-26b-a4b-it`;
const ENV = { AI_QUOTES_ENABLED: 'true', CRM_AI_FREE_PLAN_CONFIRMED: 'true', CRM_CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CRM_CLOUDFLARE_AI_TOKEN: 'fictional-secret' };
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
const choice = (content, finish_reason = 'stop') => ({ finish_reason, message: { role: 'assistant', content, refusal: null } });
const output = d => reply({ success: true, errors: [], result: { choices: [choice(JSON.stringify(d))] } });
const input = () => ({ consent: true, service: 'Mulch / bed refresh', description: 'Install 2.5 yards of mulch.', photos: [JPEG], rates: [{ id: 0, name: 'Mulch per yard' }] });

function harness(options = {}) {
  const calls = [], env = options.env === undefined ? ENV : options.env;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (options.respond) return options.respond(url, init, calls);
    if (url === AUTH) return auth();
    if (url === CLOUDFLARE) return output(draft());
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
    const t = harness({ respond: () => user }); r = await t.request(); assert.ok([401,503].includes(r.code)); assert.equal(t.calls.length, 1); assert.equal(r.data.providerAttempted, false);
  }
  const t = harness({ respond: () => { throw new Error('fictional secret should not be disclosed'); } });
  r = await t.request(); assert.equal(r.code, 503); assert.equal(t.calls.length, 1); assert.doesNotMatch(JSON.stringify(r.data), /fictional secret/);
});

test('disabled unless enabled, the owner confirms Free, and a valid account and token are configured', async () => {
  const cases = [
    {}, { AI_QUOTES_ENABLED: 'true' },
    { AI_QUOTES_ENABLED:'true', CRM_OPENAI_API_KEY:'fictional-secret' },
    { ...ENV, AI_QUOTES_ENABLED:'false' }, { ...ENV, AI_QUOTES_ENABLED:'TRUE' },
    { ...ENV, CRM_AI_FREE_PLAN_CONFIRMED:undefined }, { ...ENV, CRM_AI_FREE_PLAN_CONFIRMED:'false' }, { ...ENV, CRM_AI_FREE_PLAN_CONFIRMED:'TRUE' },
    { ...ENV, CRM_CLOUDFLARE_ACCOUNT_ID:undefined }, { ...ENV, CRM_CLOUDFLARE_ACCOUNT_ID:'https://evil.invalid' },
    { ...ENV, CRM_CLOUDFLARE_ACCOUNT_ID:ACCOUNT + '/other' }, { ...ENV, CRM_CLOUDFLARE_ACCOUNT_ID:'z'.repeat(32) },
    { ...ENV, CRM_CLOUDFLARE_AI_TOKEN:undefined }, { ...ENV, CRM_CLOUDFLARE_AI_TOKEN:'fictional\r\nsecret' },
  ];
  for (const env of cases) {
    const h = harness({ env }), r = await h.request(); assert.equal(r.code, 503); assert.match(r.data.error, /not enabled/);
    assert.equal(r.data.providerAttempted, false); assert.deepEqual(h.calls.map(c=>c.url), [AUTH]); assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret/);
  }
});

test('only consented work, optional rate names and all three JPEGs go to fixed Workers AI endpoint', async () => {
  const h = harness(), request = { ...input(), photos:[JPEG,JPEG,JPEG] }; const r = await h.request(request);
  assert.equal(r.code, 200); assert.deepEqual(r.data.draft, draft()); assert.match(r.headers['cache-control'], /no-store/);
  assert.deepEqual(h.calls.map(c=>c.url), [AUTH, CLOUDFLARE]);
  const init = h.calls[1].init, provider = JSON.parse(init.body);
  assert.equal(init.method, 'POST'); assert.equal(init.headers.Authorization, 'Bearer fictional-secret'); assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.ok(init.signal);
  assert.equal(provider.store, false); assert.equal(provider.stream, false); assert.equal(provider.max_completion_tokens, 2000);
  assert.deepEqual(provider.response_format, { type:'json_object' }); assert.deepEqual(provider.chat_template_kwargs, { enable_thinking:false });
  assert.match(provider.messages[0].content, /untrusted job data/); assert.match(provider.messages[0].content, /Do not infer measurements/);
  assert.match(provider.messages[0].content, /Return only one JSON object/);
  const content = provider.messages[1].content;
  assert.deepEqual(JSON.parse(content[0].text), { service: request.service, description: request.description, rate_names: request.rates });
  assert.equal(content.length, 4);
  assert.deepEqual(content.slice(1), Array(3).fill({ type:'image_url', image_url:{ url:JPEG, detail:'auto' } }));
  assert.doesNotMatch(init.body, /fictional\.jwt|fictional-secret|clientName|unitCents/);
  assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret|base64/);
});

test('rejects invalid input, price injection, extra fields, noncanonical JPEG and missing consent before Cloudflare', async () => {
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
    assert.equal(r.code, 400, JSON.stringify(body).slice(0,100)); assert.equal(r.data.providerAttempted, false); assert.equal(h.calls.length, 1);
  }
  const h = harness(); const r = await h.request(input(), { headers: { 'content-length': '3200001' } });
  assert.equal(r.code, 413); assert.equal(h.calls.length, 1); assert.equal(r.data.providerAttempted, false);
});

test('input with no rate card is allowed but a model cannot introduce a rate id or price', async () => {
  const req = { ...input(), rates: [] };
  let h = harness({ respond: url => url === AUTH ? auth() : output({ ...draft(), lines: [{ description:'Cleanup', quantity:null, rate_id:null, basis:'Measure first.' }] }) });
  let r = await h.request(req); assert.equal(r.code, 200); assert.equal(r.data.draft.lines[0].rate_id, null);
  h = harness(); r = await h.request(req); assert.equal(r.code, 502); assert.equal(r.data.providerAttempted, true);
  assert.equal(h.calls.length, 2);
});

test('a quantity not numerically present in the work description is cleared for manual entry', async () => {
  const invented = { ...draft(), lines:[{ description:'Remove debris', quantity:'8', rate_id:null, basis:'Eight loads.' }] };
  const h = harness({ respond: url => url === AUTH ? auth() : output(invented) });
  let r = await h.request(); assert.equal(r.code,200); assert.equal(r.data.draft.lines[0].quantity,null);
  assert.match(r.data.draft.lines[0].basis,/not confirmed.*enter it manually/i); assert.doesNotMatch(r.data.draft.lines[0].basis,/Eight loads/);
  const described = { ...draft(), lines:[{ description:'Install mulch', quantity:'2.500', rate_id:0, basis:'Described amount.' }] };
  const t = harness({ respond: url => url === AUTH ? auth() : output(described) });
  r = await t.request(); assert.equal(r.code,200); assert.equal(r.data.draft.lines[0].quantity,'2.500');
  // The matching-number rule is conservative, not proof that a number is the
  // correct unit or scope: every suggested quantity still needs human review.
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
    assert.equal(r.code, 502, JSON.stringify(bad).slice(0,120)); assert.equal(r.data.providerAttempted, true); assert.equal(h.calls.length, 2);
    assert.equal(r.data.draft, undefined);
  }
});

test('accepts documented response envelopes only after validating their complete draft', async () => {
  for (const response of [draft(), JSON.stringify(draft())]) {
    const h = harness({ respond: url => url === AUTH ? auth() : reply({ success:true, result:{ response } }) });
    const r = await h.request(); assert.equal(r.code, 200); assert.deepEqual(r.data.draft,draft()); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,CLOUDFLARE]);
  }
});

test('partial, refused, malformed, multiple or unreadable model replies fail without retry', async () => {
  const cases = [
    reply({ success:false, result:{ choices:[choice(JSON.stringify(draft()))] }, errors:[{ code:123, message:'private' }] }),
    reply({ success:true, result:{ choices:[choice(JSON.stringify(draft()))] }, errors:{ message:'private' } }),
    reply({ success:true, result:{ choices:[] } }),
    reply({ success:true, result:{ choices:[choice(JSON.stringify(draft()), 'length')] } }),
    reply({ success:true, result:{ choices:[{ ...choice(null), message:{role:'assistant',content:null,refusal:'private refusal'} }] } }),
    reply({ success:true, result:{ choices:[choice('not json')] } }),
    reply({ success:true, result:{ choices:[choice(JSON.stringify(draft())),choice(JSON.stringify(draft()))] } }),
    reply({ success:true, result:{ choices:[choice(JSON.stringify(draft()))],response:draft() } }),
    reply({ success:true, result:{ choices:[choice('x'.repeat(20001))] } }),
    reply({ success:true, result:{ response:'not json' } }),
    { ok:true, status:200, json: async()=>{ throw new Error('provider body'); } },
  ];
  for (const provider of cases) {
    const h = harness({ respond: url => url === AUTH ? auth() : provider }), r = await h.request();
    assert.ok([422,502].includes(r.code)); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,CLOUDFLARE]); assert.equal(r.data.providerAttempted, true);
    assert.doesNotMatch(JSON.stringify(r.data), /provider body|private/);
  }
});

test('quota, provider errors and timeouts are sanitized, never retried and never fall back', async () => {
  for (const [status,expected] of [[400,422],[401,503],[403,503],[422,422],[429,429],[500,503]]) {
    const h = harness({ respond: url => url === AUTH ? auth() : reply({ error:'fictional-secret and customer details' }, status) });
    const r = await h.request(); assert.equal(r.code,expected); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,CLOUDFLARE]); assert.equal(r.data.providerAttempted,true); assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret|customer details/);
    if(status===429) assert.match(r.data.error,/allowance or rate limit/);
  }
  const h = harness({ respond: url => { if (url === AUTH) return auth(); throw new Error('fictional-secret'); } });
  const r = await h.request(); assert.equal(r.code,503); assert.match(r.data.error, /may have used some daily allowance/); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,CLOUDFLARE]); assert.equal(r.data.providerAttempted,true);
});
