export const prerender = false;

import type { APIRoute } from "astro";
import { chooseOwnerPassword, signInWithPassword } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  const email = String(form?.get("email") ?? "");
  const password = String(form?.get("password") ?? "");
  if (form?.get("intent") === "choose") {
    const chosen = await chooseOwnerPassword(email, password, String(form.get("confirm") ?? ""), cookies);
    if (!chosen.ok) return redirect(`/staff?error=${encodeURIComponent(chosen.message)}`);
    return redirect("/staff");
  }
  const from = String(form?.get("from") ?? "");
  const back = from.startsWith("/") && !from.startsWith("//") ? from : "/staff";
  if (!password) {
    const target = back === "/staff" ? "/staff?error=Enter%20your%20password." : `${back}?teams=1&error=${encodeURIComponent("Enter your password.")}`;
    return redirect(target);
  }
  const signedIn = await signInWithPassword(email, password, cookies);
  if (!signedIn.ok) {
    const message = encodeURIComponent(signedIn.message);
    return redirect(back === "/staff" ? `/staff?error=${message}` : `${back}?teams=1&error=${message}`);
  }
  return redirect("/staff");
};
