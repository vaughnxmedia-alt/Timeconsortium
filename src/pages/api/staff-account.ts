export const prerender = false;

import type { APIRoute } from "astro";
import { updateStaffAccount } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  const photo = file instanceof File && file.size > 0 ? Buffer.from(await file.arrayBuffer()) : null;
  const result = await updateStaffAccount(cookies, {
    email: String(form?.get("email") ?? ""),
    currentPassword: String(form?.get("currentPassword") ?? ""),
    password: String(form?.get("password") ?? ""),
    confirm: String(form?.get("confirm") ?? ""),
    photo,
    removePhoto: form?.get("removePhoto") === "yes",
  });
  if (!result.ok) return redirect(`/staff/account?error=${encodeURIComponent(result.message)}`);
  return redirect("/staff/account?saved=1");
};
