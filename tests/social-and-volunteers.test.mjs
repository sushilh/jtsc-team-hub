import assert from "node:assert/strict";
import test from "node:test";
import { createCaptions, imageFilename, socialFormats } from "../lib/social-content.mjs";
import { proxyVolunteerRequest } from "../lib/volunteer-proxy.mjs";

test("captions use only supplied achievement facts, with separate platform copy", () => {
  const result = createCaptions({ name: " Lily Nitzel ", headline: "Zones qualifier", eventName: "50M BR", time: "36.59s", subline: "Central Zone" });
  for (const text of Object.values(result)) {
    assert.match(text, /Lily Nitzel/);
    assert.match(text, /Zones qualifier/);
    assert.match(text, /50M BR · 36\.59s/);
    assert.doesNotMatch(text, /undefined|null|Avery|gold medal|personal best/i);
  }
  assert.notEqual(result.instagram, result.facebook);
  assert.ok(result.instagram.length < 2200);
  const empty = createCaptions();
  assert.doesNotMatch(empty.instagram, /undefined|null|EVENT|TIME|Congratulations, !/);
  const changed = createCaptions({ name: "New swimmer", headline: "Custom milestone" });
  assert.match(changed.facebook, /Custom milestone/);
  assert.doesNotMatch(changed.instagram, /Lily/);
});

test("social exports have exact feed dimensions and unambiguous filenames", () => {
  assert.deepEqual([socialFormats.portrait.width, socialFormats.portrait.height], [1080, 1350]);
  assert.deepEqual([socialFormats.square.width, socialFormats.square.height], [1080, 1080]);
  for (const template of ["classic", "signature", "race", "finish"]) {
    assert.equal(imageFilename(" Lily Nitzel ", template, "portrait"), `lily-nitzel-${template}-instagram-feed-1080x1350.png`);
    assert.equal(imageFilename("", template, "square"), `jtsc-swimmer-${template}-facebook-feed-1080x1080.png`);
  }
});

const origin = "https://team.example";
test("volunteer reads preserve upstream data and strip unrelated credentials", async () => {
  const request = new Request(`${origin}/api/public?date=2026-09-08`, { headers: { Cookie: "sites_session=private; jtsc_admin=test", Authorization: "Bearer private" } });
  const response = await proxyVolunteerRequest(request, async (url, options) => {
    assert.equal(url, "https://jtsc-volunteer-crew.pages.dev/api/public?date=2026-09-08");
    assert.equal(options.headers.get("Cookie"), null);
    assert.equal(options.headers.get("Authorization"), null);
    return Response.json({ sessions: [{ id: 42 }], swimmers: [], activeEntries: [] });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).sessions[0].id, 42);
});

test("admin cookies remain host-only and original authorization is enforced", async () => {
  const response = await proxyVolunteerRequest(new Request(`${origin}/api/admin`, { headers: { Cookie: "sites_session=private; jtsc_admin=existing" } }), async (_url, options) => {
    assert.equal(options.headers.get("Cookie"), "jtsc_admin=existing");
    return Response.json({ error: "Sign in required" }, { status: 401, headers: { "Set-Cookie": "jtsc_admin=; Domain=jtsc-volunteer-crew.pages.dev; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0" } });
  });
  assert.equal(response.status, 401);
  assert.doesNotMatch(response.headers.get("Set-Cookie"), /Domain=/);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly; Secure; SameSite=Strict/);
});

test("check-in and admin mutations pass unchanged only to allowlisted service routes", async () => {
  for (const path of ["/api/checkins", "/api/admin", "/api/admin/login", "/api/admin/logout"]) {
    const body = JSON.stringify({ action: "example", id: 42 });
    const response = await proxyVolunteerRequest(new Request(origin + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body }), async (url, options) => {
      assert.equal(url, "https://jtsc-volunteer-crew.pages.dev" + path);
      assert.equal(options.method, "POST");
      assert.equal(options.body, body);
      return Response.json({ ok: true });
    });
    assert.equal(response.status, 200);
  }
});

test("proxy rejects foreign origins, arbitrary destinations, and unsupported methods", async () => {
  const neverFetch = () => { throw new Error("Should not contact upstream"); };
  for (const [request, status] of [
    [new Request(`${origin}/api/admin`, { method: "POST", headers: { Origin: "https://other.example" } }), 403],
    [new Request(`${origin}/api/checkins`, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } }), 403],
    [new Request(`${origin}/api/unknown`), 404],
    [new Request(`${origin}/api/public`, { method: "DELETE" }), 405],
  ]) assert.equal((await proxyVolunteerRequest(request, neverFetch)).status, status);
});

test("upstream errors are actionable JSON, never cached HTML", async () => {
  const request = new Request(`${origin}/api/public`);
  const networkFailure = await proxyVolunteerRequest(request, async () => { throw new Error("offline"); });
  assert.equal(networkFailure.status, 503);
  assert.match((await networkFailure.json()).error, /try again/i);
  const badResponse = await proxyVolunteerRequest(request, async () => new Response("unavailable", { status: 502 }));
  assert.equal(badResponse.status, 502);
  assert.equal(badResponse.headers.get("Cache-Control"), "no-store");
});
