export const prerender = false;

import type { APIRoute } from "astro";
import { saveTicketListSignup } from "../../lib/vendor/server";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return json({ saved: false, message: "We could not complete your signup. Please try again." }, 400);

  const result = await saveTicketListSignup(form);
  if (!result.saved) {
    return json({ saved: false, message: result.message }, result.status);
  }
  return json({ saved: true }, 200);
};
