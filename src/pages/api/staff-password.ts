export const prerender = false;

import type { APIRoute } from "astro";
import { setStaffPassword } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  const result = await setStaffPassword(
    cookies,
    String(form?.get("password") ?? ""),
    String(form?.get("confirm") ?? ""),
  );
  if (!result.ok) return redirect(`/staff/password?error=${encodeURIComponent(result.message)}`);
  return redirect("/staff");
};
