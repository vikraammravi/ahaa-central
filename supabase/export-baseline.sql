-- Read-only application schema inventory. Contains no table rows or auth credentials.
select jsonb_build_object(
 'server_version',current_setting('server_version'),
 'enums',(select coalesce(jsonb_agg(e),'[]') from (
   select t.typname name,jsonb_agg(e.enumlabel order by e.enumsortorder) labels
   from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid
   where n.nspname='public' group by t.typname order by t.typname
 ) e),
 'tables',(select coalesce(jsonb_agg(t),'[]') from (
   select c.relname name,c.relrowsecurity rls,c.relforcerowsecurity force_rls,
     (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) columns
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname
 ) t),
 'constraints',(select coalesce(jsonb_agg(t),'[]') from (
   select c.relname table_name,k.conname name,k.contype kind,pg_get_constraintdef(k.oid,true) definition
   from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' order by case when k.contype='f' then 1 else 0 end,c.relname,k.conname
 ) t),
 'indexes',(select coalesce(jsonb_agg(t),'[]') from (
   select c.relname name,pg_get_indexdef(c.oid) definition from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='i' and not exists(select 1 from pg_constraint k where k.conindid=c.oid) order by c.relname
 ) t),
 'functions',(select coalesce(jsonb_agg(t),'[]') from (
   select p.proname name,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,p.proacl::text acl
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
   and not exists(select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')
   order by p.proname,p.oid
 ) t),
 'triggers',(select coalesce(jsonb_agg(t),'[]') from (
   select n.nspname schema_name,c.relname table_name,t.tgname name,pg_get_triggerdef(t.oid,true) definition,t.tgenabled enabled
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
   join pg_proc f on f.oid=t.tgfoid join pg_namespace fn on fn.oid=f.pronamespace
   where not t.tgisinternal and (n.nspname='public' or(n.nspname='auth' and fn.nspname='public')) order by n.nspname,c.relname,t.tgname
 ) t),
 'policies',(select coalesce(jsonb_agg(t),'[]') from (select * from pg_policies where schemaname='public' order by tablename,policyname) t),
 'sequences',(select coalesce(jsonb_agg(t),'[]') from (select * from pg_sequences where schemaname='public' order by sequencename) t),
 'grants',(select coalesce(jsonb_agg(t),'[]') from (select table_schema,table_name,grantee,privilege_type,is_grantable from information_schema.table_privileges where table_schema='public' order by table_name,grantee,privilege_type) t),
 'extensions',(select coalesce(jsonb_agg(t),'[]') from (select e.extname name,e.extversion version,n.nspname schema_name from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by e.extname) t)
) as schema_inventory;
