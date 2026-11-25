export const prerender = false;

import type { APIRoute } from "astro";
import { chooseOwnerPassword, requestStaffSignIn, signInWithPassword } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "");
  const password = String(form?.get("password") ?? "");
  if (form?.get("intent") === "choose") {
    const chosen = await chooseOwnerPassword(email, password, String(form.get("confirm") ?? ""), cookies);
    if (!chosen.ok) return redirect(`/staff?error=${encodeURIComponent(chosen.message)}`);
    return redirect("/staff");
  }
  if (password) {
    const signedIn = await signInWithPassword(email, password, cookies);
    if (!signedIn.ok) return redirect(`/staff?error=${encodeURIComponent(signedIn.message)}`);
    return redirect("/staff");
  }
  const result = await requestStaffSignIn(email, url.origin);
  if (!result.ok) return redirect(`/staff?error=${encodeURIComponent(result.message)}`);
  return redirect("/staff?sent=1");
};
