export const prerender = false;

import type { APIRoute } from "astro";
import { deleteStaff, inviteStaff, isStaff, resendStaffInvite } from "../../lib/backend/staff";
import { rememberError, rememberLink } from "../../lib/vendor/server";

function text(form: FormData | null, name: string, max: number) {
  return String(form?.get(name) ?? "")
    .trim()
    .slice(0, max);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const member = await isStaff(cookies);
  if (!member) return redirect("/staff");
  if (!member.passwordSet) return redirect("/staff/password");
  const form = await request.formData().catch(() => null);
  const intent = text(form, "intent", 20);
  if (intent === "delete") {
    const result = await deleteStaff(member, text(form, "id", 40));
    if (!result.ok) rememberError(cookies, result.message);
    return redirect("/staff/team");
  }
  if (intent === "resend") {
    const result = await resendStaffInvite(member, text(form, "id", 40), text(form, "password", 200));
    if (!result.ok) rememberError(cookies, result.message);
    else if (!result.emailed) {
      rememberError(cookies, "The invitation could not be sent from the office email.");
    } else rememberLink(cookies, "sent");
    return redirect("/staff/team");
  }
  const result = await inviteStaff(member, {
    firstName: text(form, "firstName", 60),
    lastName: text(form, "lastName", 60),
    email: text(form, "email", 200).toLowerCase(),
    phone: text(form, "phone", 30),
    password: text(form, "password", 200),
  });
  if (!result.ok) rememberError(cookies, result.message);
  else if (!result.emailed) {
    rememberError(cookies, "The account was created, but the invitation could not be sent from the office email.");
  } else rememberLink(cookies, "sent");
  return redirect("/staff/team");
};
