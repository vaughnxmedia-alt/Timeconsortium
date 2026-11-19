export const prerender = false;

import type { APIRoute } from "astro";
import { rememberVendorError, vendorAction } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData().catch(() => null);
  if (!form) return redirect("/vendor-hub#participation");
  const error = await vendorAction(cookies, form);
  if (error) {
    rememberVendorError(cookies, error);
    return redirect("/vendor-hub#participation");
  }
  return redirect("/vendor-hub#participation");
};
