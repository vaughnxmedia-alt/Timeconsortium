export const prerender = false;

import type { APIRoute } from "astro";
import { staffPhoto } from "../../lib/backend/staff";

export const GET: APIRoute = async ({ cookies }) => {
  const photo = await staffPhoto(cookies);
  if (!photo) return new Response(null, { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
