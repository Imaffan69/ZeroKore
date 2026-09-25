"use strict";

/**
 * Sweep every configured model through the real agent endpoint.
 *
 * This is the check that matters: not "does the provider answer a bare
 * prompt" (which passed for all 15 OpenRouter models) but "does the whole
 * pipeline work" — auth, credits, tools, streaming events and the final
 * message, through /api/agent exactly as a user would call it.
 *
 * Usage: node scripts/sweep-models.js [baseUrl]
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = (process.argv[2] || process.env.ZEROKORE_URL || "https://zerokore.vercel.app").replace(
  /\/+$/,
  ""
);
const CONFIG = path.join(os.homedir(), ".zerokore", "config.json");

function token() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  if (!cfg.accessToken) throw new Error("Run `zerokore login` first.");
  return cfg.accessToken;
}

async function models(bearer) {
  const res = await fetch(`${BASE}/api/health`);
  const body = await res.json();
  return (body.models || []).filter((m) => m.configured);
}

/** Call the agent, collecting streamed events until the stream ends. */
async function runModel(bearer, modelId, projectId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}/api/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify({
        message: "Reply with exactly the word OK and nothing else.",
        mode: "general",
        projectId,
        provider: modelId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, note: text.slice(0, 160) };
    }

    let text = "";
    const kinds = new Set();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.kind) kinds.add(event.kind);
          if (event.kind === "completed" && event.text) text = event.text;
          if (event.kind === "error") text = `ERROR: ${event.message}`;
        } catch {
          /* partial line */
        }
      }
    }
    return {
      ok: text.length > 0 && !text.startsWith("ERROR"),
      ms: Date.now() - started,
      text: text.slice(0, 60).replace(/\s+/g, " "),
      events: kinds.size,
    };
  } catch (err) {
    return { ok: false, note: err.name === "AbortError" ? "timeout 90s" : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const bearer = token();
  const all = await models(bearer);
  console.log(`sweeping ${all.length} configured models against ${BASE}\n`);

  // A real project, so the agent runs with the same context a user gets.
  let projectId = null;
  try {
    const res = await fetch(`${BASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ name: "model-sweep" }),
    });
    const body = await res.json().catch(() => ({}));
    projectId = body.project?.id ?? null;
  } catch {
    /* the sweep still works without a project */
  }

  const results = [];
  for (const m of all) {
    const r = await runModel(bearer, m.id, projectId);
    results.push({ id: m.id, ...r });
    const mark = r.ok ? "PASS" : "FAIL";
    const detail = r.ok
      ? `${String(r.ms).padStart(6)}ms  ${r.text}`
      : `${r.status ?? ""} ${r.note ?? ""}`.trim();
    console.log(`${mark}  ${m.id.padEnd(52)} ${detail}`);
    // Be gentle with free-tier rate limits.
    await new Promise((res) => setTimeout(res, 2500));
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} models returned a real answer.`);
  if (passed < results.length) {
    console.log("\nfailures:");
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  ${r.id} :: ${r.status ?? ""} ${r.note ?? ""}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
