// All users, tokens, photos and provider responses are fictional. These tests
// intercept every request: no live CRM, Gemini, billing, or customer data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler } = require('../frontend/lib/crm-quote');

const AUTH = 'https://jvmvzfshgcekwocffdtv.supabase.co/auth/v1/user';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
const ENV = { AI_QUOTES_ENABLED: 'true', CRM_GEMINI_FREE_TIER_CONFIRMED: 'true', CRM_GEMINI_API_KEY: 'fictional-secret' };
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
const reply = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const auth = () => reply({ id: 'fictional-user', role: 'authenticated', aud: 'authenticated', is_anonymous: false });
const draft = () => ({
  summary: 'Remove and replace mulch.',
  ballpark: { low:'100.00', high:'240.00', basis:'Rough total; access and disposal need confirmation.' },
  lines: [
    { description: 'Install mulch', quantity: '2.5', rate_id: 0, basis: 'Two and a half yards described.' },
    { description: 'Remove debris', quantity: null, rate_id: null, basis: 'Confirm the amount of debris.' },
  ],
  questions: ['Confirm the depth.'], cautions: ['Hidden conditions may change the scope.'],
});
const candidate = (text, finishReason = 'STOP') => ({ finishReason, content: { role: 'model', parts: [{ text }] } });
const output = d => reply({ candidates: [candidate(JSON.stringify(d))] });
const input = () => ({ consent: true, provider:'gemini', disclosure:'gemini-free-v1', service: 'Mulch / bed refresh', description: 'Install 2.5 yards of mulch.', photos: [JPEG], rates: [{ id: 0, name: 'Mulch per yard' }], answers: [], extra: '' });

function harness(options = {}) {
  const calls = [], env = options.env === undefined ? ENV : options.env;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (options.respond) return options.respond(url, init, calls);
    if (url === AUTH) return auth();
    if (url === GEMINI) return output(draft());
    throw new Error('Unexpected network request');
  };
  const handler = createHandler({ env, fetch, createGeminiSignal: options.createGeminiSignal });
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

test('disabled unless enabled, the owner confirms Gemini Free, and a valid server key is configured', async () => {
  const cases = [
    {}, { AI_QUOTES_ENABLED: 'true' },
    { AI_QUOTES_ENABLED:'true', CRM_OPENAI_API_KEY:'fictional-secret' },
    { AI_QUOTES_ENABLED:'true', CRM_AI_FREE_PLAN_CONFIRMED:'true', CRM_CLOUDFLARE_ACCOUNT_ID:'a1'.repeat(16), CRM_CLOUDFLARE_AI_TOKEN:'fictional-secret' },
    { ...ENV, AI_QUOTES_ENABLED:'false' }, { ...ENV, AI_QUOTES_ENABLED:'TRUE' },
    { ...ENV, CRM_GEMINI_FREE_TIER_CONFIRMED:undefined }, { ...ENV, CRM_GEMINI_FREE_TIER_CONFIRMED:'false' }, { ...ENV, CRM_GEMINI_FREE_TIER_CONFIRMED:'TRUE' },
    { ...ENV, CRM_GEMINI_API_KEY:undefined }, { ...ENV, CRM_GEMINI_API_KEY:'short' },
    { ...ENV, CRM_GEMINI_API_KEY:'fictional secret' }, { ...ENV, CRM_GEMINI_API_KEY:'fictional\r\nsecret' },
    { ...ENV, CRM_GEMINI_API_KEY:'x'.repeat(513) },
  ];
  for (const env of cases) {
    const h = harness({ env }), r = await h.request(); assert.equal(r.code, 503); assert.match(r.data.error, /not enabled/);
    assert.equal(r.data.providerAttempted, false); assert.deepEqual(h.calls.map(c=>c.url), [AUTH]); assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret/);
  }
});

test('only consented work, optional rate names and all three JPEGs go to fixed Gemini endpoint', async () => {
  const h = harness(), request = { ...input(), photos:[JPEG,JPEG,JPEG] }; const r = await h.request(request);
  assert.equal(r.code, 200); assert.deepEqual(r.data.draft, draft()); assert.match(r.headers['cache-control'], /no-store/);
  assert.deepEqual(h.calls.map(c=>c.url), [AUTH, GEMINI]);
  const init = h.calls[1].init, provider = JSON.parse(init.body);
  assert.equal(init.method, 'POST'); assert.equal(init.headers['x-goog-api-key'], 'fictional-secret'); assert.equal(init.headers.Authorization,undefined);
  assert.equal(init.cache, 'no-store'); assert.equal(init.redirect, 'error'); assert.ok(init.signal);
  assert.equal(provider.generationConfig.maxOutputTokens, 8192);
  assert.deepEqual(provider.generationConfig.thinkingConfig,{thinkingLevel:'medium',includeThoughts:false});
  assert.equal(provider.generationConfig.responseFormat.text.mimeType,'APPLICATION_JSON');
  const schema=provider.generationConfig.responseFormat.text.schema;
  assert.deepEqual(schema.required,['summary','ballpark','lines','questions','cautions']);
  assert.deepEqual(schema.properties.ballpark.properties.low.type,['string','null']);
  assert.equal(schema.properties.lines.maxItems,8);assert.equal(schema.properties.questions.maxItems,6);
  assert.equal(provider.tools,undefined); assert.equal(provider.cachedContent,undefined);
  const instructions=provider.systemInstruction.parts[0].text;
  assert.match(instructions, /untrusted job data/); assert.match(instructions, /Never invent or assert measurements/);assert.match(instructions, /unverified guesses/);
  const content = provider.contents[0].parts;assert.equal(provider.contents[0].role,'user');
  assert.deepEqual(JSON.parse(content[0].text), { service: request.service, description: request.description, answers: [], additional_details: '', rate_names: request.rates });
  assert.equal(content.length, 4);
  assert.deepEqual(content.slice(1), Array(3).fill({inlineData:{mimeType:'image/jpeg',data:JPEG.split(',')[1]}}));
  assert.doesNotMatch(init.body, /fictional\.jwt|fictional-secret|clientName|unitCents/);
  assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret|base64/);
});

test('rejects invalid input, price injection, extra fields, noncanonical JPEG and missing consent before Gemini', async () => {
  const cases = [
    { ...input(), consent: false }, { ...input(), provider:'cloudflare' }, { ...input(), provider:'Gemini' },
    { ...input(), disclosure:'cloudflare-free-v1' }, { ...input(), disclosure:'gemini-free-v0' },
    { ...input(), service: '' }, { ...input(), service: 'x\nheader' },
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
    { ...input(), answers: null }, { ...input(), answers: [{question:'Q',answer:''}] },
    { ...input(), answers: [{question:'Q\nInjected',answer:'yes'}] }, { ...input(), answers: [{question:'Q',answer:'x'.repeat(501)}] },
    { ...input(), answers: [{question:'Q',answer:'yes',extra:'bad'}] },
    { ...input(), answers: [{question:'Q',answer:'yes'},{question:'q',answer:'no'}] },
    { ...input(), answers: Array.from({length:19},(_,i)=>({question:'Q'+i,answer:'yes'})) },
    { ...input(), extra: 'x'.repeat(1001) }, { ...input(), extra: '\u0000' },
    { ...input(), clientName: 'Do not send' }, { ...input(), endpoint: 'https://evil.invalid' },
    { ...input(), token: 'Do not accept' },
    // An older Cloudflare form did not bind consent to a provider/version.
    (({provider,disclosure,...oldForm})=>oldForm)(input()), null, 'not JSON', [],
  ];
  for (const body of cases) {
    const h = harness(), r = await h.request(body);
    assert.equal(r.code, 400, JSON.stringify(body).slice(0,100)); assert.equal(r.data.providerAttempted, false); assert.equal(h.calls.length, 1);
  }
  const h = harness(); const r = await h.request(input(), { headers: { 'content-length': '3200001' } });
  assert.equal(r.code, 413); assert.equal(h.calls.length, 1); assert.equal(r.data.providerAttempted, false);
});

test('a ballpark works without a rate card but the model cannot introduce an unknown rate id', async () => {
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

test('follow-up answers and extra details are sent only with consent and may support quantities', async () => {
  const request = { ...input(), description:'Install mulch near the garden.', answers:[{question:'How many yards?',answer:'2.5 yards'}], extra:'There are 3 beds.' };
  const response = { ...draft(), lines:[{description:'Install mulch',quantity:'2.5',rate_id:0,basis:'The answer described 2.5 yards.'}] };
  const h = harness({ respond: url => url === AUTH ? auth() : output(response) });
  let r = await h.request(request); assert.equal(r.code,200); assert.equal(r.data.draft.lines[0].quantity,'2.5');
  const provider = JSON.parse(h.calls[1].init.body), sent = JSON.parse(provider.contents[0].parts[0].text);
  assert.deepEqual(sent.answers,request.answers); assert.equal(sent.additional_details,request.extra);
  assert.equal(provider.contents[0].parts[1].inlineData.data,JPEG.split(',')[1]); assert.equal(provider.cachedContent,undefined);
  const noConsent = harness(); r = await noConsent.request({...request,consent:false}); assert.equal(r.code,400); assert.equal(noConsent.calls.length,1);
  // A number offered only by a model-generated question is not a measurement supplied by the user.
  const invented = {...request,answers:[{question:'Is it 8 yards?',answer:'No.'}],extra:''};
  const t = harness({respond:url=>url===AUTH?auth():output({...draft(),lines:[{description:'Mulch',quantity:'8',rate_id:null,basis:'Eight yards.'}]})});
  r = await t.request(invented); assert.equal(r.code,200); assert.equal(r.data.draft.lines[0].quantity,null);
  assert.match(r.data.draft.lines[0].basis,/description or answers/);
});

test('unprovided numeric claims in narrative are withheld without treating model questions as facts', async () => {
  const invented={...draft(),summary:'Trim an 8 foot hedge.',ballpark:{low:'100.00',high:'200.00',basis:'Assumes 8 feet.'},
    lines:[{description:'Trim 8 foot hedge',quantity:'8',rate_id:0,basis:'Eight feet.'}],questions:['Is it 8 feet?'],cautions:['Watch the 8 foot section.']};
  const h=harness({respond:url=>url===AUTH?auth():output(invented)}),r=await h.request({...input(),description:'Trim a hedge.'});
  assert.equal(r.code,200);assert.doesNotMatch(r.data.draft.summary,/8/);assert.doesNotMatch(r.data.draft.ballpark.basis,/8/);
  assert.equal(r.data.draft.lines[0].quantity,null);assert.equal(r.data.draft.lines[0].rate_id,null);assert.match(r.data.draft.lines[0].description,/verify details/i);
  assert.match(r.data.draft.lines[0].basis,/unconfirmed/i);assert.doesNotMatch(r.data.draft.cautions[0],/8/);
  assert.equal(r.data.draft.questions[0],'Is it 8 feet?');
});

test('model ballparks are bounded, normalized and explicitly allowed to be unavailable', async () => {
  for(const [ballpark,expected] of [
    [{low:25,high:125.5,basis:'Uncertain scope.'},{low:'25.00',high:'125.50',basis:'Uncertain scope.'}],
    [{low:'$1,200.50',high:'1,400.75',basis:'Uncertain scope.'},{low:'1200.50',high:'1400.75',basis:'Uncertain scope.'}],
    [{low:null,high:null,basis:'Need measurements.'},{low:null,high:null,basis:'Need measurements.'}],
  ]){
    const h=harness({respond:url=>url===AUTH?auth():output({...draft(),ballpark})});
    const r=await h.request();assert.equal(r.code,200);assert.deepEqual(r.data.draft.ballpark,expected);
  }
  for(const ballpark of [
    null, {low:null,high:'50.00',basis:'Unknown'}, {low:'80.00',high:'50.00',basis:'Reversed'},
    {low:'-1',high:'50',basis:'Negative'}, {low:'1.234',high:'50',basis:'Too many decimals'},
    {low:'1',high:'1000000000',basis:'Too large'}, {low:0,high:0,basis:'Not a price'},
    {low:'$1.2.3',high:'50',basis:'Unparseable'}, {low:'1',high:'50',basis:''},
    {low:'1',high:'50',basis:'Extra',verified:true},
  ]){
    const h=harness({respond:url=>url===AUTH?auth():output({...draft(),ballpark})});
    const r=await h.request();assert.equal(r.code,200,JSON.stringify(ballpark));assert.equal(r.data.draft.ballpark.low,null);assert.equal(r.data.draft.ballpark.high,null);
    assert.match(r.data.draft.ballpark.basis,/did not provide a valid/);assert.deepEqual(r.data.draft.questions,draft().questions);assert.equal(h.calls.length,2);
  }
  const {ballpark:_,...withoutPrice}=draft();
  const h=harness({respond:url=>url===AUTH?auth():output(withoutPrice)}),r=await h.request();
  assert.equal(r.code,200);assert.equal(r.data.draft.ballpark.low,null);assert.deepEqual(r.data.draft.questions,withoutPrice.questions);
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

test('accepts Gemini completed text parts only after validating their complete draft', async () => {
  const text=JSON.stringify(draft()), half=Math.floor(text.length/2);
  for (const parts of [
    [{text}],
    [{text:text.slice(0,half)},{text:text.slice(half),thoughtSignature:'opaque'}],
    [{text:'private thought',thought:true},{text}],
  ]) {
    const h = harness({ respond: url => url === AUTH ? auth() : reply({ candidates:[{finishReason:'STOP',content:{role:'model',parts}}] }) });
    const r = await h.request(); assert.equal(r.code, 200); assert.deepEqual(r.data.draft,draft()); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,GEMINI]);
    assert.doesNotMatch(JSON.stringify(r.data),/private thought|opaque/);
  }
});

test('partial, refused, malformed, multiple or unreadable Gemini replies fail without retry', async () => {
  const cases = [
    reply({promptFeedback:{blockReason:'SAFETY',blockReasonMessage:'private'}}),
    reply({candidates:[candidate('', 'SAFETY')]}),
    reply({candidates:[]}),
    reply({candidates:[candidate(JSON.stringify(draft()),'MAX_TOKENS')]}),
    reply({candidates:[candidate('not json')]}),
    reply({candidates:[candidate(JSON.stringify(draft())),candidate(JSON.stringify(draft()))]}),
    reply({candidates:[candidate('x'.repeat(20001))]}),
    reply({candidates:[{finishReason:'STOP',content:{role:'user',parts:[{text:JSON.stringify(draft())}]}}]}),
    reply({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(draft()),functionCall:{name:'private'}}]}}]}),
    reply({candidates:[{finishReason:'STOP',content:{role:'model',parts:[{text:JSON.stringify(draft()),thought:true}]}}]}),
    reply({success:true,result:{response:JSON.stringify(draft())}}),
    { ok:true, status:200, json: async()=>{ throw new Error('provider body'); } },
  ];
  for (const provider of cases) {
    const h = harness({ respond: url => url === AUTH ? auth() : provider }), r = await h.request();
    assert.ok([422,502].includes(r.code)); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,GEMINI]); assert.equal(r.data.providerAttempted, true);
    assert.doesNotMatch(JSON.stringify(r.data), /provider body|private/);
  }
});

test('quota and provider errors are sanitized, never retried and never fall back', async () => {
  for (const [status,expected] of [[400,422],[401,503],[403,503],[422,422],[429,429],[500,503],[404,503]]) {
    const h = harness({ respond: url => url === AUTH ? auth() : reply({ error:'fictional-secret and customer details' }, status) });
    const r = await h.request(); assert.equal(r.code,expected); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,GEMINI]); assert.equal(r.data.providerAttempted,true); assert.doesNotMatch(JSON.stringify(r.data), /fictional-secret|customer details/);
    assert.match(r.data.error,new RegExp('G_HTTP_'+status));
    if(status===429) assert.match(r.data.error,/allowance or rate limit/);
  }
});

test('network failures expose only fixed categories, not raw exceptions, and never retry', async () => {
  for (const [code,category] of [
    ['ENOTFOUND','G_DNS'], ['EAI_AGAIN','G_DNS'], ['UND_ERR_CONNECT_TIMEOUT','G_CONNECT_TIMEOUT'],
    ['ETIMEDOUT','G_CONNECT_TIMEOUT'], ['ECONNRESET','G_CONNECTION_RESET'],
    ['UND_ERR_SOCKET','G_CONNECTION_RESET'], ['private-key-and-customer-details','G_CONNECTION'], [undefined,'G_CONNECTION'],
  ]) {
    const h = harness({ respond: url => {
      if (url === AUTH) return auth();
      throw Object.assign(new Error('fictional-secret customer details'), { cause: { code } });
    } });
    const r=await h.request(); assert.equal(r.code,503); assert.match(r.data.error,new RegExp('\\b'+category+'\\b'));
    assert.equal(r.data.providerAttempted,true); assert.deepEqual(h.calls.map(c=>c.url),[AUTH,GEMINI]);
    assert.doesNotMatch(JSON.stringify(r.data),/fictional-secret|customer details|private-key/);
  }
});

// Simulate the entire header and body wait with short real timers rather than
// sending a live request. The production handler requests 120 seconds; the
// test-only factory makes its signal expire quickly so both paths are covered.
function waitForAbort(signal) {
  return new Promise((_,reject) => {
    const guard=setTimeout(()=>reject(new Error('test signal did not abort')),1000);
    const onAbort=()=>{clearTimeout(guard);reject(signal.reason);};
    if(signal.aborted) onAbort(); else signal.addEventListener('abort',onAbort,{once:true});
  });
}

test('a single bounded deadline covers Gemini headers and body, with enough function headroom', async () => {
  const config=require('../frontend/vercel.json');
  assert.equal(config.functions['api/crm-quote.js'].maxDuration,150);
  for(const stage of ['headers','body']) {
    let requestedMs;
    const h=harness({
      createGeminiSignal: ms=>{requestedMs=ms;return AbortSignal.timeout(25);},
      respond: (url,init)=>{
        if(url===AUTH)return auth();
        if(stage==='headers')return waitForAbort(init.signal);
        return {ok:true,status:200,json:()=>waitForAbort(init.signal)};
      },
    });
    const r=await h.request();
    assert.equal(requestedMs,120_000); assert.ok(config.functions['api/crm-quote.js'].maxDuration*1000 > requestedMs+7000);
    assert.equal(r.code,504); assert.match(r.data.error,/G_TIMEOUT/); assert.equal(r.data.providerAttempted,true);
    assert.deepEqual(h.calls.map(c=>c.url),[AUTH,GEMINI]); assert.doesNotMatch(JSON.stringify(r.data),/fictional-secret/);
  }
});

test('connection failure after response headers is still classified without exposing a body', async () => {
  const h=harness({respond:(url)=>url===AUTH?auth():{ok:true,status:200,json:async()=>{
    throw Object.assign(new Error('private body'),{cause:{code:'ECONNRESET'}});
  }}});
  const r=await h.request();assert.equal(r.code,503);assert.match(r.data.error,/G_CONNECTION_RESET/);
  assert.equal(r.data.providerAttempted,true);assert.equal(h.calls.length,2);assert.doesNotMatch(JSON.stringify(r.data),/private body/);
});
