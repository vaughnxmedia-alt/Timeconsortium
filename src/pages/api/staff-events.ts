export const prerender = false;

import type { APIRoute } from "astro";
import { addDeskEvent } from "../../lib/backend/events";
import { isStaff } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const member = await isStaff(cookies);
  if (!member) return redirect("/staff?next=/staff/events");
  if (!member.passwordSet) return redirect("/staff/password");
  const form = await request.formData().catch(() => null);
  const result = await addDeskEvent({
    name: String(form?.get("name") ?? ""),
    date: String(form?.get("date") ?? ""),
    venue: String(form?.get("venue") ?? ""),
  });
  if (!result.ok) return redirect(`/staff/events?error=${encodeURIComponent(result.message)}`);
  return redirect(`/staff/events/${result.slug}`);
};
