import { createClient } from "@/lib/supabase/client";

export type UploadBucket =
  | "ad-images"
  | "avatars"
  | "business-images"
  | "receipts"
  | "wall-images"
  | "voice-messages"
  | "product-images";

export async function uploadImages(
  files: File[],
  bucket: UploadBucket,
  userId: string
): Promise<string[]> {
  const supabase = createClient();
  const urls: string[] = [];

  for (const file of files) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
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
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
