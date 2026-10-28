# Private CRM job-photo setup

The before/after photo controls require **one-time Supabase Storage setup**. No
bucket or policies are created by the website. Do not use a public bucket or a
service-role key in the website. Until the setup and access tests below are
complete, do not upload real customer photos.

1. In the same Supabase project as the CRM, open **Storage → New bucket**.
   Name it exactly `mib-crm-job-photos`, leave **Public** off, set the allowed
   MIME type to **only** `image/jpeg`, and set the file-size limit to 5 MiB
   (5,242,880 bytes) or less. The readiness check requires all three settings.
   Creating the bucket and using storage is subject to the project's plan and
   quota.
2. Have a Supabase administrator review [`supabase/crm_job_photos.sql`](../supabase/crm_job_photos.sql)
   and the existing project permissions, then run the script **once** in SQL
   Editor. It stops if the bucket is not private, if RLS is off on `records` or
   `storage.objects`, or if its own policies/functions already exist. It does
   not change CRM records or existing buckets. If it stops, inspect the
   existing setup instead of running a different script blindly.
3. The script creates permissive policies for the CRM photo bucket and
   **restrictive guards on `storage.objects` for all roles**. The guards return
   true for other buckets, but run as part of their Storage RLS checks too;
   review and test this in a staging project before applying it to a project
   that has other applications. For the CRM bucket, they prevent broad
   permissive Storage policies from granting extra access to ordinary RLS-bound
   roles, and block UPDATEs. PostgreSQL superusers and roles with `BYPASSRLS`
   still bypass these protections, as they do other RLS policies.
4. Review the CRM `records` table's **SELECT policies and grants**, existing
   Storage policies, and all user accounts. The photo policies allow
   non-anonymous signed-in users to view, upload and permanently delete photos
   for jobs their existing `records` SELECT policies let them see—**including
   users with read-only access to those records**. They do not decide which
   users should be able to see jobs. Keep public and anonymous sign-ups
   disabled if they are not wanted. The readiness function checks bucket
   settings, RLS flags and guard-policy definitions, but cannot prove that
   account permissions, the guard function or `records` policies are correct.
   Never change this bucket to public: public Storage downloads bypass RLS and
   can expose existing photos even though the app stops new uploads.
5. With a fictional test job and a non-sensitive test image, verify upload,
   viewing and deletion on both team phones. Verify that an unsigned user, an
   anonymous user, and a signed-in account unable to view the job cannot read,
   upload or delete its photo. Also test any other applications using Storage.
   Only use real customer photos once these checks pass.

Photos upload over the internet directly to the configured Supabase Storage
bucket. The phone converts them to JPEG; they are **not queued for offline
upload**, so wait for each upload to finish. The regular **Backup → Copy** JSON
contains CRM records, not photo files. Maintain a separate private backup of
photos. Deleting a photo in the app removes it from Storage; deleting a job or
client does **not** automatically remove its photos, so a storage administrator
must review and clean up orphaned files if needed. Restore replaces CRM records
and does not restore photo files.

## Optional local RLS simulation

`tests/test_crm_photo_rls.cjs` uses the optional `@electric-sql/pglite` package to
exercise the SQL against a simulated PostgreSQL schema, including a broad
Storage policy and users who cannot see a job. It does **not** connect to
Supabase or verify the project's actual configuration. To run it without
modifying this repository's package files:

```sh
npm install --prefix /tmp/crm-photo-test --no-save @electric-sql/pglite
NODE_PATH=/tmp/crm-photo-test/node_modules node --test tests/test_crm_photo_rls.cjs
```

The optional `tests/test_crm_storage_sdk.cjs` checks the Storage API calls
against the pinned Supabase JS client and a fake HTTP backend. Install
`@supabase/supabase-js@2.118.0` outside the repo and use the same `NODE_PATH`
pattern. `tests/test_crm_mobile.cjs` uses `playwright-core` and
`@sparticuz/chromium` to exercise the interface with fictional data and all
external requests blocked. Neither test verifies a real phone or the production
Supabase project.
