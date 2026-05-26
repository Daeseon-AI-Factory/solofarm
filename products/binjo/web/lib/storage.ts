import { createClient } from "@supabase/supabase-js";

// CORE_CANDIDATE — reusable file upload to Supabase Storage

const BUCKET = "images";

// Lazy initialization — avoids crashing at import time if env vars are missing
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase environment variables are not set (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function uploadImage(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseClient();

  // Sanitize filename — remove spaces and special chars
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${safeName}`;

  // Convert Buffer to Uint8Array — Supabase SDK expects this
  const uint8 = new Uint8Array(file);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, uint8, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
