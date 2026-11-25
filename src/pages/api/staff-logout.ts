export const prerender = false;

import type { APIRoute } from "astro";
import { logoutStaff } from "../../lib/backend/staff";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await logoutStaff(cookies);
  return redirect("/staff");
};
