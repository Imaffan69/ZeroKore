/**
 * Diagnostic: reproduce an authenticated request against the deployed site.
 *
 * The Supabase anon key is public by design and is inlined into the client
 * chunks, so this script can build a real session with a real account and call
 * the protected API routes — which is the only reliable way to see the actual
 * status/body instead of guessing at a 500.
 *
 * Usage:
 *   node scripts/diag-login.js <email> <password>
 */

"use strict";

const BASE = process.env.ZEROKORE_URL || "https://zerokore.vercel.app";
const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("usage: node scripts/diag-login.js <email> <password>");
  process.exit(1);
}

function get(url, headers = {}) {
  return fetch(url, { headers, redirect: "manual" });
}

async function findPublicConfig() {
  const page = await get(`${BASE}/login`);
  const html = await page.text();
  const scripts = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
    (m) => m[0]
  );
  for (const src of scripts) {
    const js = await (await get(`${BASE}${src}`)).text();
    const url = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    const key = js.match(
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]{100,}/
    );
    if (url && key) return { url: url[0], key: key[0] };
  }
  throw new Error("Could not locate the public Supabase config in the client chunks.");
}

async function signIn({ url, key }) {
  // The token endpoint is POST-only; a GET returns 405 with an empty body,
  // which is what made the first run of this script look like a failed login.
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!body.access_token) {
    throw new Error(
      `Sign-in failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`
    );
  }
  return body.access_token;
}

/** Routes a normal signed-in user hits, in the order the app calls them. */
const ROUTES = [
  ["GET", "/api/account/identity"],
  ["GET", "/api/account/credits"],
  ["GET", "/api/usage"],
  ["GET", "/api/projects"],
  ["GET", "/api/github"],
  ["GET", "/api/github/repos"],
  ["GET", "/api/account/events"],
  ["GET", "/api/conversations"],
  ["GET", "/api/skills"],
  ["GET", "/api/account/username"],
  ["GET", "/dashboard"],
  ["GET", "/settings"],
  ["GET", "/account"],
];

(async () => {
  try {
    const config = await findPublicConfig();
    console.log(`origin: ${config.url}`);
    const token = await signIn(config);
    console.log("signed in OK\n");

    let failures = 0;
    for (const [method, path] of ROUTES) {
      const res = await get(`${BASE}${path}`, {
        Authorization: `Bearer ${token}`,
        apikey: config.key,
      });
      const text = await res.text();
      const ok = res.status < 400;
      if (!ok) failures += 1;
      console.log(
        `${ok ? "ok  " : "FAIL"} ${String(res.status).padEnd(4)} ${path}` +
          (ok ? "" : `\n      ${text.slice(0, 300)}`)
      );
    }
    console.log(`\n${failures} failing route(s).`);
  } catch (err) {
    console.error("diagnostic failed:", err.message);
    process.exit(1);
  }
})();
