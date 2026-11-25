export const prerender = false;

import type { APIRoute } from "astro";
import { addManualOrder } from "../../lib/backend/orders";
import { isStaff } from "../../lib/backend/staff";
import { rememberError } from "../../lib/vendor/server";

function text(form: FormData, name: string, max: number) {
  return String(form.get(name) ?? "")
    .trim()
    .slice(0, max);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const member = await isStaff(cookies);
  if (!member) return redirect("/staff?next=/staff/tickets");
  if (!member.passwordSet) return redirect("/staff/password");
  const form = await request.formData().catch(() => null);
  if (!form) return redirect("/staff/tickets");
  const dollars = Number(text(form, "amount", 12).replace(/[$,]/g, ""));
  const status = text(form, "paymentStatus", 20);
  const result = await addManualOrder({
    firstName: text(form, "firstName", 60),
    lastName: text(form, "lastName", 60),
    email: text(form, "email", 200).toLowerCase(),
    phone: text(form, "phone", 30),
    quantity: Number(text(form, "quantity", 4)),
    amountCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : -1,
    paymentStatus: status === "paid" || status === "refunded" ? status : "unpaid",
    orderReference: text(form, "orderReference", 80),
    notes: text(form, "notes", 800),
    recordedBy: member.email,
  });
  if (!result.ok) rememberError(cookies, result.message);
  return redirect("/staff/tickets");
};
