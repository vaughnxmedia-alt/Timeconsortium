export const prerender = false;

import type { APIRoute } from "astro";
import { squareSignatureValid } from "../../lib/backend/square";
import { completeSquarePayment } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const trusted = await squareSignatureValid(rawBody, signature);
  if (!trusted) return new Response(null, { status: 401 });

  let event: {
    type?: string;
    data?: { object?: { payment?: { status?: string; order_id?: string; note?: string } } };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return new Response(null, { status: 400 });
  }

  const payment = event.data?.object?.payment;
  if (event.type === "payment.updated" && payment?.status === "COMPLETED") {
    await completeSquarePayment({
      orderId: payment.order_id ?? "",
      note: payment.note ?? "",
    });
  }
  return new Response(null, { status: 200 });
};
