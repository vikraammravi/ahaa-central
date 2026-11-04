import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createServerClient } from "@supabase/ssr";

// Read-only acceptance AFTER the paired staging database/app cutover.
// Does not create fixtures, mutate business records, invoke Azure or send email.
// Auth sign-in is the only external state change. Existing test passwords stay
// in the ignored staging-test-logins.json file, never in the manifest or output.
//
// node scripts/test-staging-isolation.mjs --fixture .local-backups/saas/live-fixture.json
// Manifest shape (all IDs must refer to separately prepared STAGING fixtures):
// {
//   projectRef: "rvldwakcwxbnqyuttzkn", origin: "https://staging.aahastore.com",
//   businesses: {
//     a: { id, branchId, itemId, orderId, invoiceId, receiptId },
//     b: { id, branchId, itemId, orderId, invoiceId, receiptId }
//   },
//   actors: [{ accountId, business: "a", role: "CENTRAL_ADMIN", locationId: null }, ...],
//   revoked: { accountId, business: "b" }
// }
// Require an admin in EACH business, a manager and employee, and one identity
// whose role differs between businesses. Orders must be READY/COMPLETED;
// invoices must be sent and assigned to branchId; receiptId must be a private
// admin-owned receipt with an uploaded original. Revoked membership must have
// been disabled separately; its other-business membership is checked separately.
// The runner DOES NOT establish every RPC/write/transaction boundary or layout.

const STAGING_REF = "rvldwakcwxbnqyuttzkn";
const ORIGIN = "https://staging.aahastore.com";
const DATABASE_ORIGIN = `https://${STAGING_REF}.supabase.co`;
const uuid = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const roles = ["CENTRAL_ADMIN", "BRANCH_MANAGER", "BRANCH_EMPLOYEE"];

function validateFixture(fixture) {
  assert.equal(fixture.projectRef, STAGING_REF, "Fixture must target staging.");
  assert.equal(fixture.origin, ORIGIN, "Fixture must target the staging website.");
  for (const key of ["a", "b"]) {
    const business = fixture.businesses?.[key];
    for (const field of ["id", "branchId", "itemId", "orderId", "invoiceId", "receiptId"]) {
      assert.ok(uuid(business?.[field]), `Fixture ${key}.${field} must be a UUID.`);
    }
  }
  for (const field of ["id", "branchId", "itemId", "orderId", "invoiceId", "receiptId"]) {
    assert.notEqual(fixture.businesses.a[field], fixture.businesses.b[field], `Both businesses need distinct ${field} fixtures.`);
  }
  assert.ok(Array.isArray(fixture.actors) && fixture.actors.length >= 4, "Provide the role fixture matrix.");
  for (const actor of fixture.actors) {
    assert.ok(uuid(actor.accountId) && ["a", "b"].includes(actor.business) && roles.includes(actor.role), "Invalid actor fixture.");
    assert.ok(actor.role === "CENTRAL_ADMIN" ? actor.locationId === null : actor.locationId === fixture.businesses[actor.business].branchId, "Actor branch assignment does not match its fixture.");
  }
  for (const business of ["a", "b"]) assert.ok(fixture.actors.some(a => a.business === business && a.role === "CENTRAL_ADMIN"), "Each business needs an admin positive control.");
  for (const role of roles) assert.ok(fixture.actors.some(a => a.role === role), "Every business role needs an actor.");
  assert.ok(fixture.actors.some(a => fixture.actors.some(b => a.accountId === b.accountId && a.business !== b.business && a.role !== b.role)), "Provide a shared identity with different business roles.");
  assert.ok(uuid(fixture.revoked?.accountId) && ["a", "b"].includes(fixture.revoked.business), "Provide a revoked membership fixture.");
  assert.ok(!fixture.actors.some(a => a.accountId === fixture.revoked.accountId && a.business === fixture.revoked.business), "A revoked membership cannot also be an active actor.");
}

function ignoredFile(filename) {
  const base = resolve(".local-backups");
  const absolute = resolve(filename);
  const rel = relative(base, absolute);
  assert.ok(rel && !rel.startsWith("..") && !isAbsolute(rel), "Keep private fixture files inside .local-backups.");
  return absolute;
}

function publicKey(key) {
  assert.equal(typeof key, "string", "Publishable key is required.");
  if (key.startsWith("sb_publishable_")) return key;
  let payload;
  try { payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()); } catch { /* rejected below */ }
  assert.equal(payload?.role, "anon", "Use a public anon/publishable key, never a service key.");
  return key;
}

async function boundedFetch(input, init = {}) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  assert.ok([ORIGIN, DATABASE_ORIGIN].includes(url.origin), "Acceptance request escaped staging.");
  return fetch(input, { ...init, redirect: "manual", signal: init.signal ?? AbortSignal.timeout(20000) });
}

let checks = 0;
function pass(label) { checks++; console.log(`PASS: ${label}`); }
async function session(config, accounts, accountId, businessId) {
  const account = accounts.find(account => account.id === accountId);
  assert.ok(account?.email && account?.password, "Missing staging test account.");
  const jar = new Map();
  const db = createServerClient(DATABASE_ORIGIN, config.publishableKey, {
    global: { fetch: boundedFetch, headers: { "x-business-id": businessId } },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: cookies => { for (const cookie of cookies) jar.set(cookie.name, cookie.value); },
    },
  });
  const login = await db.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.ok(!login.error && login.data.user?.id === accountId, "Staging test login failed.");
  async function http(path, selectedBusiness = businessId) {
    assert.ok(path.startsWith("/api/") && !path.includes("?original=0"), "Only read-only application API probes are supported.");
    const cookies = [...jar].map(([name, value]) => `${name}=${value}`);
    cookies.push(`ahaa_business=${encodeURIComponent(selectedBusiness)}`);
    return boundedFetch(ORIGIN + path, { headers: { cookie: cookies.join("; "), origin: ORIGIN } });
  }
  async function workspaceHeader(selectedBusiness) {
    const current = await db.auth.getSession();
    assert.ok(current.data.session?.access_token, "Missing authenticated staging session.");
    return boundedFetch(`${DATABASE_ORIGIN}/rest/v1/rpc/current_workspace`, {
      method: "POST",
      headers: { apikey: config.publishableKey, authorization: `Bearer ${current.data.session.access_token}`, "content-type": "application/json", "x-business-id": selectedBusiness },
      body: "{}",
    });
  }
  return { db, http, workspaceHeader };
}

async function ownRow(db, table, id, businessId) {
  const row = await db.from(table).select("id,business_id").eq("id", id).single();
  assert.ok(!row.error && row.data?.id === id && row.data.business_id === businessId, `Own ${table} positive control failed.`);
}
async function foreignRow(db, table, id) {
  const row = await db.from(table).select("id").eq("id", id);
  assert.ok(!row.error, `Foreign ${table} probe returned a transport/schema error.`);
  assert.deepEqual(row.data, [], `Foreign ${table} row was visible.`);
}
async function denyPdf(response, label) {
  assert.ok([403, 404].includes(response.status), `${label} was not denied with an access/not-found response.`);
  assert.notEqual(response.headers.get("content-type")?.split(";")[0], "application/pdf", "Denied response contains a PDF.");
}
async function ownPdf(response) {
  assert.equal(response.status, 200, "Own invoice PDF failed.");
  assert.ok(response.headers.get("content-type")?.includes("application/pdf"), "Own invoice did not return a PDF.");
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.subarray(0, 5).equals(Buffer.from("%PDF-")), "Own PDF response is not a PDF.");
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Read-only staging acceptance: --fixture .local-backups/<fixture>.json [--validate-fixture]. See manifest contract at the top of this script. No fixtures are created automatically.");
    return;
  }
  const index = process.argv.indexOf("--fixture");
  assert.ok(index >= 0 && process.argv[index + 1], "Pass --fixture with an ignored two-business staging fixture manifest.");
  const fixture = JSON.parse(await readFile(ignoredFile(process.argv[index + 1]), "utf8"));
  validateFixture(fixture);
  if (process.argv.includes("--validate-fixture")) { console.log("Fixture structure validated. No network calls or live acceptance performed."); return; }
  const config = JSON.parse(await readFile(".local-backups/environment-separation/staging-connection.json", "utf8"));
  assert.equal(config.url.replace(/\/$/, ""), DATABASE_ORIGIN, "Connection is not pinned to staging.");
  config.publishableKey = publicKey(config.publishableKey);
  const accounts = JSON.parse(await readFile(".local-backups/environment-separation/staging-test-logins.json", "utf8"));

  for (const actor of fixture.actors) {
    const own = fixture.businesses[actor.business];
    const foreign = fixture.businesses[actor.business === "a" ? "b" : "a"];
    const { db, http, workspaceHeader } = await session(config, accounts, actor.accountId, own.id);
    const workspace = await db.rpc("current_workspace");
    assert.ok(!workspace.error && workspace.data?.business?.id === own.id, "Selected workspace did not resolve.");
    assert.equal(workspace.data.profile.id, actor.accountId, "Wrong identity resolved.");
    assert.equal(workspace.data.profile.role, actor.role, "Role inherited from another business.");
    assert.equal(workspace.data.profile.location_id, actor.locationId, "Branch inherited from another business.");
    const choices = await db.rpc("my_workspaces");
    assert.ok(!choices.error && Array.isArray(choices.data) && choices.data.some(choice => choice.business_id === own.id && choice.isolation_ready && choice.status === "active"), "Workspace chooser positive control failed.");
    if (actor.role === "BRANCH_EMPLOYEE") {
      // Employees use the scoped inventory RPC, not catalog-table access.
      const inventory = await db.rpc("branch_inventory_workspace");
      assert.ok(!inventory.error && inventory.data?.location_id === actor.locationId, "Employee inventory positive control failed.");
      assert.ok(Array.isArray(inventory.data.items) && inventory.data.items.some(item => item.id === own.itemId), "Employee inventory is missing its own fixture item.");
      assert.ok(!inventory.data.items.some(item => item.id === foreign.itemId), "Employee inventory exposed a foreign item.");
      await foreignRow(db, "catalog_items", own.itemId);
    } else {
      await ownRow(db, "locations", own.branchId, own.id);
      await ownRow(db, "catalog_items", own.itemId, own.id);
    }
    await foreignRow(db, "locations", foreign.branchId);
    await foreignRow(db, "catalog_items", foreign.itemId);
    await foreignRow(db, "orders", foreign.orderId);
    await foreignRow(db, "weekly_invoices", foreign.invoiceId);
    pass(`${actor.business}/${actor.role}: selected role, own catalog/branch and foreign data boundaries`);

    const kind = actor.role === "CENTRAL_ADMIN" ? "individual" : "combined";
    const ownId = kind === "individual" ? own.orderId : own.invoiceId;
    const foreignId = kind === "individual" ? foreign.orderId : foreign.invoiceId;
    if (actor.role === "BRANCH_EMPLOYEE") await denyPdf(await http(`/api/invoices/combined/${own.invoiceId}/pdf`), "Employee invoice");
    else await ownPdf(await http(`/api/invoices/${kind}/${ownId}/pdf`));
    await denyPdf(await http(`/api/invoices/${kind}/${foreignId}/pdf`), "Foreign invoice");
    pass(`${actor.business}/${actor.role}: invoice HTTP positive/permission controls`);

    const foreignOriginal = await http(`/api/receipts/${foreign.receiptId}?original=1`);
    assert.ok([400, 403, 404].includes(foreignOriginal.status), "Foreign original file was accessible.");
    assert.equal(foreignOriginal.headers.get("location"), null, "Foreign original returned a signed URL.");
    if (actor.role === "CENTRAL_ADMIN") {
      const original = await http(`/api/receipts/${own.receiptId}?original=1`);
      assert.equal(original.status, 307, "Own original file signing failed.");
      const location = new URL(original.headers.get("location"));
      assert.equal(location.origin, DATABASE_ORIGIN, "Signed original escaped staging storage.");
      assert.ok(location.pathname.startsWith("/storage/v1/object/sign/purchase-receipts/"), "Original did not use private signed storage.");
      const file = await boundedFetch(location);
      assert.equal(file.status, 200, "Own signed original could not be downloaded.");
      assert.ok((await file.arrayBuffer()).byteLength > 0, "Own original is empty.");
    }
    pass(`${actor.business}/${actor.role}: original-file boundary`);

    const invalid = await workspaceHeader("invalid");
    assert.equal(invalid.status, 400, "Malformed business header did not fail at the database API.");
    const badCookie = await http(`/api/invoices/${kind}/${ownId}/pdf`, "invalid");
    assert.ok([400, 403].includes(badCookie.status), "Invalid selected-business cookie did not fail closed.");
  }
  const revoked = fixture.revoked;
  const revokedBusiness = fixture.businesses[revoked.business];
  const validRevokedBusiness = fixture.businesses[revoked.business === "a" ? "b" : "a"];
  const positiveSession = await session(config, accounts, revoked.accountId, validRevokedBusiness.id);
  const positiveWorkspace = await positiveSession.db.rpc("current_workspace");
  assert.ok(!positiveWorkspace.error && positiveWorkspace.data?.business?.id === validRevokedBusiness.id, "Revoked actor lacks a valid other-business positive control.");
  const { db: deniedDb, http: deniedHttp } = await session(config, accounts, revoked.accountId, revokedBusiness.id);
  const deniedWorkspace = await deniedDb.rpc("current_workspace");
  assert.ok(deniedWorkspace.error || !deniedWorkspace.data, "Revoked membership still resolves.");
  const deniedRows = await deniedDb.from("catalog_items").select("id").eq("id", revokedBusiness.itemId);
  assert.ok(deniedRows.error || deniedRows.data?.length === 0, "Revoked membership can read business data.");
  await denyPdf(await deniedHttp(`/api/invoices/combined/${revokedBusiness.invoiceId}/pdf`), "Revoked membership invoice");
  pass("revoked membership: workspace, Data API and invoice HTTP denial");
  const anonymous = await boundedFetch(`${ORIGIN}/api/invoices/individual/${fixture.businesses.a.orderId}/pdf`);
  assert.equal(anonymous.status, 401, "Anonymous invoice access was not denied.");
  pass("anonymous invoice HTTP denial");
  console.log(`Completed ${checks} read-only staging scenario groups. This does not prove write/RPC transaction or browser-layout acceptance.`);
}

main().catch(error => { console.error(`FAIL: ${error instanceof Error ? error.message : "Acceptance check failed."}`); process.exitCode = 1; });
