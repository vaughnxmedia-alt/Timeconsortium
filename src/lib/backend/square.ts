import { randomUUID } from "node:crypto";
import { SquareClient, SquareEnvironment, WebhooksHelper } from "square";
import { env } from "./env";

export function squareConfigured() {
  return Boolean(env("SQUARE_ACCESS_TOKEN") && env("SQUARE_LOCATION_ID"));
}

function feeCents(label: string) {
  const match = label.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const dollars = Number(match[1]);
  if (!Number.isFinite(dollars) || dollars <= 0) return null;
  return BigInt(Math.round(dollars * 100));
}

function client() {
  return new SquareClient({
    token: env("SQUARE_ACCESS_TOKEN"),
    environment:
      env("SQUARE_ENVIRONMENT") === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}

export async function createVendorPaymentLink(input: {
  vendorId: string;
  businessName: string;
  feeLabel: string;
  origin: string;
}): Promise<
  | { ok: true; url: string; id: string; orderId: string }
  | { ok: false; error: string }
> {
  const amount = feeCents(input.feeLabel);
  if (amount === null || amount < 100n) {
    return {
      ok: false,
      error: "Enter the fee as a dollar amount so Square can create checkout. Nothing was sent.",
    };
  }
  try {
    const response = await client().checkout.paymentLinks.create({
      idempotencyKey: randomUUID(),
      description: `${input.businessName} participation in Reverie & Ember`,
      paymentNote: input.vendorId,
      quickPay: {
        name: "Reverie & Ember participation",
        priceMoney: { amount, currency: "USD" },
        locationId: env("SQUARE_LOCATION_ID"),
      },
      checkoutOptions: {
        redirectUrl: `${input.origin}/vendor-hub`,
      },
    });
    const link = response.paymentLink;
    const url = link?.longUrl || link?.url || "";
    if (!url.startsWith("https://") || !link?.id) {
      return { ok: false, error: "Square did not return a checkout link. Nothing was sent." };
    }
    return { ok: true, url, id: link.id, orderId: link.orderId ?? "" };
  } catch {
    return { ok: false, error: "Square could not create checkout. Nothing was sent." };
  }
}

export async function squareSignatureValid(rawBody: string, signature: string) {
  const key = env("SQUARE_WEBHOOK_SIGNATURE_KEY");
  const notificationUrl = env("SQUARE_WEBHOOK_NOTIFICATION_URL");
  if (!key || !notificationUrl || !signature) return false;
  return WebhooksHelper.verifySignature({
    requestBody: rawBody,
    signatureHeader: signature,
    signatureKey: key,
    notificationUrl,
  });
}
