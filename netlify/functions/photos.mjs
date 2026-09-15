import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { json, requireUser } from "../lib/auth.mjs";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 4_500_000;
const store = () => getStore({ name: "wedding-photos" });
const validId = (id) => /^[0-9a-f-]{36}$/.test(id || "");

// GET /api/photos/:id is public (used by the website). Upload and delete are admin-only.
export default async (req, context) => {
  const id = context.params?.id;

  if (req.method === "GET" && id) {
    if (!validId(id)) return new Response("Not found", { status: 404 });
    const result = await store().getWithMetadata(id, { type: "arrayBuffer" });
    if (!result) return new Response("Not found", { status: 404 });
    return new Response(result.data, {
      headers: {
        "content-type": TYPES.includes(result.metadata?.contentType) ? result.metadata.contentType : "image/jpeg",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (req.method === "POST" && !id) {
    const { error } = await requireUser(req, ["admin"]);
    if (error) return error;
    let body;
    try { body = JSON.parse(await req.text()); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!TYPES.includes(body.contentType)) return json({ error: "Upload a JPEG, PNG or WebP image." }, 400);
    const bytes = Buffer.from(String(body.data || ""), "base64");
    if (!bytes.length) return json({ error: "The image is empty." }, 400);
    if (bytes.length > MAX_BYTES) return json({ error: "That image is too large, even after resizing." }, 413);
    const newId = crypto.randomUUID();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await store().set(newId, buffer, { metadata: { contentType: body.contentType, size: bytes.length, uploadedAt: new Date().toISOString() } });
    return json({ id: newId }, 201);
  }

  if (req.method === "DELETE" && id) {
    const { error } = await requireUser(req, ["admin"]);
    if (error) return error;
    if (!validId(id)) return json({ error: "Invalid photo id" }, 400);
    await store().delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: ["/api/photos", "/api/photos/:id"] };
