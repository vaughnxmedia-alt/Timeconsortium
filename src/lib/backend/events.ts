import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { event } from "../../config/site";
import { env } from "./env";
import { supabaseConfigured } from "./store";

export type DeskEvent = {
  id: string;
  slug: string;
  name: string;
  dateISO: string;
  dateLabel: string;
  venue: string;
  builtin: boolean;
};

const path = join(process.cwd(), "data", "private", "events.json");
const reserved = "reverie-and-ember";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function admin() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function canonicalEvent(): DeskEvent {
  return {
    id: reserved,
    slug: reserved,
    name: event.name,
    dateISO: event.dateISO,
    dateLabel: "March 20, 2027",
    venue: event.venue,
    builtin: true,
  };
}

function dateLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  }).format(new Date(`${iso}T12:00:00`));
}

export function eventSlug(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function fromRow(row: Record<string, unknown>): DeskEvent {
  const iso = text(row.event_date).slice(0, 10);
  return {
    id: text(row.id),
    slug: text(row.slug),
    name: text(row.name),
    dateISO: iso,
    dateLabel: dateLabel(iso),
    venue: text(row.venue),
    builtin: false,
  };
}

async function readFileEvents() {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as { events?: DeskEvent[] };
    return Array.isArray(parsed.events) ? parsed.events.filter((item) => item.slug && item.slug !== reserved) : [];
  } catch {
    return [];
  }
}

async function writeFileEvents(events: DeskEvent[]) {
  await mkdir(join(process.cwd(), "data", "private"), { recursive: true });
  await writeFile(path, JSON.stringify({ events }, null, 2));
}

async function readSupabaseEvents(client: SupabaseClient) {
  const { data, error } = await client.from("staff_events").select("*").order("created_at");
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map(fromRow).filter((item) => item.slug !== reserved);
}

export async function listDeskEvents() {
  const client = admin();
  const added = client && supabaseConfigured() ? await readSupabaseEvents(client) : await readFileEvents();
  return [canonicalEvent(), ...added];
}

export async function getDeskEvent(slug: string) {
  const events = await listDeskEvents();
  return events.find((item) => item.slug === slug) ?? null;
}

export async function addDeskEvent(input: { name: string; date: string; venue: string }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const venue = input.venue.trim().replace(/\s+/g, " ");
  const date = input.date.trim();
  if (name.length < 2 || name.length > 80) return { ok: false as const, message: "Enter an event name." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00`))) {
    return { ok: false as const, message: "Enter the event date." };
  }
  if (venue.length < 2 || venue.length > 120) return { ok: false as const, message: "Enter the venue." };
  const slug = eventSlug(name);
  if (!slug || slug === reserved) return { ok: false as const, message: "Choose a different event name." };
  const existing = await listDeskEvents();
  if (existing.some((item) => item.slug === slug)) {
    return { ok: false as const, message: "An event with that name is already on the desk." };
  }
  const record: DeskEvent = {
    id: randomBytes(8).toString("hex"),
    slug,
    name,
    dateISO: date,
    dateLabel: dateLabel(date),
    venue,
    builtin: false,
  };
  const client = admin();
  if (client && supabaseConfigured()) {
    const { error } = await client.from("staff_events").insert({
      id: record.id,
      slug: record.slug,
      name: record.name,
      event_date: record.dateISO,
      venue: record.venue,
      created_at: new Date().toISOString(),
    });
    if (error) return { ok: false as const, message: "The event could not be added." };
    return { ok: true as const, slug };
  }
  const events = await readFileEvents();
  events.push(record);
  await writeFileEvents(events);
  return { ok: true as const, slug };
}
