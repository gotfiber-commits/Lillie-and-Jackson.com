import crypto from "node:crypto";
import { json, readJson, requireUser, hashPassword, validUsername, validPassword, cleanText, saveUsers, publicUser, activeAdmins, ROLES } from "../lib/auth.mjs";

// Admin-only user management
export default async (req, context) => {
  const { user: me, users, error } = await requireUser(req, ["admin"]);
  if (error) return error;
  const id = context.params?.id;

  if (req.method === "GET" && !id) return json({ users: users.map(publicUser) });

  let body = {};
  if (req.method === "POST" || req.method === "PATCH") {
    try { body = await readJson(req, 10_000); } catch (e) { return json({ error: e.message }, 400); }
  }

  if (req.method === "POST" && !id) {
    const username = cleanText(body.username, 32).toLowerCase();
    if (!validUsername(username)) return json({ error: "Usernames are 3 to 32 characters: letters, numbers, dots, dashes or underscores." }, 400);
    if (users.some((u) => u.username === username)) return json({ error: "That username is already taken." }, 409);
    if (!ROLES.includes(body.role)) return json({ error: "Choose a role." }, 400);
    if (!validPassword(body.password)) return json({ error: "Use a password with at least 8 characters." }, 400);
    const user = {
      id: crypto.randomUUID(), username, name: cleanText(body.name, 80) || username, role: body.role,
      pass: hashPassword(body.password), tv: 0, createdAt: new Date().toISOString(), lastLogin: null,
    };
    users.push(user);
    await saveUsers(users);
    return json({ user: publicUser(user) }, 201);
  }

  const target = id && users.find((u) => u.id === id);
  if (id && !target) return json({ error: "User not found." }, 404);

  if (req.method === "PATCH" && target) {
    const nextRole = body.role !== undefined ? body.role : target.role;
    const nextDisabled = body.disabled !== undefined ? Boolean(body.disabled) : Boolean(target.disabled);
    if (!ROLES.includes(nextRole)) return json({ error: "Choose a valid role." }, 400);
    if (target.id === me.id && (nextRole !== "admin" || nextDisabled)) {
      return json({ error: "You can't remove your own admin access. Ask another admin." }, 400);
    }
    const losingAdmin = target.role === "admin" && !target.disabled && (nextRole !== "admin" || nextDisabled);
    if (losingAdmin && activeAdmins(users).length <= 1) return json({ error: "The site needs at least one active admin." }, 400);

    if (body.name !== undefined) target.name = cleanText(body.name, 80) || target.username;
    if (nextDisabled !== Boolean(target.disabled)) target.tv = (target.tv || 0) + 1;
    target.role = nextRole;
    target.disabled = nextDisabled;
    if (body.password) {
      if (!validPassword(body.password)) return json({ error: "Use a password with at least 8 characters." }, 400);
      target.pass = hashPassword(body.password);
      target.tv = (target.tv || 0) + 1;
      target.failed = 0;
      target.lockUntil = 0;
    }
    await saveUsers(users);
    return json({ user: publicUser(target) });
  }

  if (req.method === "DELETE" && target) {
    if (target.id === me.id) return json({ error: "You can't delete your own account." }, 400);
    if (target.role === "admin" && !target.disabled && activeAdmins(users).length <= 1) return json({ error: "The site needs at least one active admin." }, 400);
    await saveUsers(users.filter((u) => u.id !== target.id));
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: ["/api/users", "/api/users/:id"] };
