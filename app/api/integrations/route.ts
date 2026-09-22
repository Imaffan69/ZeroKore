import { NextResponse } from "next/server";
import { requireUser, errorResponse, readJson, readString } from "@/lib/api-auth";
import { encryptSecret, decryptSecret, isEncryptionConfigured } from "@/lib/crypto";

/**
 * BYO AI credentials & integration keys.
 *
 * Keys are AES-256-GCM encrypted with the server key before storage and are
 * only ever decrypted server-side; the API returns masked previews, never
 * plaintext values.
 */

const PROVIDERS = ["groq", "deepseek", "sambanova", "gemini", "openai", "github"] as const;
type Provider = (typeof PROVIDERS)[number];

function mask(value: string): string {
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data } = await supabase
      .from("integrations")
      .select("id, provider, label, encrypted_key, created_at")
      .eq("user_id", user.id);
    const integrations = (data ?? []).map((row) => {
      let preview = "••••••••";
      try {
        preview = mask(decryptSecret(row.encrypted_key));
      } catch {
        // undecryptable (wrong key) — show placeholder
      }
      return { id: row.id, provider: row.provider, label: row.label, preview, createdAt: row.created_at };
    });
    return NextResponse.json({ integrations, encryptionConfigured: isEncryptionConfigured() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    if (!isEncryptionConfigured()) {
      return NextResponse.json(
        { error: "Key storage is not configured on this server yet." },
        { status: 503 }
      );
    }
    const { supabase, user } = await requireUser();
    const body = await readJson(req);
    const provider = readString(body, "provider", 20) as Provider;
    const apiKey = readString(body, "key", 500);
    const label = readString(body, "label", 100) || null;
    if (!PROVIDERS.includes(provider) || apiKey.length < 8) {
      return NextResponse.json({ error: "Choose a provider and paste a valid key." }, { status: 400 });
    }
    const { error } = await supabase.from("integrations").upsert(
      { user_id: user.id, provider, encrypted_key: encryptSecret(apiKey), label },
      { onConflict: "user_id,provider" }
    );
    if (error) return NextResponse.json({ error: "Could not save the key." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await readJson(req);
    const provider = readString(body, "provider", 20) as Provider;
    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
    }
    await supabase.from("integrations").delete().eq("user_id", user.id).eq("provider", provider);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
