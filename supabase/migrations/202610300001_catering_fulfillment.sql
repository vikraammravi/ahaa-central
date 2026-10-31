begin;
alter table public.catering_events
 add column fulfillment_method text not null default 'PICKUP',
 add column delivery_address text,
 add constraint catering_fulfillment_method check(fulfillment_method in ('PICKUP','DELIVERY')),
 add constraint catering_delivery_address check(
  (fulfillment_method='PICKUP' and delivery_address is null)
  or (fulfillment_method='DELIVERY' and delivery_address is not null and length(delivery_address)<=1000 and delivery_address ~ '[^[:space:]]')
 );
notify pgrst,'reload schema';
commit;
