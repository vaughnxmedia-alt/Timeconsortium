export const prerender = false;

import type { APIRoute } from "astro";
import { loginStaff, staffConfigured } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  const next = form?.get("next") === "/staff/subscribers" ? "/staff/subscribers" : "/staff/vendors";
  if (!staffConfigured()) return redirect(next);
  const password = String(form?.get("token") ?? "");
  const allowed = await loginStaff(cookies, password);
  return redirect(allowed ? next : `${next}?error=1`);
};
