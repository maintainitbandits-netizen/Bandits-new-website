// Optional contract test using the actual pinned Supabase JS Storage client
// against an intercepted in-memory HTTP stub. No network request is made.
// Install @supabase/supabase-js@2.118.0 externally and set NODE_PATH to run.
const test = require('node:test');
const assert = require('node:assert/strict');
let createClient, sdkVersion;
try { ({ createClient } = require('@supabase/supabase-js')); sdkVersion = require('@supabase/supabase-js/package.json').version; } catch (_) {}

test('pinned Storage SDK supports the private photo operations used by the CRM', { skip: !createClient && 'Install @supabase/supabase-js@2.118.0 externally to run the SDK contract test' }, async () => {
  assert.equal(sdkVersion, '2.118.0');
  const bucket = 'mib-crm-job-photos', folder = 'j-6f6e65/before', photo = `${folder}/p-12345678.jpg`;
  const calls = [], objects = new Map();
  const fakeFetch = async (request, options = {}) => {
    const url = new URL(String(request));
    assert.equal(url.origin, 'https://fictional.invalid');
    const method = options.method || 'GET'; calls.push({ url, method, options });
    const respond = data => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
    if (method === 'POST' && url.pathname === `/storage/v1/object/list/${bucket}`) {
      const body = JSON.parse(options.body);
      assert.equal(body.prefix, folder); assert.equal(body.limit, 101);
      assert.deepEqual(body.sortBy, { column: 'created_at', order: 'desc' });
      return respond([...objects.keys()].filter(p => p.startsWith(folder + '/')).map(p => ({ name: p.slice(folder.length + 1) })));
    }
    if (method === 'POST' && url.pathname === `/storage/v1/object/${bucket}/${photo}`) {
      assert.equal(new Headers(options.headers).get('x-upsert'), 'false');
      assert.equal(options.body.get('cacheControl'), '0');
      const file = options.body.get(''); assert.equal(file.type, 'image/jpeg');
      objects.set(photo, file); return respond({ Key: `${bucket}/${photo}`, Id: 'fictional-id' });
    }
    if (method === 'GET' && url.pathname === `/storage/v1/object/${bucket}/${photo}`) {
      assert.equal(options.cache, 'no-store');
      return new Response(objects.get(photo), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }
    if (method === 'DELETE' && url.pathname === `/storage/v1/object/${bucket}`) {
      assert.deepEqual(JSON.parse(options.body), { prefixes: [photo] });
      objects.delete(photo); return respond([{ name: photo }]);
    }
    throw new Error(`Unexpected request: ${method} ${url}`);
  };
  const sdk = createClient('https://fictional.invalid', 'fictional-publishable-key', {
    global: { fetch: fakeFetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const storage = sdk.storage.from(bucket);
  const blob = new Blob(['fictional photo bytes'], { type: 'image/jpeg' });
  const uploaded = await storage.upload(photo, blob, { contentType: 'image/jpeg', cacheControl: '0', upsert: false });
  assert.equal(uploaded.error, null); assert.equal(uploaded.data.path, photo);
  const listed = await storage.list(folder, { limit: 101, sortBy: { column: 'created_at', order: 'desc' } });
  assert.equal(listed.error, null); assert.equal(listed.data[0].name, 'p-12345678.jpg');
  const downloaded = await storage.download(photo, {}, { cache: 'no-store' });
  assert.equal(downloaded.error, null); assert.equal(await downloaded.data.text(), 'fictional photo bytes');
  const deleted = await storage.remove([photo]);
  assert.equal(deleted.error, null); assert.equal(deleted.data.length, 1);
  assert.deepEqual(calls.map(c => c.method), ['POST', 'POST', 'GET', 'DELETE']);
});
