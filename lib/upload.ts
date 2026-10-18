import { createClient } from "@/lib/supabase/client";

export type UploadBucket =
  | "ad-images"
  | "avatars"
  | "business-images"
  | "receipts"
  | "wall-images"
  | "voice-messages"
  | "product-images";

const MAX_IMAGE_EDGE = 1200;
const WEBP_QUALITY = 0.78;

/**
 * Re-encode common raster images before upload to reduce Storage usage.
 * GIF/SVG and formats the browser cannot decode are kept unchanged.
 */
async function optimizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || /image\/(gif|svg\+xml)/i.test(file.type)) {
    return file;
  }

  if (typeof createImageBitmap === "undefined") return file;

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width <= MAX_IMAGE_EDGE && bitmap.height <= MAX_IMAGE_EDGE && file.size < 350 * 1024) {
      return file;
    }

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
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

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
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
    const file = await optimizeImage(originalFile);
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
  file: File | Blob,
  bucket: UploadBucket,
  userId: string,
  extHint = "bin"
): Promise<string> {
  const supabase = createClient();
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
