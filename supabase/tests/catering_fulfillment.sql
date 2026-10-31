begin;
do $$
declare branch uuid; booking uuid; rejected boolean;
begin
 insert into public.locations(name,is_central) values('Catering fulfillment test (rolled back)',false) returning id into branch;
 insert into public.catering_events(location_id,customer_name,customer_phone,event_datetime,guest_count,total_amount,advance_paid,balance_due,status)
 values(branch,'Fulfillment test','4165550100',now()+interval '2 days',5,100,0,100,'INQUIRY') returning id into booking;
 if not exists(select 1 from public.catering_events where id=booking and fulfillment_method='PICKUP' and delivery_address is null) then raise exception 'Pickup defaults failed';end if;
 rejected:=false;
 begin update public.catering_events set fulfillment_method='DELIVERY',delivery_address=' ' where id=booking;exception when check_violation then rejected:=true;end;
 if not rejected then raise exception 'Delivery without address accepted';end if;
 update public.catering_events set fulfillment_method='DELIVERY',delivery_address='10 King St, Oshawa ON' where id=booking;
 if not exists(select 1 from public.catering_events where id=booking and fulfillment_method='DELIVERY' and delivery_address='10 King St, Oshawa ON') then raise exception 'Delivery not saved';end if;
 update public.catering_events set fulfillment_method='PICKUP',delivery_address=null where id=booking;
end;$$;
rollback;
select 'Catering pickup/delivery checks passed; all test records rolled back' as result;
