-- Additive control-plane foundation. This does NOT enable multi-business operations.
-- Existing business tables, policies and RPCs are intentionally unchanged.
-- Apply to staging first; platform administrators must be assigned explicitly.
begin;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 60),
  name text not null check (length(trim(name)) between 1 and 200),
  status text not null default 'provisioning' check (status in ('provisioning','active','suspended')),
  isolation_ready boolean not null default false,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  status public.profile_status not null default 'pending',
  location_id uuid references public.locations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,user_id)
);
create index business_memberships_user_scope on public.business_memberships(user_id,status,business_id);

create table public.platform_administrators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  previous_value jsonb,
  next_value jsonb,
  created_at timestamptz not null default now()
);
create index platform_audit_created on public.platform_audit_log(created_at desc,id);

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.platform_administrators enable row level security;
alter table public.platform_audit_log enable row level security;
revoke all on public.businesses,public.business_memberships,public.platform_administrators,public.platform_audit_log from public,anon,authenticated;
grant select on public.businesses,public.business_memberships,public.platform_administrators,public.platform_audit_log to authenticated;
grant all on public.businesses,public.business_memberships,public.platform_administrators,public.platform_audit_log to service_role;

create function public.platform_is_administrator() returns boolean
language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.platform_administrators a join public.profiles p on p.id=a.user_id
   where a.user_id=auth.uid() and a.is_active and p.status::text='active');
$$;
revoke all on function public.platform_is_administrator() from public,anon;
grant execute on function public.platform_is_administrator() to authenticated,service_role;

create policy business_membership_self_read on public.business_memberships for select to authenticated
using (user_id=auth.uid() or public.platform_is_administrator());
create policy business_registry_read on public.businesses for select to authenticated
using (public.platform_is_administrator() or exists(select 1 from public.business_memberships m
  where m.business_id=businesses.id and m.user_id=auth.uid() and m.status::text='active'));
create policy platform_administrator_self_read on public.platform_administrators for select to authenticated
using (user_id=auth.uid());
create policy platform_audit_administrator_read on public.platform_audit_log for select to authenticated
using (public.platform_is_administrator());

create function public.audit_platform_change() returns trigger
language plpgsql security definer set search_path=''
as $$
declare before_value jsonb; after_value jsonb; key_value text;
begin
 if tg_op <> 'INSERT' then before_value=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then after_value=to_jsonb(new); end if;
 key_value=coalesce(after_value->>'id',before_value->>'id',after_value->>'user_id',before_value->>'user_id');
 if tg_table_name='business_memberships' then
   key_value=coalesce(after_value->>'business_id',before_value->>'business_id')||'/'||key_value;
 end if;
 insert into public.platform_audit_log(actor_id,entity_type,entity_id,operation,previous_value,next_value)
 values(auth.uid(),tg_table_name,key_value,tg_op,before_value,after_value);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
revoke all on function public.audit_platform_change() from public,anon,authenticated;
create trigger business_audit after insert or update or delete on public.businesses for each row execute function public.audit_platform_change();
create trigger membership_audit after insert or update or delete on public.business_memberships for each row execute function public.audit_platform_change();
create trigger platform_administrator_audit after insert or update or delete on public.platform_administrators for each row execute function public.audit_platform_change();

-- Seed the existing organization and preserve identities, roles and location assignments.
-- isolation_ready remains false until operational tables/functions/storage pass isolation tests.
insert into public.businesses(slug,name,status) values('ahaa','Ahaa','active');
insert into public.business_memberships(business_id,user_id,role,status,location_id)
select b.id,p.id,p.role,p.status,p.location_id from public.profiles p cross join public.businesses b where b.slug='ahaa';

commit;
