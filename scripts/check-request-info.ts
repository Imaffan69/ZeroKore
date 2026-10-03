/**
 * Throwaway sanity check for request metadata: run with `bun scripts/check-request-info.ts`.
 * Verifies that different devices behind the same proxy resolve to different
 * addresses, and that coordinates survive the provider chain.
 */
import { extractIp, normalizeIp, isPublicIp, geolocateIp } from "../lib/request-info";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.test/", { headers });
}

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} -> ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

// normalizeIp
check("normalize brackets", normalizeIp("[2001:db8::1]:443"), "2001:db8::1");
check("normalize port", normalizeIp("8.8.8.8:51234"), "8.8.8.8");
check("normalize mapped v4", normalizeIp("::ffff:8.8.4.4"), "8.8.4.4");
check("normalize quotes", normalizeIp('"1.1.1.1"'), "1.1.1.1");
check("normalize junk", normalizeIp("unknown"), null);
check("normalize garbage", normalizeIp("not-an-ip"), null);

// isPublicIp
check("public v4", isPublicIp("8.8.8.8"), true);
check("documentation range is not a visitor", isPublicIp("203.0.113.7"), false);
check("private 10/8", isPublicIp("10.1.2.3"), false);
check("cgnat", isPublicIp("100.100.1.1"), false);
check("link-local v6", isPublicIp("fe80::1"), false);
check("public v6", isPublicIp("2606:4700::1111"), true);

// extractIp — the bug: a proxy that sets x-real-ip to its own address made every
// device look identical because that header was consulted first.
check(
  "laptop vs phone behind same proxy",
  [
    extractIp(
      req({
        "x-real-ip": "10.0.0.7",
        "x-forwarded-for": "8.8.8.8, 10.0.0.7",
        "user-agent": "Mozilla/5.0 (Macintosh)",
      })
    ),
    extractIp(
      req({
        "x-real-ip": "10.0.0.7",
        "x-forwarded-for": "1.1.1.1, 10.0.0.7",
        "user-agent": "Mozilla/5.0 (iPhone)",
      })
    ),
  ],
  ["8.8.8.8", "1.1.1.1"]
);

check(
  "cloudflare edge header wins",
  extractIp(req({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "10.0.0.7" })),
  "1.1.1.1"
);

check("local dev falls back", extractIp(req({ "x-forwarded-for": "127.0.0.1" })), "127.0.0.1");
check("no headers", extractIp(req({})), null);

// geolocation chain — 8.8.8.8 is public and stable, so a lookup must place it.
const geo = await geolocateIp("8.8.8.8");
console.log("geolocateIp(8.8.8.8) ->", JSON.stringify(geo));
if (!geo || geo.latitude === null || geo.longitude === null) {
  console.log("FAIL geolocation returned no coordinates");
  failures++;
} else {
  console.log(`ok   geolocation via ${geo.provider}: ${geo.city}, ${geo.country}`);
}
check("private addresses are never looked up", await geolocateIp("192.168.1.5"), null);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);