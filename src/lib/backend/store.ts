import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SponsorRecord, TicketListRecord, VendorRecord } from "../vendor/server";
import { env } from "./env";

type TokenRecord = { hash: string; vendorId: string; expiresAt: string };

type DatabaseShape = {
  vendors: VendorRecord[];
  sponsors: SponsorRecord[];
  ticketList: TicketListRecord[];
  tokens: TokenRecord[];
};

export function supabaseConfigured() {
  return Boolean(env("SUPABASE_URL") && secretKey());
}

function secretKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

function admin() {
  const url = env("SUPABASE_URL");
  const key = secretKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function vendorFromRow(row: Record<string, unknown>): VendorRecord {
  return {
    id: text(row.id),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    contactName: text(row.contact_name),
    firstName: text(row.first_name),
    lastName: text(row.last_name),
    phone: text(row.phone),
    businessName: text(row.business_name),
    specialty: text(row.specialty),
    specialtyGroup: text(row.specialty_group),
    specialtyOther: text(row.specialty_other),
    email: text(row.email),
    portfolio: text(row.portfolio),
    contribution: text(row.contribution),
    status: text(row.status) as VendorRecord["status"],
    staffNotes: text(row.staff_notes),
    included: text(row.included),
    feeRequired: Boolean(row.fee_required),
    feeLabel: text(row.fee_label),
    checkoutUrl: text(row.checkout_url),
    squarePaymentLinkId: text(row.square_payment_link_id),
    squareOrderId: text(row.square_order_id),
    confirmationDeadline: text(row.confirmation_deadline),
    agreementAcceptedAt: text(row.agreement_accepted_at),
    paymentCompletedAt: text(row.payment_completed_at),
    logoUrl: text(row.logo_url),
    description: text(row.description),
    setupNeeds: text(row.setup_needs),
    published: Boolean(row.published),
    publicName: text(row.public_name),
    publicSpecialty: text(row.public_specialty),
    publicSummary: text(row.public_summary),
    publicPortfolio: text(row.public_portfolio),
    publicLogoUrl: text(row.public_logo_url),
    receiptSent: Boolean(row.receipt_sent),
    acceptanceSent: Boolean(row.acceptance_sent),
  };
}

function vendorToRow(record: VendorRecord) {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    contact_name: record.contactName,
    first_name: record.firstName || "",
    last_name: record.lastName || "",
    phone: record.phone || "",
    business_name: record.businessName,
    specialty: record.specialty,
    specialty_group: record.specialtyGroup,
    specialty_other: record.specialtyOther,
    email: record.email,
    portfolio: record.portfolio,
    contribution: record.contribution,
    status: record.status,
    staff_notes: record.staffNotes,
    included: record.included,
    fee_required: record.feeRequired,
    fee_label: record.feeLabel,
    checkout_url: record.checkoutUrl,
    square_payment_link_id: record.squarePaymentLinkId,
    square_order_id: record.squareOrderId,
    confirmation_deadline: record.confirmationDeadline,
    agreement_accepted_at: record.agreementAcceptedAt,
    payment_completed_at: record.paymentCompletedAt,
    logo_url: record.logoUrl,
    description: record.description,
    setup_needs: record.setupNeeds,
    published: record.published,
    public_name: record.publicName,
    public_specialty: record.publicSpecialty,
    public_summary: record.publicSummary,
    public_portfolio: record.publicPortfolio,
    public_logo_url: record.publicLogoUrl,
    receipt_sent: record.receiptSent,
    acceptance_sent: record.acceptanceSent,
  };
}

async function readTable(client: SupabaseClient, table: string) {
  const { data, error } = await client.from(table).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function replaceRows(
  client: SupabaseClient,
  table: string,
  key: string,
  rows: Record<string, unknown>[],
) {
  if (rows.length) {
    const { error } = await client.from(table).upsert(rows);
    if (error) throw new Error(error.message);
  }
  const { data, error } = await client.from(table).select(key);
  if (error) throw new Error(error.message);
  const keep = new Set(rows.map((row) => String(row[key])));
  const remove = ((data ?? []) as unknown as Record<string, unknown>[])
    .map((row) => String(row[key]))
    .filter((id) => !keep.has(id));
  if (!remove.length) return;
  const { error: deleteError } = await client.from(table).delete().in(key, remove);
  if (deleteError) throw new Error(deleteError.message);
}

export async function loadPrivateDatabase(): Promise<DatabaseShape> {
  const client = admin();
  if (!client) return { vendors: [], sponsors: [], ticketList: [], tokens: [] };
  const [vendors, sponsors, ticketList, tokens] = await Promise.all([
    readTable(client, "vendors"),
    readTable(client, "sponsors"),
    readTable(client, "ticket_list"),
    readTable(client, "access_tokens"),
  ]);
  return {
    vendors: vendors.map(vendorFromRow),
    sponsors: sponsors.map((row) => ({
      id: text(row.id),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at) || text(row.created_at),
      contactName: text(row.contact_name),
      firstName: text(row.first_name),
      lastName: text(row.last_name),
      phone: text(row.phone),
      organization: text(row.organization),
      eventSlug: text(row.event_slug),
      email: text(row.email),
      interest: text(row.interest) as SponsorRecord["interest"],
      message: text(row.message),
      notes: text(row.notes),
      status: (text(row.status) || "new") as SponsorRecord["status"],
      source: (text(row.source) === "staff" ? "staff" : "website") as SponsorRecord["source"],
      notified: Boolean(row.notified),
    })),
    ticketList: ticketList.map((row) => ({
      id: text(row.id),
      createdAt: text(row.created_at),
      email: text(row.email),
    })),
    tokens: tokens.map((row) => ({
      hash: text(row.hash),
      vendorId: text(row.vendor_id),
      expiresAt: text(row.expires_at),
    })),
  };
}

export type NoticeRecipient = {
  email: string;
  status: "sent" | "failed";
};

export type NoticeRecord = {
  id: string;
  createdAt: string;
  subject: string;
  body: string;
  sentCount: number;
  failedCount: number;
  recipients: NoticeRecipient[];
};

export async function loadNotices(): Promise<NoticeRecord[]> {
  const client = admin();
  if (!client) return [];
  const { data, error } = await client.from("notices").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: recipients, error: recipientError } = await client.from("notice_recipients").select("*");
  if (recipientError) throw new Error(recipientError.message);
  const byNotice = new Map<string, NoticeRecipient[]>();
  for (const row of (recipients ?? []) as unknown as Record<string, unknown>[]) {
    const noticeId = text(row.notice_id);
    const status = text(row.status) === "failed" ? "failed" : "sent";
    const current = byNotice.get(noticeId) ?? [];
    current.push({ email: text(row.email), status });
    byNotice.set(noticeId, current);
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    id: text(row.id),
    createdAt: text(row.created_at),
    subject: text(row.subject),
    body: text(row.body),
    sentCount: Number(row.sent_count) || 0,
    failedCount: Number(row.failed_count) || 0,
    recipients: byNotice.get(text(row.id)) ?? [],
  }));
}

export async function insertNotice(notice: NoticeRecord) {
  const client = admin();
  if (!client) return;
  const { error } = await client.from("notices").insert({
    id: notice.id,
    created_at: notice.createdAt,
    subject: notice.subject,
    body: notice.body,
    sent_count: notice.sentCount,
    failed_count: notice.failedCount,
  });
  if (error) throw new Error(error.message);
  if (!notice.recipients.length) return;
  const { error: recipientError } = await client.from("notice_recipients").insert(
    notice.recipients.map((recipient) => ({
      notice_id: notice.id,
      email: recipient.email,
      status: recipient.status,
    })),
  );
  if (recipientError) throw new Error(recipientError.message);
}

async function sponsorsHavePipeline(client: SupabaseClient) {
  const { error } = await client.from("sponsors").select("status").limit(1);
  return !error;
}

async function columnReady(client: SupabaseClient, table: string, column: string) {
  const { error } = await client.from(table).select(column).limit(1);
  return !error;
}

export async function savePrivateDatabase(database: DatabaseShape) {
  const client = admin();
  if (!client) return;
  const pipeline = await sponsorsHavePipeline(client);
  const vendorNames = await columnReady(client, "vendors", "first_name");
  const sponsorNames = await columnReady(client, "sponsors", "first_name");
  await replaceRows(
    client,
    "vendors",
    "id",
    database.vendors.map((record) => {
      const row = vendorToRow(record);
      if (!vendorNames) {
        delete row.first_name;
        delete row.last_name;
        delete row.phone;
      }
      return row;
    }),
  );
  await replaceRows(
    client,
    "sponsors",
    "id",
    database.sponsors.map((record) => {
      const row: Record<string, unknown> = {
        id: record.id,
        created_at: record.createdAt,
        contact_name: record.contactName,
        organization: record.organization,
        email: record.email,
        interest: record.interest,
        message: record.message,
        notified: record.notified,
      };
      if (pipeline) {
        row.status = record.status || "new";
        row.notes = record.notes || "";
        row.source = record.source || "website";
        row.updated_at = record.updatedAt || record.createdAt;
      }
      if (sponsorNames) {
        row.first_name = record.firstName || "";
        row.last_name = record.lastName || "";
        row.phone = record.phone || "";
        row.event_slug = record.eventSlug || "";
      }
      return row;
    }),
  );
  await replaceRows(
    client,
    "ticket_list",
    "id",
    database.ticketList.map((record) => ({
      id: record.id,
      created_at: record.createdAt,
      email: record.email,
    })),
  );
  await replaceRows(
    client,
    "access_tokens",
    "hash",
    database.tokens.map((record) => ({
      hash: record.hash,
      vendor_id: record.vendorId,
      expires_at: record.expiresAt,
    })),
  );
}
