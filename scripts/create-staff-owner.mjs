import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const email = process.argv.find((arg) => arg.includes("@"))?.trim().toLowerCase() ?? "";
const remote = process.argv.includes("--remote");
const file = process.argv.includes("--file") || !remote;

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
  console.error("Usage: node scripts/create-staff-owner.mjs --file owner@example.com");
  console.error("Add --remote only after the staff migration is applied. This script is not a website route.");
  process.exit(1);
}

const member = {
  id: randomBytes(8).toString("hex"),
  email,
  role: "owner",
  status: "active",
  passwordHash: "",
  createdAt: new Date().toISOString(),
  activatedAt: new Date().toISOString(),
  revokedAt: "",
};

if (remote) {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) {
    console.error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in the environment for --remote.");
    process.exit(1);
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const existing = await client.from("staff_members").select("id, role").eq("role", "owner").limit(1);
  if (existing.error) {
    console.error("The staff tables are not ready. Apply the staff migration before creating the owner.");
    process.exit(1);
  }
  if ((existing.data ?? []).length) {
    console.error("An owner already exists. No second owner was created.");
    process.exit(1);
  }
  const inserted = await client.from("staff_members").insert({
    id: member.id,
    email: member.email,
    role: member.role,
    status: member.status,
    password_hash: "",
    created_at: member.createdAt,
    activated_at: member.activatedAt,
    revoked_at: null,
  });
  if (inserted.error) {
    console.error("The owner was not created.");
    process.exit(1);
  }
  console.log(`Owner ${email} is active. Sign in from Teams.`);
  process.exit(0);
}

if (!file) process.exit(1);

const directory = join(process.cwd(), "data", "private");
const path = join(directory, "staff.json");
await mkdir(directory, { recursive: true });
let desk = { members: [], links: [], sessions: [] };
try {
  desk = JSON.parse(await readFile(path, "utf8"));
} catch {
  desk = { members: [], links: [], sessions: [] };
}
const members = Array.isArray(desk.members) ? desk.members : [];
if (members.some((item) => item.role === "owner")) {
  console.error("An owner already exists. No second owner was created.");
  process.exit(1);
}
members.push(member);
await writeFile(
  path,
  JSON.stringify({ members, links: desk.links ?? [], sessions: desk.sessions ?? [] }, null, 2),
);
console.log(`Owner ${email} is active in the local file. Sign in from Teams.`);
