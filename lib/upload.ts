import { createClient } from "@/lib/supabase/client";

export type UploadBucket =
  | "ad-images"
  | "avatars"
  | "business-images"
  | "receipts"
  | "wall-images"
  | "voice-messages"
  | "product-images";

const MAX_IMAGE_EDGE = 1280;
const AVATAR_MAX_EDGE = 400;
const WEBP_QUALITY = 0.7;
const SKIP_BELOW_BYTES = 200 * 1024;

/**
 * Re-encode common raster images before upload to reduce Storage usage.
 * GIF/SVG and formats the browser cannot decode are kept unchanged.
 */
async function optimizeImage(file: File | Blob, maxEdge = MAX_IMAGE_EDGE, fileName = "image"): Promise<File | Blob> {
  if (!file.type.startsWith("image/") || /image\/(gif|svg\+xml)/i.test(file.type)) {
    return file;
  }

  if (typeof createImageBitmap === "undefined") return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width <= maxEdge && bitmap.height <= maxEdge && file.size < SKIP_BELOW_BYTES) {
      return file;
    }

    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const originalName = file instanceof File ? file.name : fileName;
    const baseName = originalName.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    // Never block uploads because an image decoder does not support a format.
    return file;
  } finally {
    bitmap?.close();
  }
}

export async function uploadImages(
  files: File[],
  bucket: UploadBucket,
  userId: string
): Promise<string[]> {
  const supabase = createClient();
  const urls: string[] = [];

  for (const originalFile of files) {
    const file = (await optimizeImage(originalFile, bucket === "avatars" ? AVATAR_MAX_EDGE : MAX_IMAGE_EDGE)) as File;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function uploadSingleFile(
  input: File | Blob,
  bucket: UploadBucket,
  userId: string,
  extHint = "bin"
): Promise<string> {
  const supabase = createClient();
  const file = input.type.startsWith("image/")
    ? await optimizeImage(input, bucket === "avatars" ? AVATAR_MAX_EDGE : MAX_IMAGE_EDGE)
    : input;
  const ext = file instanceof File ? file.name.split(".").pop() || extHint : extHint;
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
