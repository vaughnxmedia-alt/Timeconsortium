export const prerender = false;

import type { APIRoute } from "astro";
import { squareSignatureValid } from "../../lib/backend/square";
import { recordSquareTicket } from "../../lib/backend/orders";
import { completeSquarePayment } from "../../lib/vendor/server";

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") ?? "";
  const trusted = await squareSignatureValid(rawBody, signature);
  if (!trusted) return new Response(null, { status: 401 });

  let event: {
    type?: string;
    data?: {
      object?: {
        payment?: {
          id?: string;
          status?: string;
          order_id?: string;
          note?: string;
          amount_money?: { amount?: number };
        };
      };
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return new Response(null, { status: 400 });
  }

  const payment = event.data?.object?.payment;
  if (event.type === "payment.updated" && payment?.status === "COMPLETED") {
    const note = payment.note ?? "";
    if (note.startsWith("ticket:")) {
      await recordSquareTicket({
        paymentId: payment.id ?? "",
        orderId: payment.order_id ?? "",
        note,
        amountCents: Number(payment.amount_money?.amount ?? 0),
        status: payment.status,
      });
    } else {
      await completeSquarePayment({
        orderId: payment.order_id ?? "",
        note,
      });
    }
  }
  return new Response(null, { status: 200 });
};
