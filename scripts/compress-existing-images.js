// One-off: recompress large images already in Storage (same path, so URLs keep working).
// Usage: node scripts/compress-existing-images.js [--dry-run]
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const dry = process.argv.includes("--dry-run");
const supabase = createClient(url, key, { auth: { persistSession: false } });

const BUCKETS = ["wall-images", "ad-images", "product-images", "business-images", "avatars"];
const MIN_BYTES = 300 * 1024;
const MAX_EDGE = 1280;
const QUALITY = 70;

async function* walk(bucket, prefix = "") {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset });
    if (error) throw error;
    if (!data?.length) return;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) yield* walk(bucket, path); // folder
      else yield { path, size: item.metadata?.size ?? 0, mime: item.metadata?.mimetype ?? "" };
    }
    if (data.length < 100) return;
  }
}

let saved = 0, done = 0, failed = 0;
for (const bucket of BUCKETS) {
  for await (const f of walk(bucket)) {
    if (!f.mime.startsWith("image/") || /gif|svg/.test(f.mime) || f.size < MIN_BYTES) continue;
    try {
      const { data: blob, error } = await supabase.storage.from(bucket).download(f.path);
      if (error) throw error;
      const input = Buffer.from(await blob.arrayBuffer());
      const out = await sharp(input).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: QUALITY }).toBuffer();
      if (out.length >= input.length * 0.9) continue;
      saved += input.length - out.length; done++;
      if (!dry) {
        const { error: upErr } = await supabase.storage.from(bucket).upload(f.path, out, {
          upsert: true, contentType: "image/webp", cacheControl: "31536000",
        });
        if (upErr) throw upErr;
      }
    } catch (e) {
      failed++; console.error(bucket, f.path, e.message);
    }
  }
}
console.log(JSON.stringify({ dryRun: dry, files: done, savedMB: +(saved / 1048576).toFixed(1), failed }));
