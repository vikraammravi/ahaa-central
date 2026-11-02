-- Read-only inventory before introducing tenant isolation.
-- Run in staging first. Contains schema/access metadata, not customer records.
select jsonb_build_object(
  'tables', (select coalesce(jsonb_agg(jsonb_build_object('table', c.relname, 'rls', c.relrowsecurity,
    'force_rls', c.relforcerowsecurity, 'owner', pg_get_userbyid(c.relowner)) order by c.relname), '[]')
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('name', p.proname,
    'arguments', pg_get_function_identity_arguments(p.oid), 'security_definer', p.prosecdef,
    'owner', pg_get_userbyid(p.proowner), 'settings', p.proconfig,
    'anonymous_execute', has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated',p.oid,'EXECUTE')) order by p.proname), '[]')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p) order by p.schemaname,p.tablename,p.policyname), '[]')
    from pg_policies p where p.schemaname in ('public','storage')),
  'foreign_keys', (select coalesce(jsonb_agg(jsonb_build_object('table', c.conrelid::regclass::text,
    'constraint', c.conname, 'definition', pg_get_constraintdef(c.oid)) order by c.conname), '[]')
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f'),
  'views', (select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'settings',c.reloptions,
    'definition',pg_get_viewdef(c.oid,true)) order by c.relname),'[]')
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'),
  'triggers', (select coalesce(jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,
    'definition',pg_get_triggerdef(t.oid)) order by t.tgname),'[]')
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','auth') and not t.tgisinternal),
  'storage_buckets', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'public',public) order by id),'[]') from storage.buckets)
) as tenant_readiness;
