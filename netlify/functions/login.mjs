import { json, delay, readJson, hashPassword, checkPassword, loadUsers, saveUsers, createToken, publicUser } from "../lib/auth.mjs";

const DUMMY_HASH = hashPassword("timing-equalizer");
const MAX_FAILURES = 8;
const LOCK_MINUTES = 15;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!process.env.AUTH_SECRET) return json({ error: "The server isn't configured. Add AUTH_SECRET in Netlify environment variables." }, 500);

  let body;
  try { body = await readJson(req, 10_000); } catch (e) { return json({ error: e.message }, 400); }

  const users = await loadUsers();
  if (!users.length) return json({ error: "No accounts exist yet. Finish setup first.", needsSetup: true }, 409);

  const username = String(body.username || "").trim().toLowerCase();
  const user = users.find((u) => u.username === username);
  const now = Date.now();

  if (user && user.lockUntil && user.lockUntil > now) {
    return json({ error: "Too many attempts. Wait a few minutes and try again." }, 429);
  }

  const ok = checkPassword(body.password || "", user ? user.pass : DUMMY_HASH) && Boolean(user);
  if (!ok) {
    if (user) {
      user.failed = (user.failed || 0) + 1;
      if (user.failed >= MAX_FAILURES) { user.lockUntil = now + LOCK_MINUTES * 60e3; user.failed = 0; }
      await saveUsers(users);
    }
    await delay(800);
    return json({ error: "That username and password don't match." }, 401);
  }
  if (user.disabled) return json({ error: "This account is turned off. Ask the site admin to turn it back on." }, 403);

  user.failed = 0;
  user.lockUntil = 0;
  user.lastLogin = new Date().toISOString();
  await saveUsers(users);
  return json({ token: createToken(user, body.remember ? 30 : 1), user: publicUser(user) });
};

export const config = { path: "/api/login" };
