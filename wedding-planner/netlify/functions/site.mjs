import { getStore } from "@netlify/blobs";
import { json, requireUser } from "../lib/auth.mjs";

const MAX_BYTES = 600_000;
const store = () => getStore({ name: "wedding-site", consistency: "strong" });

// Public wedding website content. Admins can read drafts and save changes.
export default async (req) => {
  const hasAuth = Boolean(req.headers.get("authorization"));

  if (req.method === "GET") {
    const site = await store().get("content", { type: "json" });
    if (hasAuth) {
      const { user } = await requireUser(req, ["admin"]);
      if (user) return json({ site: site || null, draft: true });
    }
    if (!site || !site.published) {
      return json({ site: null, published: false, couple: site ? { name1: site.name1 || "", name2: site.name2 || "" } : null });
    }
    return json({ site }, 200, { "cache-control": "public, max-age=60" });
  }

  if (req.method === "PUT") {
    const { error } = await requireUser(req, ["admin"]);
    if (error) return error;
    const text = await req.text();
    if (text.length > MAX_BYTES) return json({ error: "Website content is too large." }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body.site !== "object" || body.site === null) return json({ error: "Missing site content" }, 400);
    body.site.updatedAt = new Date().toISOString();
    await store().setJSON("content", body.site);
    return json({ ok: true, updatedAt: body.site.updatedAt });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/site" };
