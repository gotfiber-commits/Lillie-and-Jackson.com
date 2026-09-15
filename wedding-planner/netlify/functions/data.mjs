import { getStore } from "@netlify/blobs";
import { json, requireUser } from "../lib/auth.mjs";

const MAX_BYTES = 4_000_000;

// The planner's data. Everyone signed in can read; admins and planners can save.
export default async (req) => {
  const store = getStore({ name: "wedding-planner", consistency: "strong" });

  if (req.method === "GET") {
    const { error } = await requireUser(req);
    if (error) return error;
    return json({ data: (await store.get("plan", { type: "json" })) || null });
  }

  if (req.method === "PUT") {
    const { error } = await requireUser(req, ["admin", "planner"]);
    if (error) return error;
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "The plan is too large to save." }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body.data !== "object" || body.data === null) return json({ error: "Missing data" }, 400);
    const savedAt = new Date().toISOString();
    body.data.meta = { ...(body.data.meta || {}), savedAt };
    await store.setJSON("plan", body.data);
    return json({ ok: true, savedAt });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/data" };
