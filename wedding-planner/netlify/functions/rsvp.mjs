import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { json, readJson, requireUser, cleanText } from "../lib/auth.mjs";

const rsvps = () => getStore({ name: "wedding-rsvps", consistency: "strong" });
const site = () => getStore({ name: "wedding-site", consistency: "strong" });
const validKey = (k) => /^r-\d+-[0-9a-f]{8}$/.test(k || "");

// POST is the public RSVP form. Signed-in users can list, mark handled, and delete responses.
export default async (req, context) => {
  const id = context.params?.id;

  if (req.method === "POST" && !id) {
    let body;
    try { body = await readJson(req, 20_000); } catch (e) { return json({ error: e.message }, 400); }

    // Quiet spam checks: hidden field filled in, or form submitted inhumanly fast
    if (body.website || Number(body.elapsed) < 2500) return json({ ok: true });

    const content = await site().get("content", { type: "json" });
    if (!content || !content.published || !content.rsvp || !content.rsvp.enabled) {
      return json({ error: "Online RSVPs aren't open right now." }, 403);
    }
    if (content.rsvp.deadline) {
      const today = new Date().toISOString().slice(0, 10);
      if (today > content.rsvp.deadline) return json({ error: "The RSVP deadline has passed. Please contact the couple directly." }, 403);
    }

    const name = cleanText(body.name, 100);
    if (!name) return json({ error: "Please enter your name." }, 400);
    const attending = body.attending === "yes" ? "yes" : body.attending === "no" ? "no" : "";
    if (!attending) return json({ error: "Let us know whether you can attend." }, 400);
    const maxParty = Math.min(Math.max(Number(content.rsvp.maxParty) || 2, 1), 10);
    const partySize = attending === "yes" ? Math.min(Math.max(parseInt(body.partySize, 10) || 1, 1), maxParty) : 0;

    const key = `r-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    await rsvps().setJSON(key, {
      id: key, name, attending, partySize,
      email: cleanText(body.email, 120), phone: cleanText(body.phone, 40),
      guestNames: cleanText(body.guestNames, 400), meal: cleanText(body.meal, 60),
      dietary: cleanText(body.dietary, 300), song: cleanText(body.song, 150), message: cleanText(body.message, 1000),
      submittedAt: new Date().toISOString(), handled: false,
    });
    return json({ ok: true }, 201);
  }

  const { error } = await requireUser(req, req.method === "GET" ? undefined : ["admin", "planner"]);
  if (error) return error;

  if (req.method === "GET" && !id) {
    const { blobs } = await rsvps().list();
    const items = await Promise.all(blobs.map((b) => rsvps().get(b.key, { type: "json" })));
    return json({ rsvps: items.filter(Boolean).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) });
  }

  if (!validKey(id)) return json({ error: "RSVP not found." }, 404);
  const existing = await rsvps().get(id, { type: "json" });
  if (!existing) return json({ error: "RSVP not found." }, 404);

  if (req.method === "PATCH") {
    let body;
    try { body = await readJson(req, 2_000); } catch (e) { return json({ error: e.message }, 400); }
    existing.handled = Boolean(body.handled);
    await rsvps().setJSON(id, existing);
    return json({ rsvp: existing });
  }
  if (req.method === "DELETE") {
    await rsvps().delete(id);
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: ["/api/rsvp", "/api/rsvp/:id"] };
