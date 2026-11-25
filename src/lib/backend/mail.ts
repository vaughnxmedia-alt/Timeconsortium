import { Resend } from "resend";
import { env } from "./env";

type Lane = "welcome" | "office";

export function resendConfigured() {
  return (
    env("RESEND_API_KEY").startsWith("re_") &&
    Boolean(env("RESEND_FROM_WELCOME")) &&
    Boolean(env("RESEND_FROM_OFFICE"))
  );
}

export function officeInbox() {
  return mailbox(env("RESEND_FROM_OFFICE"));
}

function fromAddress(lane: Lane) {
  return lane === "welcome" ? env("RESEND_FROM_WELCOME") : env("RESEND_FROM_OFFICE");
}

function mailbox(value: string) {
  const match = value.match(/<([^>]+)>/);
  const address = (match ? match[1] : value).trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address) ? address : "";
}

type Outbound = {
  lane: Lane;
  to: string[];
  subject: string;
  text: string;
  copy?: { subject: string; text: string };
};

function messageFor(payload: Record<string, string>): Outbound | null {
  const event = "Reverie & Ember";
  if (payload.type === "vendor-receipt" && payload.to) {
    return {
      lane: "office" as const,
      to: [payload.to],
      subject: `We received your request for ${event}`,
      text: [
        `Hello${payload.businessName ? ` ${payload.businessName}` : ""},`,
        "",
        `Timeless Consortium received your request to take part in ${event}.`,
        "The team will review it and follow up by email.",
      ].join("\n"),
      copy: {
        subject: `Vendor request from ${payload.businessName || payload.contactName || "a vendor"}`,
        text: [
          `A vendor request arrived for ${event}.`,
          "",
          `Business: ${payload.businessName || ""}`,
          `Contact: ${payload.contactName || ""}`,
          `Email: ${payload.email || payload.to}`,
          `Specialty: ${payload.specialty || ""}`,
          `Portfolio: ${payload.portfolio || ""}`,
          "",
          payload.contribution || "(No contribution note)",
        ].join("\n"),
      },
    };
  }
  if ((payload.type === "vendor-acceptance" || payload.type === "vendor-access") && payload.to && payload.link) {
    const accepted = payload.type === "vendor-acceptance";
    return {
      lane: "office" as const,
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
      lane: "welcome" as const,
      to: [payload.email],
      subject: `You're on the list for ${event}`,
      text: [
        `You're on the list for ${event}.`,
        "We'll email you when tickets go on sale.",
      ].join("\n"),
      copy: {
        subject: `Ticket list: ${payload.email}`,
        text: `${payload.email} asked to be notified when tickets for ${event} go on sale.`,
      },
    };
  }
  if (payload.type === "sponsor-inquiry" && payload.to) {
    return {
      lane: "office" as const,
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

async function send(resend: Resend, lane: Lane, input: { to: string[]; subject: string; text: string }) {
  const from = fromAddress(lane);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    replyTo: mailbox(from) || undefined,
    subject: input.subject,
    text: input.text,
  });
  if (error) {
    console.error("Resend could not send mail", error.message);
    return false;
  }
  return true;
}

export async function sendBackendEmail(payload: Record<string, string>) {
  const message = messageFor(payload);
  if (!message || !resendConfigured()) return false;
  const resend = new Resend(env("RESEND_API_KEY"));
  const sent = await send(resend, message.lane, message);
  const copyTo = mailbox(fromAddress(message.lane));
  if (message.copy && copyTo && !message.to.includes(copyTo)) {
    await send(resend, message.lane, { to: [copyTo], ...message.copy });
  }
  return sent;
}
