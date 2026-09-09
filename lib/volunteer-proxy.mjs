// Keep the original Cloudflare service authoritative: no database migration or copies.
const VOLUNTEER_ORIGIN = "https://jtsc-volunteer-crew.pages.dev";
const routes = new Map([
  ["/api/public", ["GET"]],
  ["/api/checkins", ["POST"]],
  ["/api/admin", ["GET", "POST"]],
  ["/api/admin/login", ["POST"]],
  ["/api/admin/logout", ["POST"]],
]);

export async function proxyVolunteerRequest(request, fetchUpstream = fetch) {
  const url = new URL(request.url);
  const methods = routes.get(url.pathname);
  const jsonError = (error, status) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!methods) return jsonError("Not found.", 404);
  if (!methods.includes(request.method)) return jsonError("Method not allowed.", 405);
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if ((origin && origin !== url.origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") {
      return jsonError("Please submit this form from the JTSC website.", 403);
    }
  }
  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  // Never send Sites sign-in cookies or authorization credentials to the volunteer service.
  const adminCookie = request.headers.get("Cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith("jtsc_admin="));
  if (adminCookie && url.pathname.startsWith("/api/admin")) headers.set("Cookie", adminCookie);
  try {
    const response = await fetchUpstream(`${VOLUNTEER_ORIGIN}${url.pathname}${url.search}`, {
      method: request.method,
      headers,
      body: request.method === "GET" ? undefined : await request.text(),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.headers.get("Content-Type")?.includes("application/json")) {
      return jsonError("The volunteer service is temporarily unavailable. Please try again.", 502);
    }
    const outputHeaders = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
    const cookie = response.headers.get("Set-Cookie");
    if (cookie?.startsWith("jtsc_admin=")) {
      // A host-only cookie makes admin login work on this combined site's origin.
      outputHeaders.set("Set-Cookie", cookie.replace(/;\s*Domain=[^;]+/ig, ""));
    }
    return new Response(response.body, { status: response.status, headers: outputHeaders });
  } catch {
    return jsonError("Cannot reach the volunteer service. Please try again shortly.", 503);
  }
}
