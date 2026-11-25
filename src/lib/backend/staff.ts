import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";
import { sendBackendEmail } from "./mail";
import { supabaseConfigured } from "./store";

export type StaffRole = "owner" | "member";
export type StaffStatus = "invited" | "active" | "revoked";
type LinkPurpose = "invite" | "verify" | "login";

type Member = {
  id: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  passwordHash: string;
  createdAt: string;
  activatedAt: string;
  revokedAt: string;
};

type LinkRecord = {
  id: string;
  memberId: string;
  purpose: LinkPurpose;
  tokenHash: string;
  expiresAt: string;
  usedAt: string;
  createdAt: string;
};

type SessionRecord = {
  id: string;
  memberId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string;
  createdAt: string;
};

type Desk = {
  members: Member[];
  links: LinkRecord[];
  sessions: SessionRecord[];
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

export type StaffViewer = {
  id: string;
  email: string;
  role: StaffRole;
  passwordSet: boolean;
  hasAvatar: boolean;
};

type Photo = {
  type: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
};

const directory = join(process.cwd(), "data", "private");
const deskPath = join(directory, "staff.json");
const outboxPath = join(directory, "staff-outbox.json");
const avatarDir = join(directory, "avatars");
const avatarExtensions = [
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
] as const;
const scryptAsync = promisify(scrypt);
const LOGIN_SECONDS = 20 * 60;
const VERIFY_SECONDS = 20 * 60;
const INVITE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_SECONDS = 12 * 60 * 60;

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(task: () => Promise<T>) {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function future(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function live(record: { expiresAt: string; usedAt?: string; revokedAt?: string }) {
  if (record.usedAt) return false;
  if (record.revokedAt) return false;
  return Date.parse(record.expiresAt) > Date.now();
}

function admin() {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function memberFromRow(row: Record<string, unknown>): Member {
  const role = text(row.role) === "owner" ? "owner" : "member";
  const status = text(row.status);
  return {
    id: text(row.id),
    email: text(row.email).toLowerCase(),
    role,
    status: status === "active" || status === "revoked" ? status : "invited",
    passwordHash: text(row.password_hash),
    createdAt: text(row.created_at),
    activatedAt: text(row.activated_at),
    revokedAt: text(row.revoked_at),
  };
}

function linkFromRow(row: Record<string, unknown>): LinkRecord {
  const purpose = text(row.purpose);
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    purpose: purpose === "verify" || purpose === "login" ? purpose : "invite",
    tokenHash: text(row.token_hash),
    expiresAt: text(row.expires_at),
    usedAt: text(row.used_at),
    createdAt: text(row.created_at),
  };
}

function sessionFromRow(row: Record<string, unknown>): SessionRecord {
  return {
    id: text(row.id),
    memberId: text(row.member_id),
    tokenHash: text(row.token_hash),
    expiresAt: text(row.expires_at),
    revokedAt: text(row.revoked_at),
    createdAt: text(row.created_at),
  };
}

async function readFileDesk(): Promise<Desk> {
  try {
    const parsed = JSON.parse(await readFile(deskPath, "utf8")) as Desk;
    return {
      members: Array.isArray(parsed.members)
        ? parsed.members.map((member) => ({ ...member, passwordHash: member.passwordHash || "" }))
        : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return { members: [], links: [], sessions: [] };
  }
}

async function writeFileDesk(desk: Desk) {
  await mkdir(directory, { recursive: true });
  await writeFile(deskPath, JSON.stringify(desk, null, 2));
}

async function readSupabaseDesk(client: SupabaseClient): Promise<Desk> {
  const [members, links, sessions] = await Promise.all([
    client.from("staff_members").select("*"),
    client.from("staff_links").select("*"),
    client.from("staff_sessions").select("*"),
  ]);
  if (members.error) throw new Error(members.error.message);
  if (links.error) throw new Error(links.error.message);
  if (sessions.error) throw new Error(sessions.error.message);
  return {
    members: ((members.data ?? []) as Record<string, unknown>[]).map(memberFromRow),
    links: ((links.data ?? []) as Record<string, unknown>[]).map(linkFromRow),
    sessions: ((sessions.data ?? []) as Record<string, unknown>[]).map(sessionFromRow),
  };
}

function memberRow(member: Member) {
  return {
    id: member.id,
    email: member.email,
    role: member.role,
    status: member.status,
    password_hash: member.passwordHash || "",
    created_at: member.createdAt,
    activated_at: member.activatedAt || null,
    revoked_at: member.revokedAt || null,
  };
}

function linkRow(link: LinkRecord) {
  return {
    id: link.id,
    member_id: link.memberId,
    purpose: link.purpose,
    token_hash: link.tokenHash,
    expires_at: link.expiresAt,
    used_at: link.usedAt || null,
    created_at: link.createdAt,
  };
}

function sessionRow(session: SessionRecord) {
  return {
    id: session.id,
    member_id: session.memberId,
    token_hash: session.tokenHash,
    expires_at: session.expiresAt,
    revoked_at: session.revokedAt || null,
    created_at: session.createdAt,
  };
}

async function writeSupabaseDesk(client: SupabaseClient, desk: Desk) {
  const write = async (table: string, key: string, rows: Record<string, unknown>[]) => {
    if (rows.length) {
      const { error } = await client.from(table).upsert(rows);
      if (error) throw new Error(error.message);
    }
    const { data, error } = await client.from(table).select(key);
    if (error) throw new Error(error.message);
    const keep = new Set(rows.map((row) => String(row[key])));
    const remove = ((data ?? []) as Record<string, unknown>[])
      .map((row) => String(row[key]))
      .filter((id) => !keep.has(id));
    if (!remove.length) return;
    const { error: deleteError } = await client.from(table).delete().in(key, remove);
    if (deleteError) throw new Error(deleteError.message);
  };
  await write("staff_members", "id", desk.members.map(memberRow));
  await write("staff_links", "id", desk.links.map(linkRow));
  await write("staff_sessions", "id", desk.sessions.map(sessionRow));
}

async function readDesk() {
  const client = admin();
  if (client && supabaseConfigured()) return readSupabaseDesk(client);
  return readFileDesk();
}

async function writeDesk(desk: Desk) {
  const client = admin();
  if (client && supabaseConfigured()) {
    await writeSupabaseDesk(client, desk);
    return;
  }
  await writeFileDesk(desk);
}

async function rememberOutbox(entry: { email: string; purpose: string; url: string }) {
  await mkdir(directory, { recursive: true });
  let links: { email: string; purpose: string; url: string; createdAt: string }[] = [];
  try {
    const parsed = JSON.parse(await readFile(outboxPath, "utf8")) as { links?: typeof links };
    links = Array.isArray(parsed.links) ? parsed.links : [];
  } catch {
    links = [];
  }
  links.push({ ...entry, createdAt: new Date().toISOString() });
  await writeFile(outboxPath, JSON.stringify({ links }, null, 2));
}

async function deliverLink(input: { email: string; purpose: "login" | "verify"; url: string }) {
  if (process.env.NODE_ENV !== "production") {
    await rememberOutbox(input);
    return true;
  }
  return sendBackendEmail({
    type: input.purpose === "login" ? "staff-signin" : "staff-verify",
    to: input.email,
    url: input.url,
  });
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax" as const,
    maxAge,
  };
}

function viewer(member: Member, hasAvatar: boolean): StaffViewer {
  return {
    id: member.id,
    email: member.email,
    role: member.role,
    passwordSet: Boolean(member.passwordHash),
    hasAvatar,
  };
}

export function staffInitials(email: string) {
  const local = email.split("@")[0] || "";
  const pieces = local.split(/[._-]+/).filter(Boolean);
  if (pieces.length > 1) return `${pieces[0][0] || ""}${pieces[1][0] || ""}`.toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function photoKind(bytes: Buffer): Photo["type"] | "" {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return "";
}

function safeMemberId(id: string) {
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
}

function decodeBytea(value: unknown) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
  return Buffer.from(value, "base64");
}

async function readFilePhoto(id: string): Promise<Photo | null> {
  const safe = safeMemberId(id);
  if (!safe) return null;
  for (const [extension, type] of avatarExtensions) {
    try {
      const bytes = await readFile(join(avatarDir, `${safe}${extension}`));
      if (photoKind(bytes) === type) return { type, bytes };
    } catch {
      // This extension is not the saved photo.
    }
  }
  return null;
}

async function readPhoto(id: string): Promise<Photo | null> {
  const client = admin();
  if (client && supabaseConfigured()) {
    const { data, error } = await client
      .from("staff_avatars")
      .select("content_type, image")
      .eq("member_id", id)
      .maybeSingle();
    if (error || !data) return null;
    const bytes = decodeBytea(data.image);
    const type = photoKind(bytes ?? Buffer.alloc(0));
    if (!bytes || !type || type !== data.content_type) return null;
    return { type, bytes };
  }
  return readFilePhoto(id);
}

async function avatarExists(id: string) {
  return Boolean(await readPhoto(id).catch(() => null));
}

async function writePhoto(id: string, photo: Photo) {
  const client = admin();
  if (client && supabaseConfigured()) {
    const { error } = await client.from("staff_avatars").upsert({
      member_id: id,
      content_type: photo.type,
      image: `\\x${photo.bytes.toString("hex")}`,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return;
  }
  const safe = safeMemberId(id);
  if (!safe) throw new Error("Account photo could not be saved.");
  await mkdir(avatarDir, { recursive: true });
  await Promise.all(
    avatarExtensions.map(async ([extension]) => {
      await unlink(join(avatarDir, `${safe}${extension}`)).catch(() => undefined);
    }),
  );
  const extension = avatarExtensions.find(([, type]) => type === photo.type)?.[0] ?? ".jpg";
  await writeFile(join(avatarDir, `${safe}${extension}`), photo.bytes);
}

async function deletePhoto(id: string) {
  const client = admin();
  if (client && supabaseConfigured()) {
    const { error } = await client.from("staff_avatars").delete().eq("member_id", id);
    if (error) throw new Error(error.message);
    return;
  }
  const safe = safeMemberId(id);
  if (!safe) return;
  await Promise.all(
    avatarExtensions.map(async ([extension]) => {
      await unlink(join(avatarDir, `${safe}${extension}`)).catch(() => undefined);
    }),
  );
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 32)) as Buffer;
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [kind, salt, hash] = stored.split(":");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const next = (await scryptAsync(password, salt, 32)) as Buffer;
  const current = Buffer.from(hash, "hex");
  if (next.length !== current.length) return false;
  return timingSafeEqual(next, current);
}

export function staffDestination(value: string) {
  if (value === "/staff") return value;
  if (/^\/staff\/(tickets|subscribers|vendors|partners|analytics|team|account)(\/[A-Za-z0-9_-]+)?$/.test(value)) {
    return value;
  }
  if (/^\/staff\/events(\/[a-z0-9-]+(\/[a-z]+)?)?$/.test(value)) return value;
  return "/staff";
}

export async function isStaff(cookies: CookieJar): Promise<StaffViewer | null> {
  const raw = cookies.get("staff_session")?.value ?? "";
  if (!raw) return null;
  try {
    const desk = await readDesk();
    const session = desk.sessions.find((item) => item.tokenHash === hashToken(raw));
    if (!session || !live(session)) return null;
    const member = desk.members.find((item) => item.id === session.memberId);
    if (!member || member.status !== "active") return null;
    return viewer(member, await avatarExists(member.id));
  } catch (error) {
    console.error("Staff session could not be read", error instanceof Error ? error.message : "");
    return null;
  }
}

export async function logoutStaff(cookies: CookieJar) {
  const raw = cookies.get("staff_session")?.value ?? "";
  cookies.delete("staff_session", { path: "/" });
  if (!raw) return;
  await locked(async () => {
    const desk = await readDesk();
    const session = desk.sessions.find((item) => item.tokenHash === hashToken(raw));
    if (!session || session.revokedAt) return;
    session.revokedAt = new Date().toISOString();
    await writeDesk(desk);
  }).catch((error: unknown) => {
    console.error("Staff session could not be closed", error instanceof Error ? error.message : "");
  });
}

export async function requestStaffSignIn(email: string, origin: string) {
  const address = email.trim().toLowerCase();
  if (!emailOk(address)) return { ok: false as const, message: "Enter a valid email address." };
  try {
    await locked(async () => {
      const desk = await readDesk();
      const member = desk.members.find((item) => item.email === address && item.status === "active");
      if (!member) return;
      const token = randomBytes(32).toString("base64url");
      desk.links.push({
        id: randomBytes(8).toString("hex"),
        memberId: member.id,
        purpose: "login",
        tokenHash: hashToken(token),
        expiresAt: future(LOGIN_SECONDS),
        usedAt: "",
        createdAt: new Date().toISOString(),
      });
      await writeDesk(desk);
      await deliverLink({ email: member.email, purpose: "login", url: `${origin}/staff/enter?token=${token}` });
    });
  } catch (error) {
    console.error("Staff sign-in could not be prepared", error instanceof Error ? error.message : "");
  }
  return { ok: true as const };
}

export async function openStaffEntry(token: string, cookies: CookieJar) {
  const raw = token.trim();
  if (!raw) return false;
  return locked(async () => {
    const desk = await readDesk();
    const link = desk.links.find((item) => item.tokenHash === hashToken(raw));
    if (!link || !live(link) || (link.purpose !== "login" && link.purpose !== "verify")) return false;
    const member = desk.members.find((item) => item.id === link.memberId);
    if (!member || member.status === "revoked") return false;
    if (link.purpose === "login" && member.status !== "active") return false;
    link.usedAt = new Date().toISOString();
    if (link.purpose === "verify") {
      member.status = "active";
      member.activatedAt = member.activatedAt || link.usedAt;
      member.revokedAt = "";
    }
    const sessionToken = randomBytes(32).toString("base64url");
    desk.sessions.push({
      id: randomBytes(8).toString("hex"),
      memberId: member.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: future(SESSION_SECONDS),
      revokedAt: "",
      createdAt: link.usedAt,
    });
    await writeDesk(desk);
    cookies.set("staff_session", sessionToken, cookieOptions(SESSION_SECONDS));
    return member.passwordHash ? ("ready" as const) : ("password" as const);
  });
}

export async function ownerPasswordNeeded() {
  const desk = await readDesk();
  const owner = desk.members.find((item) => item.role === "owner" && item.status === "active" && !item.passwordHash);
  return owner?.email ?? "";
}

export async function chooseOwnerPassword(
  email: string,
  password: string,
  confirm: string,
  cookies: CookieJar,
) {
  if (password.length < 10) return { ok: false as const, message: "Use at least 10 characters." };
  if (password !== confirm) return { ok: false as const, message: "Those passwords do not match." };
  const address = email.trim().toLowerCase();
  return locked(async () => {
    const desk = await readDesk();
    const member = desk.members.find((item) => item.email === address && item.status === "active");
    if (!member || member.role !== "owner" || member.passwordHash) {
      return { ok: false as const, message: "This account cannot set a password from this form." };
    }
    member.passwordHash = await hashPassword(password);
    const sessionToken = randomBytes(32).toString("base64url");
    desk.sessions.push({
      id: randomBytes(8).toString("hex"),
      memberId: member.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: future(SESSION_SECONDS),
      revokedAt: "",
      createdAt: new Date().toISOString(),
    });
    await writeDesk(desk);
    cookies.set("staff_session", sessionToken, cookieOptions(SESSION_SECONDS));
    return { ok: true as const };
  });
}

export async function signInWithPassword(email: string, password: string, cookies: CookieJar) {
  const address = email.trim().toLowerCase();
  if (!emailOk(address) || !password) {
    return { ok: false as const, message: "That email or password was not accepted." };
  }
  return locked(async () => {
    const desk = await readDesk();
    const member = desk.members.find((item) => item.email === address && item.status === "active");
    if (!member?.passwordHash || !(await passwordMatches(password, member.passwordHash))) {
      return { ok: false as const, message: "That email or password was not accepted." };
    }
    const sessionToken = randomBytes(32).toString("base64url");
    desk.sessions.push({
      id: randomBytes(8).toString("hex"),
      memberId: member.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: future(SESSION_SECONDS),
      revokedAt: "",
      createdAt: new Date().toISOString(),
    });
    await writeDesk(desk);
    cookies.set("staff_session", sessionToken, cookieOptions(SESSION_SECONDS));
    return { ok: true as const };
  });
}

export async function setStaffPassword(cookies: CookieJar, password: string, confirm: string) {
  if (password.length < 10) return { ok: false as const, message: "Use at least 10 characters." };
  if (password !== confirm) return { ok: false as const, message: "Those passwords do not match." };
  const raw = cookies.get("staff_session")?.value ?? "";
  if (!raw) return { ok: false as const, message: "Sign in again before choosing a password." };
  return locked(async () => {
    const desk = await readDesk();
    const session = desk.sessions.find((item) => item.tokenHash === hashToken(raw));
    const member = session && live(session) ? desk.members.find((item) => item.id === session.memberId) : undefined;
    if (!member || member.status !== "active") {
      return { ok: false as const, message: "Sign in again before choosing a password." };
    }
    member.passwordHash = await hashPassword(password);
    await writeDesk(desk);
    return { ok: true as const };
  });
}

export async function listStaff() {
  const desk = await readDesk();
  return desk.members
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((member) => ({
      id: member.id,
      email: member.email,
      role: member.role,
      status: member.status,
      createdAt: member.createdAt,
    }));
}

export async function inviteStaff(actor: StaffViewer, email: string, origin: string) {
  if (actor.role !== "owner") return { ok: false as const, message: "Only the owner can invite the team." };
  const address = email.trim().toLowerCase();
  if (!emailOk(address)) return { ok: false as const, message: "Enter a valid email address." };
  return locked(async () => {
    const desk = await readDesk();
    let member = desk.members.find((item) => item.email === address);
    if (member?.status === "active") {
      return { ok: false as const, message: "That person already has access." };
    }
    const now = new Date().toISOString();
    if (!member) {
      member = {
        id: randomBytes(8).toString("hex"),
        email: address,
        role: "member",
        status: "invited",
        passwordHash: "",
        createdAt: now,
        activatedAt: "",
        revokedAt: "",
      };
      desk.members.push(member);
    } else {
      member.status = "invited";
      member.revokedAt = "";
    }
    for (const link of desk.links) {
      if (link.memberId === member.id && link.purpose === "invite" && !link.usedAt) link.usedAt = now;
    }
    const token = randomBytes(32).toString("base64url");
    desk.links.push({
      id: randomBytes(8).toString("hex"),
      memberId: member.id,
      purpose: "invite",
      tokenHash: hashToken(token),
      expiresAt: future(INVITE_SECONDS),
      usedAt: "",
      createdAt: now,
    });
    await writeDesk(desk);
    return { ok: true as const, url: `${origin}/staff/invite?token=${token}` };
  });
}

export async function reissueStaffInvite(actor: StaffViewer, memberId: string, origin: string) {
  if (actor.role !== "owner") return { ok: false as const, message: "Only the owner can invite the team." };
  return locked(async () => {
    const desk = await readDesk();
    const member = desk.members.find((item) => item.id === memberId);
    if (!member) return { ok: false as const, message: "That person is not on the team." };
    if (member.status === "active") return { ok: false as const, message: "That person already has access." };
    const now = new Date().toISOString();
    member.status = "invited";
    member.revokedAt = "";
    for (const link of desk.links) {
      if (link.memberId === member.id && !link.usedAt) link.usedAt = now;
    }
    const token = randomBytes(32).toString("base64url");
    desk.links.push({
      id: randomBytes(8).toString("hex"),
      memberId: member.id,
      purpose: "invite",
      tokenHash: hashToken(token),
      expiresAt: future(INVITE_SECONDS),
      usedAt: "",
      createdAt: now,
    });
    await writeDesk(desk);
    return { ok: true as const, url: `${origin}/staff/invite?token=${token}` };
  });
}

export async function revokeStaff(actor: StaffViewer, memberId: string) {
  if (actor.role !== "owner") return { ok: false as const, message: "Only the owner can change access." };
  return locked(async () => {
    const desk = await readDesk();
    const member = desk.members.find((item) => item.id === memberId);
    if (!member) return { ok: false as const, message: "That person is not on the team." };
    const owners = desk.members.filter((item) => item.role === "owner" && item.status === "active");
    if (member.role === "owner" && owners.length < 2) {
      return { ok: false as const, message: "The last owner cannot be removed." };
    }
    const now = new Date().toISOString();
    member.status = "revoked";
    member.revokedAt = now;
    for (const link of desk.links) {
      if (link.memberId === member.id && !link.usedAt) link.usedAt = now;
    }
    for (const session of desk.sessions) {
      if (session.memberId === member.id && !session.revokedAt) session.revokedAt = now;
    }
    await writeDesk(desk);
    return { ok: true as const };
  });
}

export async function beginStaffVerification(token: string, origin: string) {
  const raw = token.trim();
  if (!raw) return { ok: false as const, message: "This invitation is no longer valid." };
  return locked(async () => {
    const desk = await readDesk();
    const invite = desk.links.find((item) => item.tokenHash === hashToken(raw) && item.purpose === "invite");
    if (!invite || !live(invite)) return { ok: false as const, message: "This invitation is no longer valid." };
    const member = desk.members.find((item) => item.id === invite.memberId);
    if (!member || member.status === "revoked") {
      return { ok: false as const, message: "This invitation is no longer valid." };
    }
    const now = new Date().toISOString();
    invite.usedAt = now;
    const verify = randomBytes(32).toString("base64url");
    desk.links.push({
      id: randomBytes(8).toString("hex"),
      memberId: member.id,
      purpose: "verify",
      tokenHash: hashToken(verify),
      expiresAt: future(VERIFY_SECONDS),
      usedAt: "",
      createdAt: now,
    });
    await writeDesk(desk);
    await deliverLink({
      email: member.email,
      purpose: "verify",
      url: `${origin}/staff/enter?token=${verify}`,
    });
    return { ok: true as const, email: member.email };
  });
}

export async function inviteStillOpen(token: string) {
  const raw = token.trim();
  if (!raw) return null;
  const desk = await readDesk();
  const invite = desk.links.find((item) => item.tokenHash === hashToken(raw) && item.purpose === "invite");
  if (!invite || !live(invite)) return null;
  const member = desk.members.find((item) => item.id === invite.memberId);
  if (!member || member.status === "revoked") return null;
  return member.email;
}

export async function staffPhoto(cookies: CookieJar) {
  const raw = cookies.get("staff_session")?.value ?? "";
  if (!raw) return null;
  const desk = await readDesk();
  const session = desk.sessions.find((item) => item.tokenHash === hashToken(raw));
  if (!session || !live(session)) return null;
  const member = desk.members.find((item) => item.id === session.memberId);
  if (!member || member.status !== "active") return null;
  return readPhoto(member.id);
}

export async function updateStaffAccount(
  cookies: CookieJar,
  input: {
    email: string;
    currentPassword: string;
    password: string;
    confirm: string;
    photo: Buffer | null;
    removePhoto: boolean;
  },
) {
  const raw = cookies.get("staff_session")?.value ?? "";
  if (!raw) return { ok: false as const, message: "Sign in again before changing this account." };
  const address = input.email.trim().toLowerCase();
  const nextPassword = input.password;
  const emailChange = address.length > 0;
  const passwordChange = nextPassword.length > 0 || input.confirm.length > 0;
  let parsedPhoto: Photo | null = null;
  if (input.photo && input.photo.length) {
    if (input.photo.length > 1_500_000) {
      return { ok: false as const, message: "Use a JPEG, PNG, or WebP under 1.5 MB." };
    }
    const type = photoKind(input.photo);
    if (!type) return { ok: false as const, message: "Use a JPEG, PNG, or WebP under 1.5 MB." };
    parsedPhoto = { type, bytes: input.photo };
  }
  const photoChange = Boolean(parsedPhoto) || input.removePhoto;
  if (!emailChange && !passwordChange && !photoChange) {
    return { ok: false as const, message: "Nothing was changed." };
  }
  if (!emailOk(address)) return { ok: false as const, message: "Enter a valid email address." };
  if (passwordChange) {
    if (nextPassword.length < 10) return { ok: false as const, message: "Use at least 10 characters." };
    if (nextPassword !== input.confirm) return { ok: false as const, message: "Those passwords do not match." };
  }
  if (!input.currentPassword) {
    return { ok: false as const, message: "Enter the current password to save account changes." };
  }
  return locked(async () => {
    const desk = await readDesk();
    const session = desk.sessions.find((item) => item.tokenHash === hashToken(raw));
    const member = session && live(session) ? desk.members.find((item) => item.id === session.memberId) : undefined;
    if (!member || member.status !== "active" || !member.passwordHash) {
      return { ok: false as const, message: "Sign in again before changing this account." };
    }
    if (!(await passwordMatches(input.currentPassword, member.passwordHash))) {
      return { ok: false as const, message: "The current password was not accepted." };
    }
    if (address !== member.email && desk.members.some((item) => item.email === address)) {
      return { ok: false as const, message: "That email is already on the team." };
    }
    member.email = address;
    if (passwordChange) member.passwordHash = await hashPassword(nextPassword);
    try {
      if (parsedPhoto) await writePhoto(member.id, parsedPhoto);
      else if (input.removePhoto) await deletePhoto(member.id);
      await writeDesk(desk);
    } catch (error) {
      console.error("Staff account could not be saved", error instanceof Error ? error.message : "");
      return { ok: false as const, message: "The account could not be saved." };
    }
    return { ok: true as const };
  });
}
