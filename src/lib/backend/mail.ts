import { Resend } from "resend";
import { env } from "./env";

export function resendConfigured() {
  return env("RESEND_API_KEY").startsWith("re_") && Boolean(env("RESEND_FROM"));
}

function messageFor(payload: Record<string, string>) {
  const event = "Reverie & Ember";
  if (payload.type === "vendor-receipt" && payload.to) {
    return {
      to: [payload.to],
      subject: `We received your request for ${event}`,
      text: [
        `Hello${payload.businessName ? ` ${payload.businessName}` : ""},`,
        "",
        `Timeless Consortium received your request to take part in ${event}.`,
        "The team will review it and follow up by email.",
      ].join("\n"),
    };
  }
  if ((payload.type === "vendor-acceptance" || payload.type === "vendor-access") && payload.to && payload.link) {
    const accepted = payload.type === "vendor-acceptance";
    return {
      to: [payload.to],
      subject: accepted ? `Your ${event} participation link` : `Your ${event} sign-in link`,
      text: [
        `Hello${payload.businessName ? ` ${payload.businessName}` : ""},`,
        "",
        accepted
          ? `Your request to take part in ${event} has been accepted. Open this link to review the details and confirm:`
          : `Use this link to return to your ${event} participation page:`,
        payload.link,
        "",
        "This link expires in 7 days.",
      ].join("\n"),
    };
  }
  if (payload.type === "ticket-list-signup" && payload.email) {
    return {
      to: [payload.email],
      subject: `You're on the list for ${event}`,
      text: [
        `You're on the list for ${event}.`,
        "We'll email you when tickets go on sale.",
      ].join("\n"),
    };
  }
  if (payload.type === "sponsor-inquiry" && payload.to) {
    return {
      to: [payload.to],
      subject: `Sponsorship inquiry from ${payload.organization || payload.contactName || "a partner"}`,
      text: [
        `${payload.contactName} (${payload.email}) wrote about ${payload.organization}.`,
        `Interest: ${payload.interest}`,
        "",
        payload.message || "(No message)",
      ].join("\n"),
    };
  }
  return null;
}

export async function sendBackendEmail(payload: Record<string, string>) {
  const message = messageFor(payload);
  if (!message || !resendConfigured()) return false;
  const resend = new Resend(env("RESEND_API_KEY"));
  const { error } = await resend.emails.send({
    from: env("RESEND_FROM"),
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) return false;
  const inbox = env("RESEND_INBOX");
  if (inbox && payload.type === "ticket-list-signup" && !message.to.includes(inbox)) {
    await resend.emails.send({
      from: env("RESEND_FROM"),
      to: [inbox],
      subject: `Ticket list: ${payload.email}`,
      text: `${payload.email} asked to be notified when tickets for Reverie & Ember go on sale.`,
    });
  }
  return true;
}
