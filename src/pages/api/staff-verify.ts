export const prerender = false;

import type { APIRoute } from "astro";
import { beginStaffVerification } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ request, redirect, url }) => {
  const form = await request.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  const result = await beginStaffVerification(token, url.origin);
  if (!result.ok) return redirect(`/staff/invite?token=${encodeURIComponent(token)}&error=1`);
  return redirect(`/staff/invite?token=${encodeURIComponent(token)}&sent=1`);
};
