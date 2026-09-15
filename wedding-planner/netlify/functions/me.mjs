import { json, readJson, requireUser, checkPassword, hashPassword, validPassword, saveUsers, createToken, publicUser } from "../lib/auth.mjs";

// GET: the signed-in user. POST: change your own password.
export default async (req) => {
  const { user, users, error } = await requireUser(req);
  if (error) return error;

  if (req.method === "GET") return json({ user: publicUser(user) });

  if (req.method === "POST") {
    let body;
    try { body = await readJson(req, 10_000); } catch (e) { return json({ error: e.message }, 400); }
    if (!checkPassword(body.currentPassword || "", user.pass)) return json({ error: "Your current password isn't correct." }, 400);
    if (!validPassword(body.newPassword)) return json({ error: "Use a new password with at least 8 characters." }, 400);
    user.pass = hashPassword(body.newPassword);
    user.tv = (user.tv || 0) + 1; // sign out other sessions
    await saveUsers(users);
    return json({ ok: true, token: createToken(user, 30) });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/me" };
