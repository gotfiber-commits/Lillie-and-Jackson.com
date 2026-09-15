import crypto from "node:crypto";
import { json, delay, readJson, safeEqual, hashPassword, validUsername, validPassword, cleanText, loadUsers, saveUsers, createToken, publicUser } from "../lib/auth.mjs";

// First-run setup: creates the admin account. Disabled once any account exists.
export default async (req) => {
  const users = await loadUsers();

  if (req.method === "GET") {
    return json({ needsSetup: users.length === 0, configured: Boolean(process.env.AUTH_SECRET && process.env.SETUP_KEY) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (users.length) return json({ error: "Setup is already complete. Sign in instead." }, 409);
  if (!process.env.AUTH_SECRET || !process.env.SETUP_KEY) {
    return json({ error: "Add AUTH_SECRET and SETUP_KEY in Netlify environment variables, then redeploy." }, 500);
  }

  let body;
  try { body = await readJson(req, 10_000); } catch (e) { return json({ error: e.message }, 400); }

  if (!safeEqual(body.setupKey || "", process.env.SETUP_KEY)) {
    await delay(1000);
    return json({ error: "That setup key doesn't match the SETUP_KEY environment variable." }, 403);
  }
  const username = cleanText(body.username, 32).toLowerCase();
  if (!validUsername(username)) return json({ error: "Usernames are 3 to 32 characters: letters, numbers, dots, dashes or underscores." }, 400);
  if (!validPassword(body.password)) return json({ error: "Use a password with at least 8 characters." }, 400);

  // Re-check right before writing in case setup ran twice at once
  if ((await loadUsers()).length) return json({ error: "Setup is already complete. Sign in instead." }, 409);

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(), username, name: cleanText(body.name, 80) || username, role: "admin",
    pass: hashPassword(body.password), tv: 0, createdAt: now, lastLogin: now,
  };
  await saveUsers([user]);
  return json({ token: createToken(user, 1), user: publicUser(user) });
};

export const config = { path: "/api/setup" };
