-- Run only inside the staging rollback rehearsal after the invitation draft.
-- These checks change rate counters and create temporary business rows, so the
-- outer transaction must always roll back.
do $$
declare
 actor uuid;
 first_business uuid := gen_random_uuid();
 second_business uuid := gen_random_uuid();
 first_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
 second_hash text := md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text);
 unknown_hash text;
 first_count integer;
 second_count integer;
 i integer;
begin
 select user_id into actor from public.platform_administrators where is_active limit 1;
 if actor is null then raise exception 'No staging platform administrator for rate tests'; end if;

 -- Suspended businesses keep invitations unclaimed while exercising buckets.
 insert into public.businesses(id,slug,name,status,isolation_ready) values
  (first_business,'rate-test-'||first_business::text,'Rate test one','suspended',false),
  (second_business,'rate-test-'||second_business::text,'Rate test two','suspended',false);
 insert into public.platform_owner_invitations(business_id,issued_by,name,email,token_hash,expires_at) values
  (first_business,actor,'Owner one','one@example.invalid',first_hash,clock_timestamp()+interval '1 hour'),
  (second_business,actor,'Owner two','two@example.invalid',second_hash,clock_timestamp()+interval '1 hour');
 insert into public.platform_owner_invitation_rate(singleton,window_start,attempts) values(true,clock_timestamp(),0)
  on conflict(singleton) do update set window_start=clock_timestamp(),attempts=0;

 -- Random hashes count towards the high shared guard, but cannot create rows.
 for i in 1..20 loop
  unknown_hash := lpad(to_hex(i),64,'0');
  if public.platform_claim_owner_invitation(unknown_hash,gen_random_uuid()) is not null then raise exception 'Unknown token accepted'; end if;
 end loop;
 if exists(select 1 from public.platform_owner_invitation_token_rate where token_hash=lpad(to_hex(1),64,'0')) then
  raise exception 'Unknown token allocated a per-token bucket';
 end if;

 for i in 1..6 loop
  if public.platform_claim_owner_invitation(first_hash,gen_random_uuid()) is not null then raise exception 'Suspended business accepted'; end if;
 end loop;
 perform public.platform_claim_owner_invitation(second_hash,gen_random_uuid());
 select attempts into first_count from public.platform_owner_invitation_token_rate where token_hash=first_hash;
 select attempts into second_count from public.platform_owner_invitation_token_rate where token_hash=second_hash;
 if first_count<>6 or second_count<>1 then raise exception 'Per-invitation counters are not independent'; end if;

 -- Check TTL cleanup on the next claim, including an unknown claim.
 update public.platform_owner_invitation_token_rate set window_start=clock_timestamp()-interval '11 minutes' where token_hash=first_hash;
 perform public.platform_claim_owner_invitation(lpad(to_hex(999),64,'0'),gen_random_uuid());
 if exists(select 1 from public.platform_owner_invitation_token_rate where token_hash=first_hash) then raise exception 'Expired token bucket was not cleaned'; end if;

 -- The global guard rejects before creating a bucket at its high ceiling.
 update public.platform_owner_invitation_rate set window_start=clock_timestamp(),attempts=600 where singleton;
 perform public.platform_claim_owner_invitation(first_hash,gen_random_uuid());
 if exists(select 1 from public.platform_owner_invitation_token_rate where token_hash=first_hash) then raise exception 'Global guard allocated a bucket'; end if;
end $$;
