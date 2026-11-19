export const prerender = false;

import type { APIRoute } from "astro";
import { logoutStaff } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  logoutStaff(cookies);
  return redirect("/staff/vendors");
};
