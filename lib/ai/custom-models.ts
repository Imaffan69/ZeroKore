import { createServiceClient } from "@/lib/supabase/server";
import { OPENROUTER_BASE } from "@/lib/ai/openrouter";

export interface CustomModel {
  id: string;
  label: string;
  kind: "openai" | "gemini";
  upstream: string;
  baseUrl: string | null;
  apiKeyEnv: string;
  group: string | null;
}

interface AiModelRow {
  id: string;
  label: string;
  kind: "openai" | "gemini";
  upstream: string;
  base_url: string | null;
  api_key_env: string;
  group_label: string | null;
  enabled: boolean;
}

/**
 * Resolve the API key for a model, by environment-variable *name*.
 *
 * The key never travels through the browser or the database. An admin registers
 * `api_key_env: "ACME_API_KEY"`, that variable is read from the server
 * environment, and if it is missing the model is skipped entirely — so the
 * picker can never offer a model that would fail on click.
 */
function keyForEnv(name: string): string | undefined {
  return process.env[name];
}

/** Base URL for a model's upstream, allowing an explicit override. */
function baseUrlFor(upstream: string, override: string | null): string | null {
  if (override) return override.replace(/\/+$/, "");
  if (upstream === "openrouter") return OPENROUTER_BASE;
  if (upstream === "groq") return "https://api.groq.com/openai/v1";
  if (upstream === "deepseek") return "https://api.deepseek.com/v1";
  if (upstream === "sambanova") return "https://api.sambanova.ai/v1";
  return null;
}

let cache: { at: number; models: CustomModel[] } | null = null;
const TTL_MS = 30_000;

/**
 * Admin-registered models that are actually usable right now.
 *
 * Cached briefly so the model picker does not hit the database on every request,
 * and every failure path degrades to "no custom models" rather than throwing —
 * a missing 006 migration must not break the agent.
 */
export async function customModels(): Promise<CustomModel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.models;

  let out: CustomModel[] = [];
  try {
    const service = await createServiceClient();
    const { data, error } = await service
      .from("ai_models")
      .select(
        "id,label,kind,upstream,base_url,api_key_env,group_label,enabled"
      )
      .eq("enabled", true);
    if (!error && Array.isArray(data)) {
      out = (data as AiModelRow[])
        .filter((row) => !!keyForEnv(row.api_key_env))
        .map((row) => ({
          id: row.id,
          label: row.label,
          kind: row.kind,
          upstream: row.upstream,
          baseUrl: baseUrlFor(row.upstream, row.base_url),
          apiKeyEnv: row.api_key_env,
          group: row.group_label,
        }))
        .filter((m) => m.kind === "gemini" || !!m.baseUrl);
    }
  } catch {
    // Table missing (006 not applied yet) — built-in models still work.
    out = [];
  }

  cache = { at: Date.now(), models: out };
  return out;
}

/** Force the next read to hit the database again (after an admin write). */
export function resetModelCache(): void {
  cache = null;
}

/**
 * The complete model list shown to users: four built-in providers, the built-in
 * OpenRouter catalogue, and anything an admin registered.
 */
/** Whether a provider name refers to an admin-registered model. */
export function isCustomProviderName(name: string): boolean {
  return name.toLowerCase().startsWith("custom:");
}

/** Extract the model id from a `Custom:<id>` provider name. */
export function customModelIdFromName(name: string): string | null {
  if (!isCustomProviderName(name)) return null;
  const id = name.slice("custom:".length).trim();
  return id || null;
}
