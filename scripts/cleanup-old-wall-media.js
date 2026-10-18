import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAYS = 7;
const PAGE_SIZE = 200;
const BUCKETS = new Set(["wall-images", "wall-audio"]);

function objectFromPublicUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    const remainder = url.pathname.slice(index + marker.length);
    const slash = remainder.indexOf("/");
    if (slash < 1) return null;
    const bucket = decodeURIComponent(remainder.slice(0, slash));
    const path = remainder.slice(slash + 1).split("/").map(decodeURIComponent).join("/");
    if (!BUCKETS.has(bucket) || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  let scanned = 0;
  let cleared = 0;
  let failed = 0;
  let offset = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from("wall_messages")
      .select("id, image_url, audio_url")
      .lt("created_at", cutoff)
      .or("image_url.not.is.null,audio_url.not.is.null")
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!rows?.length) break;
    scanned += rows.length;

    // Process one record at a time: clear its URL only after its file was removed.
    for (const row of rows) {
      let changed = false;
      const patch = {};
      for (const column of ["image_url", "audio_url"]) {
        const object = objectFromPublicUrl(row[column]);
        if (!object) continue; // Leave unknown/external URLs untouched.
        const { error: removeError } = await supabase.storage
          .from(object.bucket)
          .remove([object.path]);
        if (removeError) {
          failed++;
          console.error("Storage remove failed", { messageId: row.id, bucket: object.bucket, error: removeError.message });
          continue;
        }
        patch[column] = null;
        changed = true;
      }

      if (changed) {
        const { error: updateError } = await supabase
          .from("wall_messages")
          .update(patch)
          .eq("id", row.id);
        if (updateError) {
          failed++;
          console.error("Could not clear old media URL", { messageId: row.id, error: updateError.message });
        } else {
          cleared++;
        }
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(JSON.stringify({ success: failed === 0, cutoff, scanned, recordsCleared: cleared, failures: failed }));
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Wall media cleanup failed:", error);
  process.exitCode = 1;
});
