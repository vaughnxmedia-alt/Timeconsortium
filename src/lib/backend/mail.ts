import { Resend } from "resend";
import { env } from "./env";
import { renderLetter, type Letter } from "./letter";

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

export function welcomeInbox() {
  return mailbox(env("RESEND_FROM_WELCOME"));
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
  letter: Letter;
  copy?: { subject: string; letter: Letter };
};

function blocks(value: string) {
  return value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function messageFor(payload: Record<string, string>): Outbound | null {
  const event = "Reverie & Ember";
  const hello = payload.businessName ? `Hello ${payload.businessName},` : "Hello,";
  if (payload.type === "vendor-receipt" && payload.to) {
    return {
      lane: "office" as const,
      to: [payload.to],
      subject: `We received your request for ${event}`,
      letter: {
        heading: "We received your request.",
        paragraphs: [
          hello,
          `Timeless Consortium received your request to take part in ${event}.`,
          "The team will review it and follow up by email.",
        ],
      },
      copy: {
        subject: `Vendor request from ${payload.businessName || payload.contactName || "a vendor"}`,
        letter: {
          heading: "A vendor request arrived.",
          paragraphs: [
            `Business: ${payload.businessName || ""}`,
            `Contact: ${payload.contactName || ""}`,
            `Email: ${payload.email || payload.to}`,
            `Specialty: ${payload.specialty || ""}`,
            `Portfolio: ${payload.portfolio || ""}`,
            payload.contribution || "(No contribution note)",
          ],
        },
      },
    };
  }
  if ((payload.type === "vendor-acceptance" || payload.type === "vendor-access") && payload.to && payload.link) {
    const accepted = payload.type === "vendor-acceptance";
    return {
      lane: "office" as const,
      to: [payload.to],
      subject: accepted ? `Your ${event} participation link` : `Your ${event} sign-in link`,
      letter: {
        heading: accepted ? "Your request has been accepted." : "Your sign-in link.",
        paragraphs: [
          hello,
          accepted
            ? `Your request to take part in ${event} has been accepted. Open this link to review the details and confirm.`
            : `Use this link to return to your ${event} participation page.`,
        ],
        button: { label: accepted ? "Review and confirm" : "Open your page", href: payload.link },
        note: "This link expires in 7 days.",
      },
    };
  }
  if (payload.type === "list-notice" && payload.to && payload.subject && payload.message) {
    return {
      lane: "welcome" as const,
      to: [payload.to],
      subject: payload.subject,
      letter: {
        heading: payload.subject,
        paragraphs: blocks(payload.message),
        note:
          payload.note ||
          "You're receiving this because you asked Timeless Consortium to write when there's news about the evening.",
      },
    };
  }
  if (payload.type === "ticket-list-signup" && payload.email) {
    return {
      lane: "welcome" as const,
      to: [payload.email],
      subject: `You're on the list for ${event}`,
      letter: {
        heading: "You're on the list.",
        paragraphs: ["We'll email you when tickets go on sale."],
        button: { label: "View the evening", href: "https://www.timelessconsortium.com/" },
        note: "You asked Timeless Consortium to write when there is news about the evening.",
      },
      copy: {
        subject: `Ticket list: ${payload.email}`,
        letter: {
          heading: "Someone joined the list.",
          paragraphs: [`${payload.email} asked to be notified when tickets for ${event} go on sale.`],
        },
      },
    };
  }
  if (payload.type === "sponsor-inquiry" && payload.to) {
    return {
      lane: "office" as const,
      to: [payload.to],
      subject: `Sponsorship inquiry from ${payload.organization || payload.contactName || "a partner"}`,
      letter: {
        heading: "A sponsorship inquiry arrived.",
        paragraphs: [
          `${payload.contactName} (${payload.email}) wrote about ${payload.organization}.`,
          `Interest: ${payload.interest}`,
          payload.message || "(No message)",
        ],
      },
    };
  }
  return null;
}

async function send(resend: Resend, lane: Lane, input: { to: string[]; subject: string; letter: Letter }) {
  const from = fromAddress(lane);
  const rendered = renderLetter(input.letter);
  const { error } = await resend.emails.send({
    from,
    to: input.to,
    replyTo: mailbox(from) || undefined,
    subject: input.subject,
    html: rendered.html,
    text: rendered.text,
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
    await send(resend, message.lane, { to: [copyTo], subject: message.copy.subject, letter: message.copy.letter });
  }
  return sent;
}
