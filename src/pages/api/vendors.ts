export const prerender = false;

import type { APIRoute } from "astro";
import { saveApplication, setReceipt, validateApplication } from "../../lib/vendor/server";

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
  if (!form) return json({ saved: false, message: "The request was not saved." }, 400);
  const parsed = validateApplication(form);
  if ("error" in parsed) {
    return wantsJson(request)
      ? json({ saved: false, message: parsed.error }, 400)
      : redirect("/vendor-hub/request?error=1#vendor-interest");
  }
  try {
    const result = await saveApplication(parsed);
    if (wantsJson(request)) return json({ saved: true }, 200);
    await setReceipt(cookies, result.id);
    return redirect("/vendor-hub/request#vendor-interest");
  } catch {
    return wantsJson(request)
      ? json({ saved: false, message: "The request was not saved." }, 500)
      : redirect("/vendor-hub/request?error=1#vendor-interest");
  }
};
