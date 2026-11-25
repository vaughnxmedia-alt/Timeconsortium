export const prerender = false;

import type { APIRoute } from "astro";
import { getDeskEvent } from "../../lib/backend/events";
import { isStaff } from "../../lib/backend/staff";
import { addStaffPartner, rememberError, updateSponsor, type SponsorStatus } from "../../lib/vendor/server";

function text(form: FormData, name: string, max: number) {
  return String(form.get(name) ?? "")
    .trim()
    .slice(0, max);
}

function statusOf(value: string): SponsorStatus {
  return value === "in_conversation" || value === "confirmed" || value === "closed" ? value : "new";
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const member = await isStaff(cookies);
  if (!member) return redirect("/staff?next=/staff/partners");
  if (!member.passwordSet) return redirect("/staff/password");
  const form = await request.formData().catch(() => null);
  if (!form) return redirect("/staff/partners");
  const intent = text(form, "intent", 20);
  if (intent === "status") {
    const result = await updateSponsor(text(form, "id", 40), {
      status: statusOf(text(form, "status", 40)),
      notes: text(form, "notes", 2000),
    });
    if (!result.ok) rememberError(cookies, result.message);
    return redirect("/staff/partners");
  }
  const email = text(form, "email", 200).toLowerCase();
  const firstName = text(form, "firstName", 60);
  const lastName = text(form, "lastName", 60);
  const phone = text(form, "phone", 30);
  const eventSlug = text(form, "eventSlug", 80);
  const digits = phone.replace(/\D/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    rememberError(cookies, "Enter a valid email address.");
    return redirect("/staff/partners");
  }
  if (!firstName || !lastName || digits.length < 7) {
    rememberError(cookies, "Add the first name, last name, and phone number.");
    return redirect("/staff/partners");
  }
  const occasion = await getDeskEvent(eventSlug);
  if (!occasion) {
    rememberError(cookies, "Choose the event they are partnering with.");
    return redirect("/staff/partners");
  }
  await addStaffPartner({
    contactName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    phone,
    organization: occasion.name,
    eventSlug: occasion.slug,
    email,
    interest: "discussing",
    message: text(form, "message", 800),
    notes: text(form, "notes", 2000),
    status: statusOf(text(form, "status", 40)),
  });
  return redirect("/staff/partners");
};
