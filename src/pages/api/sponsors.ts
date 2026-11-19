export const prerender = false;

import type { APIRoute } from "astro";
import { saveSponsor, setNotice, validateSponsor } from "../../lib/vendor/server";

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ saved: false, message: "The inquiry was not saved." }, 400);
  const parsed = validateSponsor(form);
  if ("error" in parsed) {
    return wantsJson(request)
      ? json({ saved: false, message: parsed.error }, 400)
      : redirect("/partner-with-us?error=1#sponsor-request");
  }
  try {
    const result = await saveSponsor(parsed);
    if (wantsJson(request)) return json({ saved: true }, 200);
    await setNotice(cookies, "sponsor");
    return redirect("/partner-with-us#sponsor-request");
  } catch {
    return wantsJson(request)
      ? json({ saved: false, message: "The inquiry was not saved." }, 500)
      : redirect("/partner-with-us?error=1#sponsor-request");
  }
};
