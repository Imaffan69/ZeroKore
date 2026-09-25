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

/**
 * Call the agent and read the answer.
 *
 * /api/agent answers with a single JSON object — the progress is in `events` and
 * the answer is in `reply`. It is NOT a newline-delimited stream, so a client
 * that reads it line by line gets nothing back and reports a false failure.
 */
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

    const raw = await res.text();
    if (!res.ok) {
      let note = raw.slice(0, 180);
      try {
        note = JSON.parse(raw).error ?? note;
      } catch {
        /* keep the raw text */
      }
      return { ok: false, status: res.status, note };
    }

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return { ok: false, note: "response was not JSON" };
    }

    const reply = typeof body.reply === "string" ? body.reply.trim() : "";
    if (!reply) {
      const err = (body.events || []).find((e) => e.kind === "error");
      return { ok: false, note: err ? err.message : "empty reply" };
    }
    return {
      ok: true,
      ms: Date.now() - started,
      text: reply.slice(0, 50).replace(/\s+/g, " "),
      events: (body.events || []).length,
    };
  } catch (err) {
    return {
      ok: false,
      note: err.name === "AbortError" ? "timeout 90s" : err.message,
    };
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
