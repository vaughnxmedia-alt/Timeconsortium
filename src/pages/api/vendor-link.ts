export const prerender = false;

import type { APIRoute } from "astro";
import { requestAccessLink } from "../../lib/vendor/server";

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

export const POST: APIRoute = async ({ request, url, redirect }) => {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim();
  const result = await requestAccessLink(email, url.origin);
  if (wantsJson(request)) {
    return new Response(JSON.stringify({ saved: result.saved, message: result.message }), {
      status: result.saved ? 200 : 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
  const target = "/vendor-hub";
  return redirect(target);
};
