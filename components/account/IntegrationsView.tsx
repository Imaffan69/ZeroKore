"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, KeyRound } from "lucide-react";

interface Integration {
  id: string;
  provider: string;
  label: string | null;
  preview: string;
  createdAt: string;
}

const PROVIDERS = ["groq", "deepseek", "sambanova", "gemini", "openai", "github"] as const;

const LABELS: Record<string, string> = {
  groq: "Groq API key",
  deepseek: "DeepSeek API key",
  sambanova: "SambaNova API key",
  gemini: "Gemini API key",
  openai: "OpenAI API key",
  github: "GitHub token",
};

/**
 * BYO credentials. Keys are AES-256-GCM encrypted server-side; the browser
 * only ever sees a masked preview. A stored key takes priority over the
 * platform key for that provider in agent runs (roadmap wiring).
 */
export default function IntegrationsView() {
  const [items, setItems] = useState<Integration[]>([]);
  const [configured, setConfigured] = useState(true);
  const [provider, setProvider] = useState<string>("groq");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        setItems(data.integrations ?? []);
        setConfigured(data.encryptionConfigured !== false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, key }),
      });
      const data = await res.json();
      setMsg(res.ok ? "Key saved (encrypted)." : data.error);
      if (res.ok) {
        setKey("");
        load();
      }
    } catch {
      setMsg("Connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: string) {
    await fetch("/api/integrations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: p }),
    });
    load();
  }

  if (loading) return <Loader2 className="mx-auto mt-10 h-4 w-4 animate-spin text-kore-muted" />;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-white">Bring your own keys</p>
        <p className="mt-1 text-xs leading-relaxed text-kore-muted">
          Stored AES-256-GCM encrypted, decrypted only server-side, never shown
          in full again. Your key takes priority over the platform key for that
          provider.
        </p>
        {!configured && (
          <p className="mt-2 text-xs text-amber-400">
            Key storage is not configured on this server yet (missing
            ENCRYPTION_KEY).
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2.5 text-sm text-kore-text"
          >
            {PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {LABELS[p]}
              </option>
            ))}
          </select>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            placeholder="Paste key…"
            className="flex-1 rounded-xl border border-kore-border bg-kore-bg/60 px-3 py-2.5 font-mono text-sm text-kore-text placeholder:text-kore-muted focus:border-white/30 focus:outline-none"
          />
          <button
            onClick={save}
            disabled={busy || key.length < 8 || !configured}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-kore-accent px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </button>
        </div>
        {msg && <p className="mt-2 text-xs text-kore-accent">{msg}</p>}
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-sm font-semibold text-white">Stored credentials</p>
        {items.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-kore-muted">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> None yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((it) => (
              <li key={it.id} className="glass-subtle flex items-center gap-3 rounded-xl px-3.5 py-2.5">
                <KeyRound className="h-3.5 w-3.5 shrink-0 text-kore-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs text-kore-text">
                  {LABELS[it.provider] ?? it.provider}
                </span>
                <span className="font-mono text-[10px] text-kore-muted">{it.preview}</span>
                <button
                  onClick={() => remove(it.provider)}
                  className="rounded p-1.5 text-kore-muted transition hover:text-red-300"
                  aria-label={`Remove ${it.provider}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
