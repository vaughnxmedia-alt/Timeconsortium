import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { squareConfigured } from "./square";
import { supabaseConfigured } from "./store";
import { parseTicketNote, summarizeTickets } from "./ticket-math.mjs";

export type TicketOrder = {
  id: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  guestName: string;
  email: string;
  phone: string;
  quantity: number;
  amountCents: number;
  currency: "USD";
  paymentStatus: "unpaid" | "paid" | "refunded";
  orderReference: string;
  source: "manual" | "square";
  squarePaymentId: string;
  squareOrderId: string;
  notes: string;
  recordedBy: string;
};

const path = join(process.cwd(), "data", "private", "ticket-orders.json");

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(task: () => Promise<T>) {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function joinName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function normalizeOrder(order: Partial<TicketOrder>): TicketOrder {
  const split = splitName(order.guestName || "");
  const firstName = order.firstName || split.firstName;
  const lastName = order.lastName || split.lastName;
  const status = order.paymentStatus;
  return {
    id: order.id || "",
    createdAt: order.createdAt || "",
    firstName,
    lastName,
    guestName: order.guestName || joinName(firstName, lastName),
    email: order.email || "",
    phone: order.phone || "",
    quantity: Number(order.quantity) || 0,
    amountCents: Number(order.amountCents) || 0,
    currency: "USD",
    paymentStatus: status === "paid" || status === "refunded" ? status : "unpaid",
    orderReference: order.orderReference || "",
    source: order.source === "square" ? "square" : "manual",
    squarePaymentId: order.squarePaymentId || "",
    squareOrderId: order.squareOrderId || "",
    notes: order.notes || "",
    recordedBy: order.recordedBy || "",
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function admin() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function fromRow(row: Record<string, unknown>): TicketOrder {
  const status = text(row.payment_status);
  const source = text(row.source) === "square" ? "square" : "manual";
  const split = splitName(text(row.guest_name));
  const firstName = text(row.first_name) || split.firstName;
  const lastName = text(row.last_name) || split.lastName;
  return {
    id: text(row.id),
    createdAt: text(row.created_at),
    firstName,
    lastName,
    guestName: text(row.guest_name) || joinName(firstName, lastName),
    email: text(row.email),
    phone: text(row.phone),
    quantity: Number(row.quantity) || 0,
    amountCents: Number(row.amount_cents) || 0,
    currency: "USD",
    paymentStatus: status === "paid" || status === "refunded" ? status : "unpaid",
    orderReference: text(row.order_reference),
    source,
    squarePaymentId: text(row.square_payment_id),
    squareOrderId: text(row.square_order_id),
    notes: text(row.notes),
    recordedBy: text(row.recorded_by),
  };
}

function toRow(order: TicketOrder, names: boolean) {
  const row: Record<string, unknown> = {
    id: order.id,
    created_at: order.createdAt,
    guest_name: order.guestName,
    email: order.email,
    quantity: order.quantity,
    amount_cents: order.amountCents,
    currency: order.currency,
    payment_status: order.paymentStatus,
    order_reference: order.orderReference,
    source: order.source,
    square_payment_id: order.squarePaymentId,
    square_order_id: order.squareOrderId,
    notes: order.notes,
    recorded_by: order.recordedBy,
  };
  if (names) {
    row.first_name = order.firstName;
    row.last_name = order.lastName;
    row.phone = order.phone;
  }
  return row;
}

async function readOrders(client: SupabaseClient | null) {
  if (client && supabaseConfigured()) {
    const { data, error } = await client.from("ticket_orders").select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Record<string, unknown>[]).map(fromRow);
  }
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as { orders?: TicketOrder[] };
    return Array.isArray(parsed.orders) ? parsed.orders.map((order) => normalizeOrder(order)) : [];
  } catch {
    return [];
  }
}

async function writeOrders(client: SupabaseClient | null, orders: TicketOrder[]) {
  if (client && supabaseConfigured()) {
    const { error: probe } = await client.from("ticket_orders").select("first_name").limit(1);
    const names = !probe;
    if (orders.length) {
      const { error } = await client.from("ticket_orders").upsert(orders.map((order) => toRow(order, names)));
      if (error) throw new Error(error.message);
    }
    const { data, error } = await client.from("ticket_orders").select("id");
    if (error) throw new Error(error.message);
    const keep = new Set(orders.map((order) => order.id));
    const remove = ((data ?? []) as Record<string, unknown>[])
      .map((row) => text(row.id))
      .filter((id) => !keep.has(id));
    if (remove.length) {
      const { error: deleteError } = await client.from("ticket_orders").delete().in("id", remove);
      if (deleteError) throw new Error(deleteError.message);
    }
    return;
  }
  await mkdir(join(process.cwd(), "data", "private"), { recursive: true });
  await writeFile(path, JSON.stringify({ orders }, null, 2));
}

export async function listTicketOrders() {
  const orders = await readOrders(admin());
  return orders.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function ticketSummary(orders: TicketOrder[]) {
  return summarizeTickets(orders);
}

export async function addManualOrder(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  quantity: number;
  amountCents: number;
  paymentStatus: TicketOrder["paymentStatus"];
  orderReference: string;
  notes: string;
  recordedBy: string;
}) {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName || !lastName || !input.email || !input.orderReference) {
    return { ok: false as const, message: "Add the first name, last name, email, and order reference." };
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) {
    return { ok: false as const, message: "Enter a quantity from 1 to 100." };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    return { ok: false as const, message: "Enter the amount in dollars." };
  }
  const order: TicketOrder = {
    id: randomBytes(8).toString("hex"),
    createdAt: new Date().toISOString(),
    firstName,
    lastName,
    guestName: joinName(firstName, lastName),
    email: input.email,
    phone: input.phone.trim(),
    quantity: input.quantity,
    amountCents: input.amountCents,
    currency: "USD",
    paymentStatus: input.paymentStatus,
    orderReference: input.orderReference,
    source: "manual",
    squarePaymentId: "",
    squareOrderId: "",
    notes: input.notes,
    recordedBy: input.recordedBy,
  };
  await locked(async () => {
    const client = admin();
    const orders = await readOrders(client);
    orders.push(order);
    await writeOrders(client, orders);
  });
  return { ok: true as const };
}

export async function recordSquareTicket(input: {
  paymentId: string;
  orderId: string;
  note: string;
  amountCents: number;
  status: string;
}) {
  if (input.status !== "COMPLETED") return false;
  const quantity = parseTicketNote(input.note);
  if (!quantity || !input.paymentId) return false;
  const amount = Number(input.amountCents);
  if (!Number.isInteger(amount) || amount < 0) return false;
  await locked(async () => {
    const client = admin();
    const orders = await readOrders(client);
    const existing = orders.find((order) => order.squarePaymentId === input.paymentId);
    if (existing) {
      existing.quantity = quantity;
      existing.amountCents = amount;
      existing.paymentStatus = "paid";
      existing.squareOrderId = input.orderId || existing.squareOrderId;
      await writeOrders(client, orders);
      return;
    }
    orders.push({
      id: randomBytes(8).toString("hex"),
      createdAt: new Date().toISOString(),
      firstName: "",
      lastName: "",
      guestName: "",
      email: "",
      phone: "",
      quantity,
      amountCents: amount,
      currency: "USD",
      paymentStatus: "paid",
      orderReference: input.orderId || input.paymentId,
      source: "square",
      squarePaymentId: input.paymentId,
      squareOrderId: input.orderId,
      notes: "",
      recordedBy: "",
    });
    await writeOrders(client, orders);
  });
  return true;
}

export async function refreshSquareTickets() {
  if (!squareConfigured()) return { ok: false as const, message: "Square is not connected." };
  const host =
    env("SQUARE_ENVIRONMENT") === "production"
      ? "https://connect.squareup.com"
      : "https://connect.squareupsandbox.com";
  const response = await fetch(
    `${host}/v2/payments?location_id=${encodeURIComponent(env("SQUARE_LOCATION_ID"))}`,
    {
      headers: {
        Authorization: `Bearer ${env("SQUARE_ACCESS_TOKEN")}`,
        "Square-Version": "2025-01-23",
      },
    },
  );
  if (!response.ok) return { ok: false as const, message: "Square did not return ticket payments." };
  const body = (await response.json()) as {
    payments?: { id?: string; order_id?: string; note?: string; status?: string; amount_money?: { amount?: number } }[];
  };
  let saved = 0;
  for (const payment of body.payments ?? []) {
    const recorded = await recordSquareTicket({
      paymentId: payment.id ?? "",
      orderId: payment.order_id ?? "",
      note: payment.note ?? "",
      amountCents: Number(payment.amount_money?.amount ?? 0),
      status: payment.status ?? "",
    });
    if (recorded) saved += 1;
  }
  return { ok: true as const, saved };
}
