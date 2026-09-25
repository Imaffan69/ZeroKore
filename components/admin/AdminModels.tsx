"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2, Cpu } from "lucide-react";

interface RegisteredModel {
  id: string;
  label: string;
  kind: string;
  upstream: string;
  base_url: string | null;
  api_key_env: string;
  group_label: string | null;
  enabled: boolean;
  key_present: boolean;
}

const EMPTY = {
  id: "",
  label: "",
  api_key_env: "",
  kind: "openai",
  upstream: "openrouter",
  base_url: "",
  group: "",
};

/**
 * Register an extra model without the key ever touching ZeroKore.
 *
 * The admin types the model id and the NAME of the environment variable that
 * already holds its key. That is deliberate: a key pasted into a web form ends
 * up in a database and in browser history, whereas an env var is rotated and
 * revoked in Vercel like every other provider credential.
 */
export default function AdminModels() {
  const [models, setModels] = useState<RegisteredModel[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/models");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setModels(json.models ?? []);
    else setResult({ ok: false, text: json.error ?? "Could not load models." });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/admin/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      setResult({ ok: true, text: `Registered ${form.id}.` });
      setForm({ ...EMPTY });
      void load();
    } else {
      setResult({ ok: false, text: json.error ?? "Could not register the model." });
    }
  }

  async function remove(id: string) {
    setResult(null);
    const res = await fetch("/api/admin/models", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setResult({ ok: true, text: `Removed ${id}.` });
      void load();
    } else {
      setResult({ ok: false, text: json.error ?? "Could not remove the model." });
    }
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-kore-faint";

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="h-4 w-4 text-kore-mint" /> Add a model
        </h2>
        <p className="mt-1 text-xs text-kore-muted">
          Add the key to your Vercel environment first, then register the model here by
          name. ZeroKore never receives or stores the key itself.
        </p>

        <form onSubmit={register} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className={field}
            placeholder="Model id - e.g. z-ai/glm-5.3-prime"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
            required
          />
          <input
            className={field}
            placeholder="Display label (optional)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
          />
          <input
            className={field}
            placeholder="Env var NAME - e.g. OPENROUTER_API_KEY"
            value={form.api_key_env}
            onChange={(e) => setForm({ ...form, api_key_env: e.target.value })}
            required
          />
          <input
            className={field}
            placeholder="Group (optional) - e.g. Coding"
            value={form.group}
            onChange={(e) => setForm({ ...form, group: e.target.value })}
          />
          <select
            className={field}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
          >
            <option value="openai">OpenAI-compatible API</option>
            <option value="gemini">Gemini generateContent</option>
          </select>
          <select
            className={field}
            value={form.upstream}
            onChange={(e) => setForm({ ...form, upstream: e.target.value })}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="groq">Groq</option>
            <option value="deepseek">DeepSeek</option>
            <option value="sambanova">SambaNova</option>
          </select>
          <input
            className={`${field} sm:col-span-2`}
            placeholder="Custom base URL (optional - blank uses the upstream default)"
            value={form.base_url}
            onChange={(e) => setForm({ ...form, base_url: e.target.value })}
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-kore-mint px-5 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Register model
            </button>
          </div>
        </form>

        {result && (
          <p
            className={`mt-3 text-xs ${result.ok ? "text-kore-mint" : "text-red-400"}`}
            role="status"
          >
            {result.text}
          </p>
        )}
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Registered models ({models.length})
          </h3>
          <button
            onClick={() => void load()}
            className="rounded-full border border-white/15 p-2 text-kore-muted hover:text-white"
            aria-label="Refresh models"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-xs text-kore-muted">Loading...</p>
        ) : models.length === 0 ? (
          <p className="mt-4 text-xs text-kore-muted">
            No extra models registered. The four built-in providers and the
            OpenRouter catalogue are always available.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{m.label || m.id}</p>
                  <p className="truncate text-xs text-kore-muted">
                    {m.id} / {m.upstream} / key from{" "}
                    <code className="text-kore-sage">{m.api_key_env}</code>
                    {!m.key_present && (
                      <span className="ml-2 text-amber-400">
                        - env var not set, hidden from users
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => void remove(m.id)}
                  className="rounded-full border border-red-500/40 p-2 text-red-400 hover:bg-red-500/10"
                  aria-label={`Remove ${m.label || m.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
