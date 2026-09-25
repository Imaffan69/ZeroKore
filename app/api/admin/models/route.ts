import { NextResponse } from "next/server";
import { readJson, readString } from "@/lib/api-auth";
import { requireStaff, adminError } from "@/lib/admin-guard";
import { resetModelCache } from "@/lib/ai/custom-models";

/** Env var names must look like env vars, and never carry a key value. */
const ENV_NAME = /^[A-Z][A-Z0-9_]{2,63}$/;
const MAX_ID = 120;

/**
 * Admin-managed models.
 *
 * An admin registers a model by its id and the NAME of the environment variable
 * that holds its key. The key itself is never accepted here, never stored, and
 * never leaves the server — it stays in the deployment environment, so rotating
 * or revoking it is a Vercel operation exactly like the built-in providers.
 *
 * Registration is rejected unless that env var is actually present, which is
 * what stops a half-finished setup from putting a dead row in the model picker.
 */
export async function GET() {
  try {
    await requireStaff("admin");
    const { createServiceClient } = await import("@/lib/supabase/server");
    const service = await createServiceClient();
    const { data, error } = await service
      .from("ai_models")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json(
        { error: "Model registry unavailable. Run migration 006_ai_models.sql." },
        { status: 503 }
      );
    }
    // Report whether each model's env var is present, without revealing it.
    const rows = (data ?? []).map(
      (r: { api_key_env: string; [k: string]: unknown }) => ({
        ...r,
        key_present: !!process.env[r.api_key_env],
      })
    );
    return NextResponse.json({ models: rows });
  } catch (err) {
    return adminError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireStaff("admin");
    const body = await readJson(req);
    const id = readString(body, "id", MAX_ID);
    const label = readString(body, "label", 80) || id;
    const apiKeyEnv = readString(body, "api_key_env", 64).toUpperCase();
    const kind = readString(body, "kind", 10) === "gemini" ? "gemini" : "openai";
    const upstream = readString(body, "upstream", 20) || "openrouter";
    const baseUrl = readString(body, "base_url", 200) || null;
    const groupLabel = readString(body, "group", 40) || null;

    if (!id) {
      return NextResponse.json({ error: "Model id is required." }, { status: 400 });
    }
    if (!ENV_NAME.test(apiKeyEnv)) {
      return NextResponse.json(
        {
          error:
            "Enter the NAME of the environment variable (A-Z, 0-9, _), not the key itself.",
        },
        { status: 400 }
      );
    }
    if (!process.env[apiKeyEnv]) {
      return NextResponse.json(
        {
          error: `${apiKeyEnv} is not set on this deployment. Add it in Vercel, redeploy, then register the model.`,
        },
        { status: 400 }
      );
    }

    const { createServiceClient } = await import("@/lib/supabase/server");
    const service = await createServiceClient();
    const { error } = await service.from("ai_models").upsert(
      {
        id,
        label,
        kind,
        upstream,
        base_url: baseUrl,
        api_key_env: apiKeyEnv,
        group_label: groupLabel,
        enabled: true,
        created_by: actor.userId,
      },
      { onConflict: "id" }
    );
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    resetModelCache();
    try {
      await service.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "model_register",
        detail: { id, api_key_env: apiKeyEnv, kind },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return adminError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requireStaff("admin");
    const body = await readJson(req);
    const id = readString(body, "id", MAX_ID);
    if (!id) {
      return NextResponse.json({ error: "Model id is required." }, { status: 400 });
    }
    const { createServiceClient } = await import("@/lib/supabase/server");
    const service = await createServiceClient();
    const { error } = await service.from("ai_models").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    resetModelCache();
    try {
      await service.from("admin_audit").insert({
        actor_id: actor.userId,
        actor_label: actor.username,
        action: "model_remove",
        detail: { id },
      });
    } catch {
      // best effort
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return adminError(err);
  }
}