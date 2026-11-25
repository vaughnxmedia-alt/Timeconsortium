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
      contactName: text(row.contact_name),
      organization: text(row.organization),
      email: text(row.email),
      interest: text(row.interest) as SponsorRecord["interest"],
      message: text(row.message),
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

export async function savePrivateDatabase(database: DatabaseShape) {
  const client = admin();
  if (!client) return;
  await replaceRows(client, "vendors", "id", database.vendors.map(vendorToRow));
  await replaceRows(
    client,
    "sponsors",
    "id",
    database.sponsors.map((record) => ({
      id: record.id,
      created_at: record.createdAt,
      contact_name: record.contactName,
      organization: record.organization,
      email: record.email,
      interest: record.interest,
      message: record.message,
      notified: record.notified,
    })),
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
