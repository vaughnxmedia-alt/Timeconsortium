export const prerender = false;

import type { APIRoute } from "astro";
import { openAccessLink } from "../../lib/vendor/server";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const token = url.searchParams.get("token") ?? "";
  const opened = token ? await openAccessLink(token, cookies) : false;
  return redirect(opened ? "/vendor-hub" : "/vendor-hub");
};
