import { issueCode, takeCode, issueGrant, takeGrant } from "../lib/auth/device-codes.ts";
let pass = 0, fail = 0;
const ok = (n, c) => { c ? pass++ : (fail++, console.log("FAIL: " + n)); };

const c1 = issueCode();
ok("fresh code accepted", takeCode(c1) === true);
ok("replayed code rejected", takeCode(c1) === false);
ok("unknown code rejected", takeCode("nope") === false);

const g1 = issueGrant("user-1");
ok("grant resolves its user", takeGrant(g1) === "user-1");
ok("grant is single-use", takeGrant(g1) === null);

const g2 = issueGrant("user-2");
ok("grants are distinct", g1 !== g2 && takeGrant(g2) === "user-2");

ok("codes and grants do not collide", takeGrant(issueCode()) === null);

const c2 = issueCode();
ok("code is not a grant", takeGrant(c2) === null && takeCode(c2) === true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

