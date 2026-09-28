#!/usr/bin/env node

"use strict";

/**
 * ZeroKore CLI.
 *
 * A real client for the same account and projects the web app uses. Every
 * command performs a real HTTP call against the API — there is no local
 * simulation and no offline mode that pretends to have worked.
 *
 * Auth: `zerokore login` exchanges your email and password for a Supabase access
 * token and stores it in ~/.zerokore/config.json (mode 0600). That token is sent
 * as `Authorization: Bearer <token>`, which the API verifies server-side.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const CONFIG_DIR = path.join(os.homedir(), ".zerokore");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const BASE = (process.env.ZEROKORE_URL || "https://zerokore.vercel.app").replace(
  /\/+$/,
  ""
);

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  mint: "\x1b[92m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

function loadConfig() {
  try {
    // Strip a leading BOM: a config written by a Windows editor or by PowerShell
    // starts with U+FEFF, which makes JSON.parse throw and would otherwise
    // look exactly like "you are not signed in".
    const raw = fs.readFileSync(CONFIG_FILE, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  // The token is a live credential: keep the file owner-only.
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(CONFIG_FILE, 0o600);
  } catch {
    /* best effort on Windows */
  }
}

function fail(message, code = 1) {
  console.error(`${C.red}error${C.reset} ${message}`);
  process.exit(code);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    })
  );
}

/**
 * Exchange the stored refresh token for a new access token.
 *
 * A Supabase access token lasts about an hour. Without this the CLI simply
 * started failing with 401 some time after `login`, and the only remedy was to
 * type the password again — not something a tool should demand. The refresh
 * token is long-lived, so it is stored alongside and swapped silently; a
 * failure here is not fatal, the next call just surfaces the 401.
 */
async function refreshSession() {
  const cfg = loadConfig();
  if (!cfg.refreshToken) return null;
  try {
    const pub = await publicSupabaseConfig();
    if (!pub) return null;
    const res = await fetch(pub.url + "/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: { apikey: pub.anon, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: cfg.refreshToken }),
    });
    const body = await res.json().catch(() => ({}));
    if (!body.access_token) return null;
    saveConfig({
      ...cfg,
      accessToken: body.access_token,
      refreshToken: body.refresh_token || cfg.refreshToken,
    });
    return body.access_token;
  } catch {
    return null;
  }
}

/** Authenticated API call, renewing the session once if the token expired. */
async function api(pathname, options = {}) {
  const cfg = loadConfig();
  if (!cfg.accessToken) fail("Not signed in. Run: zerokore login");

  const send = (token) =>
    fetch(`${BASE}${pathname}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

  let res = await send(cfg.accessToken);

  // 401 means the access token expired or was revoked: renew once, then retry.
  if (res.status === 401) {
    const fresh = await refreshSession();
    if (fresh) res = await send(fresh);
  }

  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }
  if (!res.ok) {
    if (res.status === 401) fail("Session expired. Run: zerokore login");
    fail(body.error || `${pathname} failed (${res.status})`);
  }
  return body;
}

/**
 * The public Supabase config is embedded in the site's client bundle — it is
 * public by design, and reading it here means the CLI needs no local setup.
 */
async function publicSupabaseConfig() {
  const login = await (await fetch(`${BASE}/login`)).text();
  const srcs = [...login.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
    (m) => m[0]
  );
  for (const src of srcs) {
    const js = await (await fetch(`${BASE}${src}`)).text();
    const u = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    const k = js.match(
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]{100,}/
    );
    if (u && k) return { url: u[0], anon: k[0] };
  }
  return null;
}

/* ------------------------------------------------------------- commands */

const commands = {};

commands.login = async () => {
  // Non-interactive first (flags or env), so the CLI is scriptable and
  // testable; otherwise prompt. A piped stdin cannot answer two sequential
  // readline questions, which is why flags exist rather than being a nicety.
  const flags = {};
  for (let i = 0; i < process.argv.length - 2; i += 1) {
    const m = process.argv[i + 2].match(/^--([^=]+)=(.*)$/);
    if (m) flags[m[1]] = m[2];
  }
  const email =
    flags.email ||
    process.env.ZEROKORE_EMAIL ||
    (await ask("email: "));
  const password =
    flags.password ||
    process.env.ZEROKORE_PASSWORD ||
    (await ask("password: "));
  if (!email || !password) fail("Email and password are required.");

  const cfg = await publicSupabaseConfig();
  if (!cfg) fail("Could not read the public API configuration.");

  const res = await fetch(cfg.url + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: cfg.anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.access_token) {
    fail(body.error_description || body.msg || "Sign-in failed.");
  }

  saveConfig({
    email: email,
    accessToken: body.access_token,
    // Long-lived, so the CLI can renew itself instead of demanding the
    // password again every time the short-lived access token expires.
    refreshToken: body.refresh_token,
    base: BASE,
  });
  console.log(C.green + "signed in" + C.reset + " as " + email);
};

commands.logout = async () => {
  try {
    fs.unlinkSync(CONFIG_FILE);
  } catch {
    /* already gone */
  }
  console.log(C.green + "signed out" + C.reset);
};

commands.whoami = async () => {
  const me = await api("/api/account/identity");
  console.log(
    C.bold + (me.username || "(no username)") + C.reset + "  " + C.dim + me.email + C.reset
  );
  console.log(C.dim + "role" + C.reset + " " + me.role);
};

commands.projects = async () => {
  const body = await api("/api/projects");
  const projects = body.projects || [];
  if (!projects.length) {
    console.log(C.dim + "no projects yet - create one with: zerokore new <name>" + C.reset);
    return;
  }
  for (const p of projects) {
    const when = p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : "";
    console.log(
      C.mint + String(p.slug || "").padEnd(24) + C.reset + (p.name || "") + "  " + C.dim + when + C.reset
    );
  }
};

commands.new = async (name) => {
  if (!name) fail("Usage: zerokore new <project-name>");
  const body = await api("/api/projects", {
    method: "POST",
    body: JSON.stringify({ name: name }),
  });
  const p = body.project || {};
  console.log(
    C.green + "created" + C.reset + " " + (p.name || name) + "  " + C.dim + BASE + "/" + p.slug + C.reset
  );
};

commands.files = async (slug) => {
  if (!slug) fail("Usage: zerokore files <project-slug>");
  const body = await api("/api/projects/" + encodeURIComponent(slug) + "/files");
  const files = body.files || [];
  if (!files.length) {
    console.log(C.dim + "no files yet" + C.reset);
    return;
  }
  for (const f of files) {
    console.log(C.mint + f.path + C.reset + "  " + C.dim + (f.size || 0) + " bytes" + C.reset);
  }
};

commands.cat = async (slug, filePath) => {
  if (!slug || !filePath) fail("Usage: zerokore cat <project-slug> <file-path>");
  const body = await api("/api/projects/" + encodeURIComponent(slug) + "/files");
  const file = (body.files || []).find((f) => f.path === filePath);
  if (!file) fail("No such file: " + filePath);
  const one = await api(
    "/api/projects/" + encodeURIComponent(slug) + "/files?path=" + encodeURIComponent(filePath)
  );
  console.log(one.content || "");
};

commands.ask = async (prompt, projectSlug) => {
  if (!prompt) fail('Usage: zerokore ask "<what you want>" [--project <slug>]');
  console.log(C.dim + "thinking..." + C.reset);

  // Resolve the project when asked, so the agent runs with real file context.
  let projectId = null;
  if (projectSlug) {
    const body = await api("/api/projects");
    const found = (body.projects || []).find(function (p) {
      return p.slug === projectSlug;
    });
    if (!found) fail("No project with slug " + projectSlug);
    projectId = found.id;
  }

  const res = await fetch(BASE + "/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (loadConfig().accessToken || ""),
    },
    body: JSON.stringify({ message: prompt, mode: "coding", projectId: projectId }),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try {
      msg = JSON.parse(text).error || msg;
    } catch (e) {
      /* not JSON */
    }
    fail("Agent failed (" + res.status + "): " + msg);
  }

  // The endpoint answers with a single JSON object; the agent's progress lives
  // in `events` and the answer in `reply`.
  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    fail("Could not read the agent response.");
  }

  if (body.events) {
    for (const event of body.events) {
      if (event.kind === "agent_started") continue;
      if (event.kind === "error") {
        console.log(C.red + "! " + event.message + C.reset);
      } else {
        console.log(C.dim + "- " + event.message + C.reset);
      }
    }
  }
  if (body.provider) {
    console.log(C.dim + "via " + body.provider + C.reset);
  }
  console.log("\n" + C.bold + (body.reply || "") + C.reset);
};
commands.help = () => {
  console.log([
    "",
    C.bold + "zerokore" + C.reset + " - the ZeroKore command line",
    "",
    C.bold + "usage" + C.reset,
    "  zerokore <command> [args]",
    "",
    C.bold + "commands" + C.reset,
    "  login                 sign in with your ZeroKore account",
    "  logout                remove the saved token",
    "  whoami                show the signed-in account",
    "  projects              list your projects",
    "  new <name>            create a project",
    "  files <slug>          list a project's files",
    "  cat <slug> <path>     print a file",
    '  ask "<prompt>"        run the agent',
    "  help                  this text",
    "",
    C.dim + "Token stored in " + CONFIG_FILE + " (owner-readable only)." + C.reset,
    C.dim + "Override the server with ZEROKORE_URL." + C.reset,
    "",
  ].join("\n"));
};

/* ------------------------------------------------------------------ main */

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const args = argv.slice(1);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    commands.help();
    return;
  }
  const fn = commands[command];
  if (!fn) {
    console.error(C.red + "Unknown command" + C.reset + " " + command);
    commands.help();
    process.exit(1);
  }
  await fn.apply(null, args);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
