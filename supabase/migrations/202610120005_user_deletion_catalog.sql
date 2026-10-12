begin;
update public.catalog_items set category='Grocery' where lower(category)='pantry';

-- Keep business records when a login/profile is permanently removed.
-- Preserve each constraint's name because API relationship joins use it.
do $$
declare dependency record;
begin
  for dependency in
    select c.conrelid::regclass as child,c.conname,a.attname as column_name
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.profiles'::regclass
      and array_length(c.conkey,1)=1
  loop
    execute format('alter table %s alter column %I drop not null',dependency.child,dependency.column_name);
    execute format('alter table %s drop constraint %I',dependency.child,dependency.conname);
    execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',dependency.child,dependency.conname,dependency.column_name);
  end loop;
end $$;
commit;
