import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const ROLES = ["admin", "planner", "viewer"];
const secret = () => process.env.AUTH_SECRET || "";

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function readJson(req, maxBytes = 1_000_000) {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Request is too large");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw new Error("Invalid JSON");
  }
}

/* ---------- Comparisons and passwords ---------- */
export function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function checkPassword(password, stored) {
  try {
    const [alg, saltHex, hashHex] = String(stored).split("$");
    if (alg !== "scrypt") return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, "hex"), 64);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export const validUsername = (s) => /^[a-z0-9._-]{3,32}$/.test(s);
export const validPassword = (s) => typeof s === "string" && s.length >= 8 && s.length <= 200;
export const cleanText = (s, max = 200) => String(s ?? "").trim().slice(0, max);

/* ---------- User store ---------- */
export const authStore = () => getStore({ name: "wedding-auth", consistency: "strong" });
export async function loadUsers() {
  return (await authStore().get("users", { type: "json" })) || [];
}
export async function saveUsers(users) {
  await authStore().setJSON("users", users);
}
export const publicUser = (u) => ({
  id: u.id, username: u.username, name: u.name, role: u.role,
  disabled: !!u.disabled, createdAt: u.createdAt, lastLogin: u.lastLogin || null,
});
export const activeAdmins = (users) => users.filter((u) => u.role === "admin" && !u.disabled);

/* ---------- Tokens ---------- */
// Tokens carry the user id and a token version. Changing a password or turning an account off
// bumps the version, which signs that user out everywhere.
export function createToken(user, days = 1) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, tv: user.tv || 0, exp: Date.now() + days * 864e5 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readToken(token) {
  if (!token || !secret()) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

/** Returns { user, users } or { error: Response }. Pass roles to restrict access. */
export async function requireUser(req, roles) {
  if (!secret()) return { error: json({ error: "The server isn't configured. Add AUTH_SECRET in Netlify environment variables." }, 500) };
  const header = req.headers.get("authorization") || "";
  const payload = readToken(header.replace(/^Bearer\s+/i, ""));
  if (!payload) return { error: json({ error: "Unauthorized" }, 401) };
  const users = await loadUsers();
  const user = users.find((u) => u.id === payload.uid);
  if (!user || user.disabled || (user.tv || 0) !== payload.tv) return { error: json({ error: "Unauthorized" }, 401) };
  if (roles && !roles.includes(user.role)) return { error: json({ error: "You don't have permission to do that." }, 403) };
  return { user, users };
}
