const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "components", "landing", "LandingPage.tsx");
let content = fs.readFileSync(file, "utf8");

// Fix UTF-8 characters that were saved as Windows-1252 / double-encoded
const map = [
  [/Ã¢â‚¬â€/g, "—"],
  [/Ã¢â‚¬â„¢/g, "’"],
  [/Ã¢â‚¬Å“/g, "“"],
  [/Ã¢â‚¬\u009d/g, "”"],
  [/Ã¢â€\u0086â€™/g, "→"],
  [/Ã¢â‚¬Â¢/g, "•"],
  [/Ã‚Â·/g, "·"],
  [/Ã‚/g, ""],
  [/Â·/g, "·"],
  [/â€”/g, "—"],
  [/â€™/g, "’"],
  [/â€œ/g, "“"],
  [/â€\u009d/g, "”"],
  [/â†’/g, "→"],
  [/â€¢/g, "•"],
];

let changed = 0;
for (const [pattern, replacement] of map) {
  const next = content.replace(pattern, replacement);
  if (next !== content) {
    changed++;
    content = next;
  }
}

fs.writeFileSync(file, content, "utf8");
console.log(`Cleaned ${changed} patterns in LandingPage.tsx`);
