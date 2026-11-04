import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, randomInt, createHash } from "node:crypto";

// PREPARES PRIVATE FILES ONLY. Does not connect, upload, apply SQL or create Auth
// accounts. Run only after staging isolation/app cutover, then execute setup.sql
// as postgres against staging and save its SINGLE final JSON row as manifest.json.
// Upload fixture-original.pdf at each plan.json business receiptPath separately.
// After acceptance, remove those exact storage objects and run cleanup.sql.
// Cleanup aborts on unexpected references or business rows instead of deleting
// anything that a real user might have created while the fixtures were present.
//
// node scripts/prepare-staging-isolation-fixtures.mjs --project-ref rvldwakcwxbnqyuttzkn --business-a <staging Ahaa UUID> --branch-a <chosen manager's branch UUID>

const REF = "rvldwakcwxbnqyuttzkn";
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
function arg(name) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; }

if (process.argv.includes("--help")) {
  console.log("Prepare only: --project-ref rvldwakcwxbnqyuttzkn --business-a UUID --branch-a UUID. Outputs private setup SQL, guarded cleanup SQL, a credential-free plan and a test PDF. No network calls.");
} else {
  if (arg("--project-ref") !== REF || !uuid(arg("--business-a")) || !uuid(arg("--branch-a"))) throw new Error("Provide the exact staging project, Ahaa business UUID and chosen A manager branch UUID.");
  const config = JSON.parse(await readFile(".local-backups/environment-separation/staging-connection.json", "utf8"));
  if (config.url.replace(/\/$/, "") !== `https://${REF}.supabase.co`) throw new Error("Connection metadata is not staging.");
  const accounts = JSON.parse(await readFile(".local-backups/environment-separation/staging-test-logins.json", "utf8"));
  const admin = accounts.find(a => a.role === "CENTRAL_ADMIN");
  const employee = accounts.find(a => a.role === "BRANCH_EMPLOYEE");
  const managers = accounts.filter(a => a.role === "BRANCH_MANAGER").sort((a, b) => a.id.localeCompare(b.id));
  const manager = managers[0];
  const revoked = managers[1];
  if (![admin, employee, manager, revoked].every(a => uuid(a?.id)) || new Set([admin.id, employee.id, manager.id, revoked.id]).size !== 4) throw new Error("Four distinct staging accounts are required: admin, employee and two managers.");
  const run = randomUUID();
  const slug = `isolation-fixture-${run.slice(0, 18)}`;
  const stream = `BT /F1 12 Tf 40 740 Td (Ahaa staging isolation fixture) Tj 0 -20 Td (${run}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const original = Buffer.from(pdf);
  function business(id, branchId) {
    const receiptId = randomUUID();
    return { id, branchId, itemId: randomUUID(), orderId: randomUUID(), lineId: randomUUID(), invoiceId: null, receiptId, receiptPath: `${id}/${receiptId}/original.pdf`, categoryId: randomUUID(), unitId: randomUUID(), orderNumber: -randomInt(100000000, 2000000000) };
  }
  const a = business(arg("--business-a"), arg("--branch-a"));
  const b = business(randomUUID(), randomUUID());
  if (a.id === b.id || a.branchId === b.branchId || a.orderNumber === b.orderNumber) throw new Error("Fixture identifiers collided; regenerate.");
  const option = `Isolation fixture ${run}`;
  const manifest = {
    projectRef: REF, origin: "https://staging.aahastore.com", businesses: { a, b },
    actors: [
      { accountId: admin.id, business: "a", role: "CENTRAL_ADMIN", locationId: null },
      { accountId: employee.id, business: "b", role: "CENTRAL_ADMIN", locationId: null },
      { accountId: admin.id, business: "b", role: "BRANCH_MANAGER", locationId: b.branchId },
      { accountId: manager.id, business: "a", role: "BRANCH_MANAGER", locationId: a.branchId },
      { accountId: manager.id, business: "b", role: "BRANCH_EMPLOYEE", locationId: b.branchId },
    ], revoked: { accountId: revoked.id, business: "b" },
  };
  // The runner verifies the revoked actor's existing A workspace separately;
  // its different A branch is never reassigned to the fixture branch.
  const plan = { run, slug, option, adminA: admin.id, adminB: employee.id, managerA: manager.id, revokedAccount: revoked.id, originalSha256: createHash("sha256").update(original).digest("hex"), manifest };
  const embedded = `${literal(JSON.stringify(plan))}::jsonb`;
  const setup = `-- STAGING ONLY: disposable isolation acceptance fixture. Review target before executing.\nbegin;
create temp table fixture_result (manifest jsonb) on commit drop;
do $$
declare p jsonb := ${embedded}; aa uuid := (p->>'adminA')::uuid; bb uuid := (p->>'adminB')::uuid;
 ma uuid := (p->>'managerA')::uuid; revoked uuid := (p->>'revokedAccount')::uuid;
 a jsonb := p->'manifest'->'businesses'->'a'; b jsonb := p->'manifest'->'businesses'->'b'; x jsonb;
 ba uuid := (a->>'id')::uuid; business_b uuid := (b->>'id')::uuid; actor uuid; creator uuid; invoice uuid; result jsonb := p->'manifest'; k text; before_stock text; after_stock text;
begin
 if current_user<>'postgres' then raise exception 'Fixture setup requires staging postgres'; end if;
 if to_regprocedure('public.current_workspace()') is null then raise exception 'Isolation cutover is not installed'; end if;
 if not exists(select 1 from public.businesses where id=ba and slug='ahaa' and status='active' and isolation_ready) then raise exception 'Expected isolated staging Ahaa not found'; end if;
 if exists(select 1 from public.businesses where slug=p->>'slug' or id=business_b) then raise exception 'Fixture already exists'; end if;
 if not exists(select 1 from public.business_memberships m join public.profiles pr on pr.id=m.user_id where m.business_id=ba and m.user_id=aa and m.role::text='CENTRAL_ADMIN' and m.status::text='active' and pr.status::text='active') then raise exception 'A admin fixture unavailable'; end if;
 if not exists(select 1 from public.business_memberships m join public.profiles pr on pr.id=m.user_id where m.business_id=ba and m.user_id=ma and m.role::text='BRANCH_MANAGER' and m.status::text='active' and m.location_id=(a->>'branchId')::uuid and pr.status::text='active') then raise exception 'A manager branch does not match provided branch'; end if;
 if not exists(select 1 from public.business_memberships m join public.profiles pr on pr.id=m.user_id where m.business_id=ba and m.user_id=bb and m.role::text='BRANCH_EMPLOYEE' and m.status::text='active' and pr.status::text='active') then raise exception 'Existing staging employee unavailable'; end if;
 if not exists(select 1 from public.business_memberships m join public.profiles pr on pr.id=m.user_id where m.business_id=ba and m.user_id=revoked and m.role::text='BRANCH_MANAGER' and m.status::text='active' and pr.status::text='active') then raise exception 'Revoked-test identity lacks its valid A membership'; end if;
 select md5(coalesce(jsonb_agg(jsonb_build_array(id,available_stock) order by id)::text,'[]')) into before_stock from public.catalog_items;
 perform set_config('request.jwt.claim.sub',aa::text,true);
 perform set_config('request.headers',jsonb_build_object('x-business-id',ba)::text,true);
 insert into public.businesses(id,slug,name,status,isolation_ready) values(business_b,p->>'slug','Disposable isolation acceptance fixture','active',true);
 insert into public.locations(id,name,is_central,business_id) values((b->>'branchId')::uuid,p->>'slug',false,business_b);
 insert into public.business_memberships(business_id,user_id,role,status,location_id) values
 (business_b,bb,'CENTRAL_ADMIN','active',null),(business_b,aa,'BRANCH_MANAGER','active',(b->>'branchId')::uuid),
 (business_b,ma,'BRANCH_EMPLOYEE','active',(b->>'branchId')::uuid),(business_b,revoked,'BRANCH_MANAGER','disabled',(b->>'branchId')::uuid);
 foreach k in array array['a','b'] loop
  x:=p->'manifest'->'businesses'->k; actor:=case when k='a' then aa else bb end; creator:=case when k='a' then ma else aa end;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.headers',jsonb_build_object('x-business-id',x->>'id')::text,true);
  insert into public.catalog_categories(id,name,business_id) values((x->>'categoryId')::uuid,p->>'option',(x->>'id')::uuid);
  insert into public.catalog_units(id,name,business_id) values((x->>'unitId')::uuid,p->>'option',(x->>'id')::uuid);
  insert into public.catalog_items(id,name,category,unit_type,default_price,is_taxable,available_stock,low_stock_threshold,business_id) values((x->>'itemId')::uuid,p->>'slug',p->>'option',p->>'option',10,false,20,3,(x->>'id')::uuid);
  insert into public.orders(id,order_number,location_id,created_by,business_id) values((x->>'orderId')::uuid,(x->>'orderNumber')::integer,(x->>'branchId')::uuid,creator,(x->>'id')::uuid);
  insert into public.order_lines(id,order_id,item_id,quantity,fulfilled_quantity,unit_price,is_taxable,line_total,business_id) values((x->>'lineId')::uuid,(x->>'orderId')::uuid,(x->>'itemId')::uuid,2,2,10,false,20,(x->>'id')::uuid);
  update public.orders set status='READY' where id=(x->>'orderId')::uuid;
  if (select available_stock from public.catalog_items where id=(x->>'itemId')::uuid)<>18 then raise exception 'Fixture Ready stock deduction failed'; end if;
  perform public.submit_pickup((x->>'orderId')::uuid,jsonb_build_array(jsonb_build_object('line_id',x->>'lineId','quantity',2)),'',false);
  if not exists(select 1 from public.orders where id=(x->>'orderId')::uuid and status::text='COMPLETED') then raise exception 'Fixture canonical pickup did not complete'; end if;
  invoice:=public.create_weekly_invoice((x->>'branchId')::uuid,(now() at time zone 'America/Toronto')::date,(now() at time zone 'America/Toronto')::date,array[(x->>'orderId')::uuid]);
  perform public.send_weekly_invoice(invoice);
  result:=jsonb_set(result,array['businesses',k,'invoiceId'],to_jsonb(invoice));
  if not public.create_purchase_receipt_for_business((x->>'id')::uuid,(x->>'receiptId')::uuid,actor,'isolation-fixture.pdf',x->>'receiptPath',p->>'originalSha256','prebuilt-invoice') then raise exception 'Fixture private receipt creation failed'; end if;
 end loop;
 select md5(coalesce(jsonb_agg(jsonb_build_array(id,available_stock) order by id)::text,'[]')) into after_stock from public.catalog_items where id not in ((a->>'itemId')::uuid,(b->>'itemId')::uuid);
 if before_stock<>after_stock then raise exception 'Existing catalog stock changed during fixture setup'; end if;
 insert into fixture_result values(result);
end; $$;
select manifest from fixture_result;
commit;
`;
  const cleanup = `-- STAGING ONLY. Remove exact uploaded receipt objects separately first. Audit history is retained.\nbegin;
do $$
declare p jsonb := ${embedded}; a jsonb := p->'manifest'->'businesses'->'a'; b jsonb := p->'manifest'->'businesses'->'b'; x jsonb; k text; inv uuid; n text; expected uuid[]; unexpected boolean;
begin
 if current_user<>'postgres' or not exists(select 1 from public.businesses where id=(a->>'id')::uuid and slug='ahaa' and isolation_ready) then raise exception 'Not expected staging fixture target'; end if;
 if not exists(select 1 from public.businesses where id=(b->>'id')::uuid and slug=p->>'slug') then raise exception 'Fixture business absent or mismatched'; end if;
 if exists(select 1 from public.business_memberships where business_id=(b->>'id')::uuid and user_id not in ((p->>'adminA')::uuid,(p->>'adminB')::uuid,(p->>'managerA')::uuid,(p->>'revokedAccount')::uuid)) then raise exception 'Unexpected B member; manual review required'; end if;
 foreach k in array array['a','b'] loop
  x:=p->'manifest'->'businesses'->k;
  perform set_config('request.jwt.claim.sub',(case when k='a' then p->>'adminA' else p->>'adminB' end),true);
  perform set_config('request.headers',jsonb_build_object('x-business-id',x->>'id')::text,true);
  select weekly_invoice_id into inv from public.orders where id=(x->>'orderId')::uuid and business_id=(x->>'id')::uuid and order_number=(x->>'orderNumber')::integer;
  if inv is null then raise exception 'Fixture order/invoice absent or modified; manual review required'; end if;
  if exists(select 1 from public.orders where weekly_invoice_id=inv and id<>(x->>'orderId')::uuid)
   or exists(select 1 from public.order_lines where item_id=(x->>'itemId')::uuid and id<>(x->>'lineId')::uuid)
   or exists(select 1 from public.order_lines where order_id=(x->>'orderId')::uuid and id<>(x->>'lineId')::uuid)
   or exists(select 1 from public.pickup_requests where order_id=(x->>'orderId')::uuid)
   or exists(select 1 from public.branch_inventory_lines where item_id=(x->>'itemId')::uuid)
   or exists(select 1 from public.invoice_edits where order_id=(x->>'orderId')::uuid) then raise exception 'Fixture acquired unexpected history; manual review required'; end if;
  if exists(select 1 from public.catalog_items where business_id=(x->>'id')::uuid and (category=p->>'option' or unit_type=p->>'option') and id<>(x->>'itemId')::uuid) then raise exception 'Fixture options acquired another item; manual review required'; end if;
  if k='b' then
   foreach n in array array['locations','catalog_items','catalog_categories','catalog_units','orders','order_lines','weekly_invoices','purchase_receipts','pickup_requests','pickup_request_lines','branch_inventory_counts','branch_inventory_lines','invoice_edits','catering_events'] loop
    expected:=case n when 'locations' then array[(x->>'branchId')::uuid] when 'catalog_items' then array[(x->>'itemId')::uuid] when 'catalog_categories' then array[(x->>'categoryId')::uuid] when 'catalog_units' then array[(x->>'unitId')::uuid] when 'orders' then array[(x->>'orderId')::uuid] when 'order_lines' then array[(x->>'lineId')::uuid] when 'weekly_invoices' then array[inv] when 'purchase_receipts' then array[(x->>'receiptId')::uuid] else array[]::uuid[] end;
    execute format('select exists(select 1 from public.%I where business_id=$1 and not(id=any($2)))',n) into unexpected using (x->>'id')::uuid,expected;
    if unexpected then raise exception 'Unexpected rows in fixture business table %; manual review required',n; end if;
   end loop;
  end if;
  update public.orders set weekly_invoice_id=null where id=(x->>'orderId')::uuid;
  delete from public.weekly_invoice_publications where weekly_invoice_id=inv and business_id=(x->>'id')::uuid;
  delete from public.weekly_invoices where id=inv and business_id=(x->>'id')::uuid;
  delete from public.order_lines where id=(x->>'lineId')::uuid and order_id=(x->>'orderId')::uuid;
  delete from public.orders where id=(x->>'orderId')::uuid and business_id=(x->>'id')::uuid;
  delete from public.purchase_receipts where id=(x->>'receiptId')::uuid and business_id=(x->>'id')::uuid and file_path=x->>'receiptPath';
  delete from public.catalog_items where id=(x->>'itemId')::uuid and business_id=(x->>'id')::uuid;
  update public.catalog_categories set ever_used=false where id=(x->>'categoryId')::uuid and business_id=(x->>'id')::uuid and name=p->>'option';
  update public.catalog_units set ever_used=false where id=(x->>'unitId')::uuid and business_id=(x->>'id')::uuid and name=p->>'option';
  delete from public.catalog_categories where id=(x->>'categoryId')::uuid and business_id=(x->>'id')::uuid and name=p->>'option';
  delete from public.catalog_units where id=(x->>'unitId')::uuid and business_id=(x->>'id')::uuid and name=p->>'option';
 end loop;
 delete from public.business_memberships where business_id=(b->>'id')::uuid and user_id in ((p->>'adminA')::uuid,(p->>'adminB')::uuid,(p->>'managerA')::uuid,(p->>'revokedAccount')::uuid);
 delete from public.locations where id=(b->>'branchId')::uuid and business_id=(b->>'id')::uuid;
 delete from public.businesses where id=(b->>'id')::uuid and slug=p->>'slug';
end; $$;
commit;
`;
  const output = resolve(".local-backups/saas", `live-isolation-fixture-${run}`);
  await mkdir(output, { recursive: false });
  await writeFile(resolve(output, "setup.sql"), setup);
  await writeFile(resolve(output, "cleanup.sql"), cleanup);
  await writeFile(resolve(output, "plan.json"), JSON.stringify(plan, null, 2));
  await writeFile(resolve(output, "fixture-original.pdf"), original);
  console.log(`Prepared private fixture artifacts in ${output}. No SQL executed or files uploaded. Capture setup's final JSON row as manifest.json; invoice UUIDs are assigned by the canonical combine RPC.`);
}
