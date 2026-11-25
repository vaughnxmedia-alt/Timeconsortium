import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseTicketNote, summarizeTickets } from "../src/lib/backend/ticket-math.mjs";

const base = process.env.BASE || "http://127.0.0.1:4323";
const root = process.cwd();
let failed = 0;

function assert(name, condition) {
  if (!condition) {
    failed += 1;
    console.error(`FAIL ${name}`);
    return;
  }
  console.log(`ok ${name}`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

const jar = new Map();

function storeCookies(response) {
  const headers = response.headers.getSetCookie?.() || [];
  for (const header of headers) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader() {
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function post(path, fields) {
  const body = new URLSearchParams(fields);
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body,
    redirect: "manual",
  });
  storeCookies(response);
  return response;
}

async function get(path) {
  const response = await fetch(`${base}${path}`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  storeCookies(response);
  return response;
}

assert("ticket note parses a quantity", parseTicketNote("ticket:2") === 2);
assert("vendor note is not a ticket sale", parseTicketNote("vendor-id") === null);
const summary = summarizeTickets([
  { paymentStatus: "paid", source: "square", quantity: 2, amountCents: 5000 },
  { paymentStatus: "paid", source: "manual", quantity: 1, amountCents: 2500 },
  { paymentStatus: "unpaid", source: "manual", quantity: 4, amountCents: 9000 },
]);
assert("paid square and manual tickets add", summary.ticketsSold === 3 && summary.revenueCents === 7500);
assert("unpaid orders stay out of the total", summary.manualTickets === 1 && summary.squareTickets === 2);

const before = await readJson(join(root, "data/private/staff.json"));
const beforeCount = before.members.length;
const unknown = await post("/api/staff-login", { email: "nobody@example.com" });
assert("unknown email gets the same reply", unknown.status === 302 && unknown.headers.get("location")?.includes("sent=1"));
const after = await readJson(join(root, "data/private/staff.json"));
assert("unknown email creates no account", after.members.length === beforeCount);

const login = await post("/api/staff-login", { email: before.members.find((item) => item.role === "owner").email });
assert("owner sign-in is accepted", login.status === 302);
const outbox = await readJson(join(root, "data/private/staff-outbox.json"));
const loginUrl = new URL(outbox.links.at(-1).url);
const entered = await get(`${loginUrl.pathname}${loginUrl.search}`);
assert("sign-in link opens the password prompt", entered.status === 302 && (entered.headers.get("location") || "").includes("/staff/password"));
const prompt = await get("/staff/password");
const promptHtml = await prompt.text();
assert("owner is asked to choose a password", prompt.status === 200 && promptHtml.includes("Choose a password") && !/sign up/i.test(promptHtml));
const chosen = await post("/api/staff-password", { password: "local-test-pass", confirm: "local-test-pass" });
assert("a password can be saved", chosen.status === 302 && (chosen.headers.get("location") || "").endsWith("/staff"));
const home = await get("/staff");
const homeHtml = await home.text();
assert("signed-in Teams has no signup", home.status === 200 && !/sign up/i.test(homeHtml) && homeHtml.includes("Tickets"));

const invite = await post("/api/staff-team", { email: "guest.team@example.com" });
assert("invitation is created", invite.status === 302);
const team = await get("/staff/team");
const teamHtml = await team.text();
const inviteLink = teamHtml.match(/value="(http[^"]+\/staff\/invite\?token=[^"]+)"/);
assert("invitation link is shown once", Boolean(inviteLink));
const inviteUrl = new URL(inviteLink[1].replaceAll("&amp;", "&"));
const invitePage = await get(`${inviteUrl.pathname}${inviteUrl.search}`);
const inviteHtml = await invitePage.text();
assert("invitation asks for inbox confirmation", inviteHtml.includes("Email me a confirmation link"));
const verify = await post("/api/staff-verify", { token: inviteUrl.searchParams.get("token") });
assert("verification was requested", verify.status === 302);
const verifyOutbox = await readJson(join(root, "data/private/staff-outbox.json"));
const verifyUrl = new URL(verifyOutbox.links.at(-1).url);
const ownerCookie = cookieHeader();
jar.clear();
const activated = await get(`${verifyUrl.pathname}${verifyUrl.search}`);
assert("inbox link activates access", activated.status === 302);
const again = await get(`${verifyUrl.pathname}${verifyUrl.search}`);
const againHtml = await again.text();
assert("used link fails", again.status === 200 && againHtml.includes("no longer valid"));

jar.clear();
const deskForExpiry = await readJson(join(root, "data/private/staff.json"));
const { createHash } = await import("node:crypto");
const expiredToken = "expired-token-value";
deskForExpiry.links.push({
  id: "expired-link",
  memberId: deskForExpiry.members[0].id,
  purpose: "login",
  tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
  expiresAt: new Date(Date.now() - 60_000).toISOString(),
  usedAt: "",
  createdAt: new Date().toISOString(),
});
await writeFile(join(root, "data/private/staff.json"), JSON.stringify(deskForExpiry, null, 2));
const stale = await get(`/staff/enter?token=${expiredToken}`);
const staleHtml = await stale.text();
assert("expired link fails", stale.status === 200 && staleHtml.includes("no longer valid"));

jar.clear();
const restored = ownerCookie.split("; ").filter(Boolean);
for (const pair of restored) {
  const eq = pair.indexOf("=");
  jar.set(pair.slice(0, eq), pair.slice(eq + 1));
}
const member = (await readJson(join(root, "data/private/staff.json"))).members.find(
  (item) => item.email === "guest.team@example.com",
);
const revoked = await post("/api/staff-team", { intent: "revoke", id: member.id });
assert("owner can revoke access", revoked.status === 302);
const revokedDesk = await readJson(join(root, "data/private/staff.json"));
const revokedMember = revokedDesk.members.find((item) => item.id === member.id);
assert("revoked member is marked", revokedMember.status === "revoked");
const guestSession = revokedDesk.sessions.find((item) => item.memberId === member.id && item.revokedAt);
assert("revoked sessions are closed", Boolean(guestSession));

const ordersPath = join(root, "data/private/ticket-orders.json");
await writeFile(
  ordersPath,
  JSON.stringify({
    orders: [
      {
        id: "square1",
        createdAt: new Date().toISOString(),
        guestName: "",
        email: "",
        quantity: 2,
        amountCents: 8000,
        currency: "USD",
        paymentStatus: "paid",
        orderReference: "sq-1",
        source: "square",
        squarePaymentId: "pay-1",
        squareOrderId: "ord-1",
        notes: "",
        recordedBy: "",
      },
    ],
  }),
);
const analytics = await get("/staff/analytics");
const analyticsHtml = await analytics.text();
assert("analytics adds the Square sale", analyticsHtml.includes("Square 2") && analyticsHtml.includes("$80.00"));
assert("analytics keeps the waitlist separate", analyticsHtml.includes("This is not a ticket purchase."));

const webhook = await fetch(`${base}/api/square-webhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    type: "payment.updated",
    data: { object: { payment: { id: "pay-2", status: "COMPLETED", note: "ticket:3", amount_money: { amount: 100 } } } },
  }),
});
assert("unsigned Square event is refused", webhook.status === 401);

const ticket = await fetch(`${base}/api/ticket-signup`, {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ email: "guest.list@example.com" }),
});
const ticketBody = await ticket.json();
assert("public ticket form still saves", ticket.status === 200 && ticketBody.saved === true);

const vendor = await fetch(`${base}/api/vendors`, {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    contactName: "Ada Maker",
    businessName: "Example Atelier",
    specialtyGroup: "design-decor",
    email: "maker@example.com",
    portfolio: "https://example.com",
    contribution: "Tables and candlelight.",
  }),
});
const vendorBody = await vendor.json();
assert("public vendor form still saves", vendor.status === 200 && vendorBody.saved === true);

const sponsor = await fetch(`${base}/api/sponsors`, {
  method: "POST",
  headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    contactName: "Ira Partner",
    organization: "Example House",
    email: "partner@example.com",
    interest: "financial",
    message: "We would like to talk.",
  }),
});
const sponsorBody = await sponsor.json();
assert("public partner form still saves", sponsor.status === 200 && sponsorBody.saved === true);

if (failed) process.exit(1);
console.log("staff access checks passed");
