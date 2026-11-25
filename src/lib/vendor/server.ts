import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../backend/env";
import { officeInbox, resendConfigured, sendBackendEmail } from "../backend/mail";
import { createVendorPaymentLink, squareConfigured } from "../backend/square";
import { loadPrivateDatabase, savePrivateDatabase, supabaseConfigured } from "../backend/store";
import { ticketSignup, vendorProgram } from "../../config/site";
import { isPreview, sponsorshipInbox } from "../presentation";
import {
  isSpecialtyGroup,
  previewProfiles,
  specialtyLabel,
  type DirectoryProfile,
} from "./specialties";

export const STATUS_LABEL = {
  submitted: "Submitted",
  under_review: "Under Review",
  accepted_pending: "Accepted — Confirmation Pending",
  confirmed: "Confirmed",
  declined: "Declined",
} as const;

export type VendorStatus = keyof typeof STATUS_LABEL;

export type VendorRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  contactName: string;
  businessName: string;
  specialty: string;
  specialtyGroup: string;
  specialtyOther: string;
  email: string;
  portfolio: string;
  contribution: string;
  status: VendorStatus;
  staffNotes: string;
  included: string;
  feeRequired: boolean;
  feeLabel: string;
  checkoutUrl: string;
  squarePaymentLinkId: string;
  squareOrderId: string;
  confirmationDeadline: string;
  agreementAcceptedAt: string;
  paymentCompletedAt: string;
  logoUrl: string;
  description: string;
  setupNeeds: string;
  published: boolean;
  publicName: string;
  publicSpecialty: string;
  publicSummary: string;
  publicPortfolio: string;
  publicLogoUrl: string;
  receiptSent: boolean;
  acceptanceSent: boolean;
};

export type SponsorInterest = "financial" | "in-kind" | "discussing";

export type SponsorRecord = {
  id: string;
  createdAt: string;
  contactName: string;
  organization: string;
  email: string;
  interest: SponsorInterest;
  message: string;
  notified: boolean;
};

export type TicketListRecord = {
  id: string;
  createdAt: string;
  email: string;
};

type AccessToken = {
  hash: string;
  vendorId: string;
  expiresAt: string;
};

type Database = {
  vendors: VendorRecord[];
  sponsors: SponsorRecord[];
  ticketList: TicketListRecord[];
  tokens: AccessToken[];
};

type CookieJar = {
  get(name: string): { value: string } | undefined;
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      path?: string;
      sameSite?: "lax" | "strict" | "none";
      maxAge?: number;
    },
  ): void;
  delete(name: string, options?: { path?: string }): void;
};

const directory = join(process.cwd(), "data", "private");
const databasePath = join(directory, "queue.json");
const secretPath = join(directory, "secret");
const LINK_DAYS = 7;
const SESSION_DAYS = 7;

let writeChain: Promise<unknown> = Promise.resolve();

function locked<T>(task: () => Promise<T>) {
  const run = writeChain.then(task, task);
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function emailConfigured() {
  return resendConfigured() || /^https:\/\//i.test(env("EMAIL_WEBHOOK_URL"));
}

export function staffConfigured() {
  return env("STAFF_ACCESS_TOKEN").length >= 16;
}

function text(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function httpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function httpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

async function signingSecret() {
  const configured = env("SIGNING_SECRET");
  if (configured.length >= 32) return configured;
  await mkdir(directory, { recursive: true });
  try {
    const existing = (await readFile(secretPath, "utf8")).trim();
    if (existing) return existing;
  } catch {
    // Create the secret below.
  }
  const created = randomBytes(32).toString("base64url");
  await writeFile(secretPath, created, { mode: 0o600 });
  return created;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function same(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function seal(payload: string, secret: string, ttlSeconds: number) {
  const body = `${payload}.${Math.floor(Date.now() / 1000) + ttlSeconds}`;
  return `${body}.${sign(body, secret)}`;
}

function openSeal(token: string, secret: string) {
  const parts = token.split(".");
  const signature = parts.pop();
  const expires = parts.pop();
  const payload = parts.join(".");
  if (!signature || !expires || !payload) return "";
  const body = `${payload}.${expires}`;
  if (!same(sign(body, secret), signature)) return "";
  if (Number(expires) * 1000 < Date.now()) return "";
  return payload;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function readDatabase(): Promise<Database> {
  if (supabaseConfigured()) {
    const loaded = await loadPrivateDatabase();
    return {
      vendors: loaded.vendors.map(normalizeVendor),
      sponsors: loaded.sponsors,
      ticketList: loaded.ticketList,
      tokens: loaded.tokens,
    };
  }
  try {
    const parsed = JSON.parse(await readFile(databasePath, "utf8")) as Database;
    return {
      vendors: Array.isArray(parsed.vendors) ? parsed.vendors.map(normalizeVendor) : [],
      sponsors: Array.isArray(parsed.sponsors) ? parsed.sponsors : [],
      ticketList: Array.isArray(parsed.ticketList) ? parsed.ticketList : [],
      tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
    };
  } catch {
    return { vendors: [], sponsors: [], ticketList: [], tokens: [] };
  }
}

async function writeDatabase(database: Database) {
  if (supabaseConfigured()) {
    await savePrivateDatabase(database);
    return;
  }
  await mkdir(directory, { recursive: true });
  const temporary = `${databasePath}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(database), { mode: 0o600 });
  await rename(temporary, databasePath);
}

function reconcile(record: VendorRecord) {
  if (record.status === "submitted" || record.status === "under_review" || record.status === "declined") {
    return record;
  }
  const ready =
    Boolean(record.agreementAcceptedAt) &&
    (!record.feeRequired || Boolean(record.paymentCompletedAt));
  record.status = ready ? "confirmed" : "accepted_pending";
  record.updatedAt = new Date().toISOString();
  return record;
}

function blankVendor(
  input: Pick<
    VendorRecord,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "contactName"
    | "businessName"
    | "specialty"
    | "specialtyGroup"
    | "specialtyOther"
    | "email"
    | "portfolio"
    | "contribution"
  >,
): VendorRecord {
  return {
    ...input,
    status: "submitted",
    staffNotes: "",
    included: "",
    feeRequired: false,
    feeLabel: "",
    checkoutUrl: "",
    squarePaymentLinkId: "",
    squareOrderId: "",
    confirmationDeadline: "",
    agreementAcceptedAt: "",
    paymentCompletedAt: "",
    logoUrl: "",
    description: "",
    setupNeeds: "",
    published: false,
    publicName: "",
    publicSpecialty: "",
    publicSummary: "",
    publicPortfolio: "",
    publicLogoUrl: "",
    receiptSent: false,
    acceptanceSent: false,
  };
}

function normalizeVendor(item: VendorRecord): VendorRecord {
  return {
    ...blankVendor({
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      contactName: item.contactName,
      businessName: item.businessName,
      specialty: item.specialty || "",
      specialtyGroup: item.specialtyGroup || "other",
      specialtyOther: item.specialtyOther || "",
      email: item.email,
      portfolio: item.portfolio,
      contribution: item.contribution,
    }),
    ...item,
    specialtyGroup: item.specialtyGroup || "other",
    specialtyOther: item.specialtyOther || "",
    squarePaymentLinkId: item.squarePaymentLinkId || "",
    squareOrderId: item.squareOrderId || "",
    published: Boolean(item.published),
    publicName: item.publicName || "",
    publicSpecialty: item.publicSpecialty || "",
    publicSummary: item.publicSummary || "",
    publicPortfolio: item.publicPortfolio || "",
    publicLogoUrl: item.publicLogoUrl || "",
  };
}

export function validateApplication(form: FormData) {
  if (text(form.get("company_website"), 200)) {
    return { error: "The request was not saved." };
  }
  const contactName = text(form.get("contactName"), 120);
  const businessName = text(form.get("businessName"), 160);
  const specialtyGroup = text(form.get("specialtyGroup"), 80);
  const specialtyOther = text(form.get("specialtyOther"), 160);
  const email = text(form.get("email"), 200).toLowerCase();
  const portfolio = text(form.get("portfolio"), 400);
  const contribution = text(form.get("contribution"), 800);
  if (!contactName || !businessName || !contribution) {
    return { error: "Check the required fields. The request was not saved." };
  }
  if (!isSpecialtyGroup(specialtyGroup)) {
    return { error: "Choose a specialty. The request was not saved." };
  }
  if (specialtyGroup === "other" && !specialtyOther) {
    return { error: "Describe your specialty. The request was not saved." };
  }
  if (!emailOk(email)) {
    return { error: "Enter a valid email address. The request was not saved." };
  }
  if (!httpUrl(portfolio)) {
    return {
      error: "Enter a portfolio or website link that starts with http:// or https://. The request was not saved.",
    };
  }
  const specialty =
    specialtyGroup === "other" ? specialtyOther : specialtyLabel(specialtyGroup);
  return {
    contactName,
    businessName,
    specialty,
    specialtyGroup,
    specialtyOther: specialtyGroup === "other" ? specialtyOther : "",
    email,
    portfolio,
    contribution,
  };
}

export function validateSponsor(form: FormData) {
  if (text(form.get("company_website"), 200)) {
    return { error: "The inquiry was not saved." };
  }
  const contactName = text(form.get("contactName"), 120);
  const organization = text(form.get("organization"), 160);
  const email = text(form.get("email"), 200).toLowerCase();
  const interest = text(form.get("interest"), 40);
  const message = text(form.get("message"), 800);
  const allowed: SponsorInterest[] = ["financial", "in-kind", "discussing"];
  if (!contactName || !organization) {
    return { error: "Check the required fields. The inquiry was not saved." };
  }
  if (!emailOk(email)) {
    return { error: "Enter a valid email address. The inquiry was not saved." };
  }
  if (!allowed.includes(interest as SponsorInterest)) {
    return { error: "Choose a sponsorship interest. The inquiry was not saved." };
  }
  return {
    contactName,
    organization,
    email,
    interest: interest as SponsorInterest,
    message,
  };
}

async function deliver(payload: Record<string, string>) {
  if (resendConfigured()) return sendBackendEmail(payload);
  const webhook = env("EMAIL_WEBHOOK_URL");
  if (!httpsUrl(webhook)) return false;
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function notifySponsor(record: SponsorRecord) {
  const inbox = sponsorshipInbox();
  const recipient = inbox.startsWith("mailto:") ? inbox.slice("mailto:".length) : officeInbox();
  if (resendConfigured() && recipient) {
    return sendBackendEmail({
      type: "sponsor-inquiry",
      to: recipient,
      id: record.id,
      contactName: record.contactName,
      organization: record.organization,
      email: record.email,
      interest: record.interest,
      message: record.message,
    });
  }
  const target = httpsUrl(inbox) ? inbox : env("EMAIL_WEBHOOK_URL");
  if (!httpsUrl(target)) return false;
  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "sponsor-inquiry",
        id: record.id,
        contactName: record.contactName,
        organization: record.organization,
        email: record.email,
        interest: record.interest,
        message: record.message,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function saveApplication(input: {
  contactName: string;
  businessName: string;
  specialty: string;
  specialtyGroup: string;
  specialtyOther: string;
  email: string;
  portfolio: string;
  contribution: string;
}) {
  const now = new Date().toISOString();
  const record = blankVendor({ id: randomBytes(8).toString("hex"), createdAt: now, updatedAt: now, ...input });
  await locked(async () => {
    const database = await readDatabase();
    database.vendors.push(record);
    await writeDatabase(database);
  });
  record.receiptSent = await deliver({
    type: "vendor-receipt",
    to: record.email,
    email: record.email,
    contactName: record.contactName,
    businessName: record.businessName,
    specialty: record.specialty,
    portfolio: record.portfolio,
    contribution: record.contribution,
    id: record.id,
  });
  if (record.receiptSent) {
    await locked(async () => {
      const database = await readDatabase();
      const saved = database.vendors.find((item) => item.id === record.id);
      if (saved) saved.receiptSent = true;
      await writeDatabase(database);
    });
  }
  return { saved: true as const, id: record.id, emailed: record.receiptSent };
}

export async function saveSponsor(input: {
  contactName: string;
  organization: string;
  email: string;
  interest: SponsorInterest;
  message: string;
}) {
  const record: SponsorRecord = {
    id: randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    notified: false,
    ...input,
  };
  record.notified = await notifySponsor(record);
  await locked(async () => {
    const database = await readDatabase();
    database.sponsors.push(record);
    await writeDatabase(database);
  });
  return { saved: true as const, emailed: record.notified };
}

export async function saveTicketListSignup(form: FormData) {
  const email = text(form.get("email"), 200).toLowerCase();
  if (!emailOk(email)) {
    return { saved: false as const, message: ticketSignup.invalidEmail, status: 400 };
  }
  if (!emailConfigured()) {
    return { saved: false as const, message: ticketSignup.unconfigured, status: 503 };
  }

  const delivered = await deliver({
    type: "ticket-list-signup",
    email,
    event: "Reverie & Ember",
    purpose: "ticket-release-notification",
  });
  if (!delivered) {
    return { saved: false as const, message: ticketSignup.failure, status: 502 };
  }

  const record: TicketListRecord = {
    id: randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    email,
  };
  try {
    await locked(async () => {
      const database = await readDatabase();
      const exists = database.ticketList.some((item) => item.email === email);
      if (!exists) database.ticketList.push(record);
      await writeDatabase(database);
    });
  } catch (error) {
    console.error(
      "Ticket list signup was emailed but not stored",
      error instanceof Error ? error.message : error,
    );
  }
  return { saved: true as const };
}

function cookieOptions(maxAge: number, path = "/") {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path,
    sameSite: "lax" as const,
    maxAge,
  };
}

export async function readReceipt(cookies: CookieJar) {
  const token = cookies.get("vendor_receipt")?.value ?? "";
  cookies.delete("vendor_receipt", { path: "/" });
  if (!token) return false;
  const secret = await signingSecret();
  const id = openSeal(token, secret);
  if (!id) return false;
  const database = await readDatabase();
  return database.vendors.some((item) => item.id === id);
}

export async function setReceipt(cookies: CookieJar, id: string) {
  const secret = await signingSecret();
  cookies.set("vendor_receipt", seal(id, secret, 60 * 10), cookieOptions(60 * 10));
}

export async function isStaff(cookies: CookieJar) {
  if (!staffConfigured()) return false;
  const token = cookies.get("staff_session")?.value ?? "";
  if (!token) return false;
  const secret = await signingSecret();
  return openSeal(token, secret) === "staff";
}

export async function loginStaff(cookies: CookieJar, password: string) {
  const expected = env("STAFF_ACCESS_TOKEN");
  if (!staffConfigured() || !same(password, expected)) return false;
  const secret = await signingSecret();
  cookies.set("staff_session", seal("staff", secret, 60 * 60 * 12), cookieOptions(60 * 60 * 12, "/"));
  return true;
}

export function logoutStaff(cookies: CookieJar) {
  cookies.delete("staff_session", { path: "/" });
}

async function issueToken(vendorId: string) {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await locked(async () => {
    const database = await readDatabase();
    database.tokens = database.tokens.filter(
      (token) => token.vendorId !== vendorId && Date.parse(token.expiresAt) > Date.now(),
    );
    database.tokens.push({ hash: hashToken(raw), vendorId, expiresAt });
    await writeDatabase(database);
  });
  return raw;
}

export async function acceptVendor(
  id: string,
  input: {
    included: string;
    feeRequired: boolean;
    feeLabel: string;
    confirmationDeadline: string;
    checkoutUrl: string;
  },
  origin: string,
) {
  const included = input.included.trim();
  if (!included) return { error: "Add what is included before accepting. Nothing was sent." };
  if (input.feeRequired && !input.feeLabel.trim()) {
    return { error: "Add the fee before accepting a paid participation. Nothing was sent." };
  }
  let checkoutUrl = input.checkoutUrl.trim();
  let squarePaymentLinkId = "";
  let squareOrderId = "";
  const existing = await getVendor(id);
  if (!existing || existing.status === "declined" || existing.status === "confirmed") {
    return { error: "That request cannot be accepted." };
  }
  if (input.feeRequired && squareConfigured()) {
    const created = await createVendorPaymentLink({
      vendorId: id,
      businessName: existing.businessName,
      feeLabel: input.feeLabel,
      origin,
    });
    if (!created.ok) return { error: created.error };
    checkoutUrl = created.url;
    squarePaymentLinkId = created.id;
    squareOrderId = created.orderId;
  } else if (checkoutUrl && !httpsUrl(checkoutUrl)) {
    return { error: "Hosted checkout must be an https link. Nothing was sent." };
  }
  const raw = await issueToken(id);
  let record: VendorRecord | undefined;
  const missing = await locked(async () => {
    const database = await readDatabase();
    record = database.vendors.find((item) => item.id === id);
    if (!record || record.status === "declined" || record.status === "confirmed") return true;
    record.included = included;
    record.feeRequired = input.feeRequired;
    record.feeLabel = input.feeRequired ? input.feeLabel.trim() : "";
    record.confirmationDeadline = input.confirmationDeadline.trim();
    record.checkoutUrl = checkoutUrl;
    record.squarePaymentLinkId = squarePaymentLinkId;
    record.squareOrderId = squareOrderId;
    record.agreementAcceptedAt = "";
    record.paymentCompletedAt = "";
    record.status = "accepted_pending";
    record.updatedAt = new Date().toISOString();
    reconcile(record);
    await writeDatabase(database);
    return false;
  });
  if (missing || !record) return { error: "That request cannot be accepted." };
  const link = `${origin}/api/vendor-access?token=${raw}`;
  const sent = await deliver({
    type: "vendor-acceptance",
    to: record.email,
    businessName: record.businessName,
    link,
  });
  if (sent) {
    await locked(async () => {
      const database = await readDatabase();
      const saved = database.vendors.find((item) => item.id === id);
      if (saved) saved.acceptanceSent = true;
      await writeDatabase(database);
    });
  }
  return { link, emailed: sent };
}

export async function updateVendor(
  id: string,
  change: (record: VendorRecord) => string | void,
) {
  return locked(async () => {
    const database = await readDatabase();
    const record = database.vendors.find((item) => item.id === id);
    if (!record) return "That request was not found.";
    const error = change(record);
    if (error) return error;
    record.updatedAt = new Date().toISOString();
    reconcile(record);
    await writeDatabase(database);
    return "";
  });
}

export async function createAccessLink(id: string, origin: string) {
  const database = await readDatabase();
  const record = database.vendors.find((item) => item.id === id);
  if (!record || (record.status !== "accepted_pending" && record.status !== "confirmed")) {
    return { error: "An access link is available after acceptance." };
  }
  const raw = await issueToken(id);
  const link = `${origin}/api/vendor-access?token=${raw}`;
  const emailed = await deliver({
    type: "vendor-access",
    to: record.email,
    businessName: record.businessName,
    link,
  });
  return { link, emailed };
}

export async function requestAccessLink(email: string, origin: string) {
  if (!emailConfigured()) {
    return {
      saved: false,
      message: "Email delivery is not configured, so a sign-in link cannot be sent.",
    };
  }
  const normalized = email.trim().toLowerCase();
  const database = await readDatabase();
  const record = database.vendors
    .filter(
      (item) =>
        item.email === normalized &&
        (item.status === "accepted_pending" || item.status === "confirmed"),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (record) {
    const raw = await issueToken(record.id);
    const sent = await deliver({
      type: "vendor-access",
      to: record.email,
      businessName: record.businessName,
      link: `${origin}/api/vendor-access?token=${raw}`,
    });
    if (!sent) return { saved: false, message: "The sign-in link was not sent." };
  }
  return {
    saved: true,
    message: "If an accepted vendor uses this email, we sent a sign-in link.",
  };
}

export async function openAccessLink(token: string, cookies: CookieJar) {
  const hash = hashToken(token);
  const vendorId = await locked(async () => {
    const database = await readDatabase();
    const found = database.tokens.find((item) => item.hash === hash);
    database.tokens = database.tokens.filter((item) => Date.parse(item.expiresAt) > Date.now());
    await writeDatabase(database);
    if (!found || Date.parse(found.expiresAt) <= Date.now()) return "";
    return found.vendorId;
  });
  if (!vendorId) return false;
  const secret = await signingSecret();
  cookies.set(
    "vendor_session",
    seal(vendorId, secret, SESSION_DAYS * 24 * 60 * 60),
    cookieOptions(SESSION_DAYS * 24 * 60 * 60),
  );
  return true;
}

export async function currentVendor(cookies: CookieJar) {
  const token = cookies.get("vendor_session")?.value ?? "";
  if (!token) return null;
  const secret = await signingSecret();
  const id = openSeal(token, secret);
  if (!id) return null;
  const database = await readDatabase();
  const record = database.vendors.find((item) => item.id === id);
  if (!record) return null;
  if (record.status !== "accepted_pending" && record.status !== "confirmed" && record.status !== "declined") {
    return null;
  }
  return publicVendor(record);
}

export function publicVendor(record: VendorRecord) {
  const eventDay = vendorProgram.eventDay;
  const released = Boolean(
    eventDay.released && (eventDay.loadIn || eventDay.parking || eventDay.setup || eventDay.contact),
  );
  const materialsComplete = Boolean(record.logoUrl && record.description && record.setupNeeds);
  return {
    id: record.id,
    businessName: record.businessName,
    status: record.status,
    statusLabel: STATUS_LABEL[record.status],
    included: record.included,
    feeRequired: record.feeRequired,
    feeLabel: record.feeLabel,
    checkoutUrl: httpsUrl(record.checkoutUrl) ? record.checkoutUrl : "",
    confirmationDeadline: record.confirmationDeadline,
    agreementAccepted: Boolean(record.agreementAcceptedAt),
    paymentComplete: Boolean(record.paymentCompletedAt),
    materialsComplete,
    logoUrl: record.logoUrl,
    description: record.description,
    setupNeeds: record.setupNeeds,
    agreement: vendorProgram.agreement,
    eventDay: {
      released,
      loadIn: released ? eventDay.loadIn : "",
      parking: released ? eventDay.parking : "",
      setup: released ? eventDay.setup : "",
      contact: released ? eventDay.contact : "",
    },
  };
}

export type VendorView = ReturnType<typeof publicVendor>;

export async function completeSquarePayment(input: { orderId: string; note: string }) {
  if (!input.orderId && !input.note) return false;
  return locked(async () => {
    const database = await readDatabase();
    const record = database.vendors.find(
      (item) =>
        (input.orderId && item.squareOrderId === input.orderId) ||
        (input.note && item.id === input.note),
    );
    if (!record || !record.feeRequired) return false;
    if (!record.paymentCompletedAt) {
      record.paymentCompletedAt = new Date().toISOString();
      reconcile(record);
      await writeDatabase(database);
    }
    return true;
  });
}

export async function recordPayment(id: string) {
  return updateVendor(id, (record) => {
    if (!record.feeRequired) return "No fee is required for this participation.";
    if (!httpsUrl(record.checkoutUrl)) {
      return "Hosted checkout is not configured, so payment cannot be recorded.";
    }
    record.paymentCompletedAt = new Date().toISOString();
  });
}

export async function vendorAction(cookies: CookieJar, form: FormData) {
  const token = cookies.get("vendor_session")?.value ?? "";
  const secret = await signingSecret();
  const id = token ? openSeal(token, secret) : "";
  if (!id) return { error: "Your session has expired. Request a new sign-in link." };
  const intent = text(form.get("intent"), 40);
  return updateVendor(id, (record) => {
    if (record.status === "declined") return "This request was declined.";
    if (record.status !== "accepted_pending" && record.status !== "confirmed") {
      return "This access page is not available yet.";
    }
    if (intent === "agreement") {
      if (text(form.get("agree"), 8) !== "yes") return "Accept the agreement to confirm participation.";
      record.agreementAcceptedAt = new Date().toISOString();
      return;
    }
    if (intent === "materials") {
      const logoUrl = text(form.get("logoUrl"), 400);
      const description = text(form.get("description"), 600);
      const setupNeeds = text(form.get("setupNeeds"), 800);
      if (!httpsUrl(logoUrl)) return "Enter an https link to the logo. The materials were not saved.";
      if (!description || !setupNeeds) return "Add the description and setup needs. The materials were not saved.";
      record.logoUrl = logoUrl;
      record.description = description;
      record.setupNeeds = setupNeeds;
      return;
    }
    return "That step was not saved.";
  });
}

export async function listQueue() {
  const database = await readDatabase();
  return {
    vendors: [...database.vendors].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    sponsors: [...database.sponsors].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
  };
}

export type VendorProfile = DirectoryProfile;

export async function listPublishedVendors(): Promise<DirectoryProfile[]> {
  const database = await readDatabase();
  return database.vendors
    .filter((item) => item.status === "confirmed" && item.published)
    .sort((a, b) => a.businessName.localeCompare(b.businessName))
    .map((item) => {
      const logoCandidate = item.publicLogoUrl.trim() || item.logoUrl.trim();
      const logo =
        httpsUrl(logoCandidate) || logoCandidate.startsWith("/")
          ? logoCandidate
          : "";
      const portfolioCandidate = item.publicPortfolio.trim() || item.portfolio.trim();
      const portfolio = httpUrl(portfolioCandidate) ? portfolioCandidate : "";
      return {
        id: item.id,
        businessName: item.publicName.trim() || item.businessName,
        specialtyGroup: item.specialtyGroup || "other",
        specialtyLabel: item.publicSpecialty.trim() || item.specialty,
        summary:
          item.publicSummary.trim() ||
          item.description.trim() ||
          item.contribution,
        portfolio,
        logoUrl: logo,
      };
    });
}

export async function listDirectoryProfiles(): Promise<{
  preview: boolean;
  profiles: DirectoryProfile[];
}> {
  const published = await listPublishedVendors();
  if (published.length > 0) {
    return { preview: false, profiles: published };
  }
  if (isPreview) {
    return { preview: true, profiles: previewProfiles };
  }
  return { preview: false, profiles: [] };
}

export async function getVendor(id: string) {
  const database = await readDatabase();
  return database.vendors.find((item) => item.id === id) ?? null;
}

export function rememberLink(cookies: CookieJar, link: string) {
  cookies.set("staff_link", link, cookieOptions(60 * 5, "/staff"));
}

export function takeLink(cookies: CookieJar) {
  const link = cookies.get("staff_link")?.value ?? "";
  cookies.delete("staff_link", { path: "/staff" });
  return link;
}

export async function setNotice(cookies: CookieJar, label: string) {
  const secret = await signingSecret();
  cookies.set("form_notice", seal(label, secret, 60 * 10), cookieOptions(60 * 10));
}

export async function readNotice(cookies: CookieJar, label: string) {
  const token = cookies.get("form_notice")?.value ?? "";
  cookies.delete("form_notice", { path: "/" });
  if (!token) return false;
  const secret = await signingSecret();
  return openSeal(token, secret) === label;
}

export function rememberVendorError(cookies: CookieJar, message: string) {
  cookies.set("vendor_error", message, cookieOptions(60 * 2));
}

export function takeVendorError(cookies: CookieJar) {
  const message = cookies.get("vendor_error")?.value ?? "";
  cookies.delete("vendor_error", { path: "/" });
  return message;
}

export function rememberError(cookies: CookieJar, message: string) {
  cookies.set("staff_error", message, cookieOptions(60 * 2, "/staff"));
}

export function takeError(cookies: CookieJar) {
  const message = cookies.get("staff_error")?.value ?? "";
  cookies.delete("staff_error", { path: "/staff" });
  return message;
}
