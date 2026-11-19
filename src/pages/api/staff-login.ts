export const prerender = false;

import type { APIRoute } from "astro";
import { loginStaff, staffConfigured } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!staffConfigured()) return redirect("/staff/vendors");
  const form = await request.formData().catch(() => null);
  const password = String(form?.get("token") ?? "");
  const allowed = await loginStaff(cookies, password);
  return redirect(allowed ? "/staff/vendors" : "/staff/vendors?error=1");
};
