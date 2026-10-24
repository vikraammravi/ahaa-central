begin;
do $$
declare actor uuid; branch uuid; other uuid; booking uuid; foreign_booking uuid; affected integer; denied boolean;
begin
 select id into actor from public.profiles where role::text in ('BRANCH_EMPLOYEE','BRANCH_MANAGER') and status::text='active' limit 1;
 if actor is null then raise exception 'An active branch staff account is needed for rollback-only catering tests.';end if;
 insert into public.locations(name,is_central) values('Staff catering test (rolled back)',false) returning id into branch;
 insert into public.locations(name,is_central) values('Other catering test (rolled back)',false) returning id into other;
 update public.profiles set location_id=branch,role='BRANCH_EMPLOYEE' where id=actor;
 insert into public.catering_events(location_id,customer_name,customer_phone,guest_count,event_datetime,total_amount,balance_due) values(other,'Other test booking','4165550100',10,clock_timestamp()+interval '1 day',100,100) returning id into foreign_booking;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 execute 'set local role authenticated';
 insert into public.catering_events(location_id,customer_name,customer_phone,guest_count,event_datetime,total_amount,balance_due) values(branch,'Employee test booking','4165550100',10,clock_timestamp()+interval '1 day',100,100) returning id into booking;
 if not exists(select 1 from public.catering_events where id=booking) then raise exception 'Employee cannot read own catering';end if;
 if exists(select 1 from public.catering_events where id=foreign_booking) then raise exception 'Employee can read another branch catering';end if;
 update public.catering_events set guest_count=12 where id=booking;
 if not exists(select 1 from public.catering_events where id=booking and guest_count=12) then raise exception 'Employee cannot update own catering';end if;
 denied:=false;begin update public.catering_events set location_id=other where id=booking;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Employee moved catering to another branch';end if;
 delete from public.catering_events where id=foreign_booking;get diagnostics affected=row_count;
 if affected<>0 then raise exception 'Employee deleted another branch catering';end if;
 delete from public.catering_events where id=booking;get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Employee cannot delete own catering';end if;
 execute 'set local role postgres';
end; $$;
rollback;
select 'Employee catering permissions passed; all test records rolled back' as result;
