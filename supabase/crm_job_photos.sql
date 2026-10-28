-- Review docs/crm-job-photos.md first. Run once in Supabase SQL Editor only
-- AFTER creating the private mib-crm-job-photos bucket. This script does not
-- create a bucket or modify CRM records. It adds restrictive guard policies to
-- storage.objects; those guards return true for every other bucket.
BEGIN;

DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'mib-crm-job-photos' AND public = false
      AND file_size_limit IS NOT NULL AND file_size_limit <= 5242880
      AND allowed_mime_types = ARRAY['image/jpeg']::text[]
  ) THEN
    RAISE EXCEPTION 'Create the private mib-crm-job-photos bucket with a 5 MiB size limit and image/jpeg as its only allowed MIME type.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('public.records') AND relrowsecurity) THEN
    RAISE EXCEPTION 'The CRM records table must exist and have row-level security enabled.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('storage.objects') AND relrowsecurity) THEN
    RAISE EXCEPTION 'Supabase Storage objects must have row-level security enabled.';
  END IF;
  IF to_regprocedure('public.mib_crm_photo_storage_private_v1()') IS NOT NULL
    OR to_regprocedure('public.mib_crm_photo_access_allowed_v1(text,text)') IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_policy
      WHERE polrelid = to_regclass('storage.objects') AND polname IN (
        'mib_crm_photos_read_v1', 'mib_crm_photos_insert_v1', 'mib_crm_photos_delete_v1',
        'mib_crm_photos_guard_read_v1', 'mib_crm_photos_guard_insert_v1',
        'mib_crm_photos_guard_delete_v1', 'mib_crm_photos_guard_update_v1'
      )
    ) THEN
    RAISE EXCEPTION 'CRM photo policies or functions already exist. Review them before changing them; this setup does not overwrite existing policies.';
  END IF;
END
$check$;

-- SECURITY INVOKER is essential: the records lookup uses the caller's existing
-- records SELECT privileges and RLS. Other buckets exit before looking up any
-- CRM records, including for roles that have no access to the records table.
-- The function must be callable by every role subject to the guard policies.
CREATE FUNCTION public.mib_crm_photo_access_allowed_v1(p_bucket text, p_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_bucket IS DISTINCT FROM 'mib-crm-job-photos' THEN
    RETURN true;
  END IF;
  IF auth.uid() IS NULL OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'true' THEN
    RETURN false;
  END IF;
  IF p_name IS NULL OR p_name !~ '^j-([0-9a-f]{2}){1,250}/(before|after)/p-[a-z0-9]{8,100}[.]jpg$' THEN
    RETURN false;
  END IF;
  -- Recheck bucket and guards on the server, not only before the browser
  -- sends an upload. The function is defined later in this transaction.
  IF NOT public.mib_crm_photo_storage_private_v1() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.coll = 'jobs'
      AND 'j-' || encode(convert_to(r.id::text, 'UTF8'), 'hex') = split_part(p_name, '/', 1)
  );
EXCEPTION WHEN insufficient_privilege THEN
  RETURN false;
END
$function$;
GRANT EXECUTE ON FUNCTION public.mib_crm_photo_access_allowed_v1(text, text) TO PUBLIC;

-- Permissive policies enable the intended operations for non-anonymous team
-- accounts that can already read the job. As with CRM records, an account's
-- actual access depends on its grants and on the records table's RLS policies.
-- Deliberately no permissive UPDATE policy is created for this bucket.
CREATE POLICY mib_crm_photos_read_v1 ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'mib-crm-job-photos' AND public.mib_crm_photo_access_allowed_v1(bucket_id, name));

CREATE POLICY mib_crm_photos_insert_v1 ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'mib-crm-job-photos' AND public.mib_crm_photo_access_allowed_v1(bucket_id, name));

CREATE POLICY mib_crm_photos_delete_v1 ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'mib-crm-job-photos' AND public.mib_crm_photo_access_allowed_v1(bucket_id, name));

-- Restrictive policies are ANDed with all permissive policies. They prevent an
-- unrelated broad Storage policy from granting extra access to this bucket.
-- They do not apply to superusers or roles with BYPASSRLS. The UPDATE guard
-- also prevents changing a different bucket's object into a CRM photo object.
CREATE POLICY mib_crm_photos_guard_read_v1 ON storage.objects AS RESTRICTIVE
FOR SELECT TO PUBLIC
USING (public.mib_crm_photo_access_allowed_v1(bucket_id, name));

CREATE POLICY mib_crm_photos_guard_insert_v1 ON storage.objects AS RESTRICTIVE
FOR INSERT TO PUBLIC
WITH CHECK (public.mib_crm_photo_access_allowed_v1(bucket_id, name));

CREATE POLICY mib_crm_photos_guard_delete_v1 ON storage.objects AS RESTRICTIVE
FOR DELETE TO PUBLIC
USING (public.mib_crm_photo_access_allowed_v1(bucket_id, name));

CREATE POLICY mib_crm_photos_guard_update_v1 ON storage.objects AS RESTRICTIVE
FOR UPDATE TO PUBLIC
USING (bucket_id IS DISTINCT FROM 'mib-crm-job-photos')
WITH CHECK (bucket_id IS DISTINCT FROM 'mib-crm-job-photos');

-- The web page refuses storage operations unless this authenticated check is
-- true. It checks bucket settings, RLS and the presence/shape of the guards;
-- it cannot prove that existing records policies or grants are appropriate.
CREATE FUNCTION public.mib_crm_photo_storage_private_v1()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt() ->> 'is_anonymous', 'false') <> 'true'
    AND EXISTS (
      SELECT 1 FROM storage.buckets b
      WHERE b.id = 'mib-crm-job-photos' AND b.public = false
        AND b.file_size_limit IS NOT NULL AND b.file_size_limit <= 5242880
        AND b.allowed_mime_types = ARRAY['image/jpeg']::text[]
    )
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('public.records') AND relrowsecurity)
    AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('storage.objects') AND relrowsecurity)
    AND EXISTS (
      SELECT 1 FROM pg_catalog.pg_proc f
      WHERE f.oid = to_regprocedure('public.mib_crm_photo_access_allowed_v1(text,text)') AND NOT f.prosecdef
    )
    AND (
      SELECT count(*) = 4 FROM pg_catalog.pg_policy p
      WHERE p.polrelid = to_regclass('storage.objects') AND NOT p.polpermissive
        AND p.polroles = ARRAY[0::oid]
        AND (
          (p.polname = 'mib_crm_photos_guard_read_v1' AND p.polcmd = 'r'
            AND pg_get_expr(p.polqual, p.polrelid) = 'public.mib_crm_photo_access_allowed_v1(bucket_id, name)')
          OR (p.polname = 'mib_crm_photos_guard_insert_v1' AND p.polcmd = 'a'
            AND pg_get_expr(p.polwithcheck, p.polrelid) = 'public.mib_crm_photo_access_allowed_v1(bucket_id, name)')
          OR (p.polname = 'mib_crm_photos_guard_delete_v1' AND p.polcmd = 'd'
            AND pg_get_expr(p.polqual, p.polrelid) = 'public.mib_crm_photo_access_allowed_v1(bucket_id, name)')
          OR (p.polname = 'mib_crm_photos_guard_update_v1' AND p.polcmd = 'w'
            AND pg_get_expr(p.polqual, p.polrelid) = '(bucket_id IS DISTINCT FROM ''mib-crm-job-photos''::text)'
            AND pg_get_expr(p.polwithcheck, p.polrelid) = '(bucket_id IS DISTINCT FROM ''mib-crm-job-photos''::text)')
        )
    );
$function$;
REVOKE ALL ON FUNCTION public.mib_crm_photo_storage_private_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mib_crm_photo_storage_private_v1() TO authenticated;

COMMIT;
