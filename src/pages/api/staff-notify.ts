export const prerender = false;

import type { APIRoute } from "astro";
import { isStaff, notifySubscribers, rememberError } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await isStaff(cookies))) return redirect("/staff/subscribers");
  const form = await request.formData().catch(() => null);
  if (!form || form.get("confirm") !== "yes") {
    rememberError(cookies, "Confirm that this note should go to everyone on the list.");
    return redirect("/staff/subscribers");
  }

  const result = await notifySubscribers(String(form.get("subject") ?? ""), String(form.get("message") ?? ""));
  if (!result.ok) {
    rememberError(cookies, result.message);
    return redirect("/staff/subscribers");
  }
  return redirect(`/staff/subscribers?sent=${result.sent}&failed=${result.failed}`);
};
