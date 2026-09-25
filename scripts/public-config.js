"use strict";

/**
 * Print the PUBLIC Supabase config embedded in the deployed client bundle.
 *
 * The anon key is public by design — it ships in every browser — so this only
 * re-reads what any visitor's browser already has. Used to run the production
 * server locally against the real project, so a production-only render error can
 * be reproduced with its real error message instead of a redacted digest.
 */

const BASE = process.env.ZEROKORE_URL || "https://zerokore.vercel.app";

async function main() {
  const login = await (await fetch(`${BASE}/login`)).text();
  const srcs = [...login.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(
    (m) => m[0]
  );
  const seen = new Set();

  for (const src of srcs) {
    if (seen.has(src)) continue;
    seen.add(src);
    let js = "";
    try {
      js = await (await fetch(`${BASE}${src}`)).text();
    } catch {
      continue;
    }
    const url = js.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
    const key = js.match(
      /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]{100,}/
    );
    if (url && key) {
      console.log(`NEXT_PUBLIC_SUPABASE_URL=${url[0]}`);
      console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${key[0]}`);
      return;
    }
  }
  console.error("public Supabase config not found in client chunks");
  process.exitCode = 1;
}

main();
