export const prerender = false;

import type { APIRoute } from "astro";
import { inviteStaff, isStaff, reissueStaffInvite, revokeStaff } from "../../lib/backend/staff";
import { rememberError, rememberLink } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const member = await isStaff(cookies);
  if (!member) return redirect("/staff");
  if (!member.passwordSet) return redirect("/staff/password");
  const form = await request.formData().catch(() => null);
  const intent = String(form?.get("intent") ?? "");
  if (intent === "revoke") {
    const result = await revokeStaff(member, String(form?.get("id") ?? ""));
    if (!result.ok) rememberError(cookies, result.message);
    return redirect("/staff/team");
  }
  if (intent === "reissue") {
    const result = await reissueStaffInvite(member, String(form?.get("id") ?? ""), url.origin);
    if (!result.ok) rememberError(cookies, result.message);
    if (result.ok) rememberLink(cookies, result.url);
    return redirect("/staff/team");
  }
  const result = await inviteStaff(member, String(form?.get("email") ?? ""), url.origin);
  if (!result.ok) rememberError(cookies, result.message);
  if (result.ok) rememberLink(cookies, result.url);
  return redirect("/staff/team");
};
