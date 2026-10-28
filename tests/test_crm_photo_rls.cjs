// Optional integration test against PGlite's PostgreSQL, not a live Supabase
// project. Install @electric-sql/pglite outside this repo and set NODE_PATH to
// its node_modules to run it. This simulates Storage/Auth schemas and RLS; it
// does not verify production policies, grants, buckets, or the Storage API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let PGlite;
try { ({ PGlite } = require(process.env.CRM_PGLITE_MODULE || '@electric-sql/pglite')); } catch (_) {}

const sql = fs.readFileSync(path.join(__dirname, '../supabase/crm_job_photos.sql'), 'utf8');
const personA = '00000000-0000-4000-8000-000000000001';
const personB = '00000000-0000-4000-8000-000000000002';
const personC = '00000000-0000-4000-8000-000000000003';
const bucket = 'mib-crm-job-photos';
const folder = id => `j-${Buffer.from(id, 'utf8').toString('hex')}`;
const photo = id => `${folder(id)}/before/p-12345678.jpg`;

async function use(db, role, id = '', anonymous = false) {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${id}', false); SELECT set_config('request.jwt.claims', '{"is_anonymous":${anonymous}}', false); SET ROLE ${role};`);
}
const names = async db => (await db.query('SELECT bucket_id, name FROM storage.objects ORDER BY bucket_id, name')).rows;
const ready = async db => (await db.query('SELECT public.mib_crm_photo_storage_private_v1() AS ok')).rows[0].ok;

async function setup(db) {
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth; CREATE SCHEMA storage;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
      AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
    GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated;
    CREATE TABLE public.records (coll text NOT NULL, id text NOT NULL, data jsonb, PRIMARY KEY (coll,id));
    ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
    GRANT SELECT ON public.records TO authenticated;
    CREATE POLICY records_read ON public.records FOR SELECT TO authenticated USING (
      (id = 'one' AND auth.uid() = '${personA}'::uuid) OR
      (id = 'two' AND auth.uid() = '${personB}'::uuid)
    );
    INSERT INTO public.records (coll,id) VALUES ('jobs','one'), ('jobs','two');
    CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    INSERT INTO storage.buckets VALUES ('${bucket}', false, 5242880, ARRAY['image/jpeg']);
    CREATE TABLE storage.objects (bucket_id text NOT NULL, name text NOT NULL, PRIMARY KEY (bucket_id,name));
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, DELETE, UPDATE ON storage.objects TO anon, authenticated;
    INSERT INTO storage.objects VALUES ('${bucket}', '${photo('one')}'), ('${bucket}', '${photo('two')}'), ('other-bucket', 'shared-file');
  `);
}

test('private photo SQL enforces job visibility even with a broad Storage policy', { skip: !PGlite && 'Install @electric-sql/pglite externally to run the PostgreSQL RLS simulation' }, async () => {
  const db = new PGlite();
  try {
    await setup(db);
    // A public bucket or disabled CRM RLS must stop the entire setup.
    await db.exec(`UPDATE storage.buckets SET public = true WHERE id = '${bucket}'`);
    await assert.rejects(db.exec(sql), /Create the private/);
    await db.exec('ROLLBACK');
    await db.exec(`UPDATE storage.buckets SET public = false WHERE id = '${bucket}'; ALTER TABLE public.records DISABLE ROW LEVEL SECURITY`);
    await assert.rejects(db.exec(sql), /records table must exist and have row-level security enabled/);
    await db.exec('ROLLBACK');
    await db.exec('ALTER TABLE public.records ENABLE ROW LEVEL SECURITY');
    await db.exec(sql);

    // Re-running does not overwrite a previously reviewed setup.
    await assert.rejects(db.exec(sql), /already exist/);
    await db.exec('ROLLBACK');

    // Simulate a dangerously permissive pre-existing policy. Restrictive guards
    // must protect the CRM bucket while leaving other buckets usable.
    await db.exec('CREATE POLICY unrelated_broad_policy ON storage.objects FOR ALL TO PUBLIC USING (true) WITH CHECK (true)');
    await use(db, 'authenticated', personA);
    assert.equal(await ready(db), true);
    assert.deepEqual(await names(db), [
      { bucket_id: bucket, name: photo('one') },
      { bucket_id: 'other-bucket', name: 'shared-file' },
    ]);
    await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES ('${bucket}', '${photo('two')}')`), /row-level security/);
    await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES ('${bucket}', '${folder('one')}/before/nested/p-12345678.jpg')`), /row-level security/);
    await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES ('${bucket}', '${folder('one')}/before/not-a-photo.html')`), /row-level security/);
    const newPhoto = `${folder('one')}/after/p-abcdefgh.jpg`;
    await db.exec(`INSERT INTO storage.objects VALUES ('${bucket}', '${newPhoto}')`);
    assert.equal((await db.query(`DELETE FROM storage.objects WHERE bucket_id='${bucket}' AND name='${photo('two')}' RETURNING name`)).rows.length, 0);
    assert.equal((await db.query(`UPDATE storage.objects SET name='${folder('one')}/before/p-abcdef12.jpg' WHERE bucket_id='${bucket}' RETURNING name`)).rows.length, 0);
    await assert.rejects(db.exec(`UPDATE storage.objects SET bucket_id='${bucket}', name='${newPhoto}' WHERE bucket_id='other-bucket'`), /row-level security/);
    assert.equal((await db.query(`DELETE FROM storage.objects WHERE bucket_id='${bucket}' AND name='${newPhoto}' RETURNING name`)).rows.length, 1);

    await use(db, 'authenticated', personB);
    assert.deepEqual(await names(db), [
      { bucket_id: bucket, name: photo('two') },
      { bucket_id: 'other-bucket', name: 'shared-file' },
    ]);
    await use(db, 'authenticated', personC);
    assert.deepEqual(await names(db), [{ bucket_id: 'other-bucket', name: 'shared-file' }]);
    await use(db, 'authenticated', personA, true);
    assert.equal(await ready(db), false);
    assert.deepEqual(await names(db), [{ bucket_id: 'other-bucket', name: 'shared-file' }]);
    await use(db, 'anon');
    assert.deepEqual(await names(db), [{ bucket_id: 'other-bucket', name: 'shared-file' }]);
    await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES ('${bucket}', '${folder('one')}/after/p-abcdefgh.jpg')`), /row-level security/);
    await assert.rejects(db.query('SELECT public.mib_crm_photo_storage_private_v1()'), /permission denied/);
    // The guard does not require an anonymous user to have SELECT on records
    // for unrelated buckets and does not interfere with their other policies.
    await db.exec("INSERT INTO storage.objects VALUES ('other-bucket', 'anon-file')");
    assert.equal((await db.query("SELECT name FROM storage.objects WHERE name = 'anon-file'")).rows.length, 1);

    // Database-side enforcement prevents new uploads if a bucket is made
    // public between the browser's readiness check and the upload request.
    // A real public Storage endpoint can still expose *existing* objects.
    await db.exec(`RESET ROLE; UPDATE storage.buckets SET public = true WHERE id = '${bucket}'`);
    await use(db, 'authenticated', personA);
    assert.equal(await ready(db), false);
    await assert.rejects(db.exec(`INSERT INTO storage.objects VALUES ('${bucket}', '${folder('one')}/after/p-abcdefgh.jpg')`), /row-level security/);
    await db.exec(`RESET ROLE; UPDATE storage.buckets SET public = false WHERE id = '${bucket}'`);
    await db.exec('ALTER TABLE public.records DISABLE ROW LEVEL SECURITY');
    await use(db, 'authenticated', personA);
    assert.equal(await ready(db), false);
    await db.exec('RESET ROLE; ALTER TABLE public.records ENABLE ROW LEVEL SECURITY');
    await db.exec('ALTER POLICY mib_crm_photos_guard_read_v1 ON storage.objects USING (true)');
    await use(db, 'authenticated', personA);
    assert.equal(await ready(db), false);
    await db.exec('RESET ROLE; DROP POLICY mib_crm_photos_guard_read_v1 ON storage.objects');
    await use(db, 'authenticated', personA);
    assert.equal(await ready(db), false);
  } finally { await db.close(); }
});
