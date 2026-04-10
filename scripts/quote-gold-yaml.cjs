const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "../docs/bourbon_cards.yaml");
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const out = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^(\s+)gold:\s*(.*)$/);
  if (!m) {
    out.push(line);
    continue;
  }
  const indent = m[1];
  let rest = m[2];
  if (!rest.startsWith("**")) {
    out.push(line);
    continue;
  }
  const parts = [rest];
  while (i + 1 < lines.length) {
    const next = lines[i + 1];
    if (/^\s{8,}\S/.test(next) && !/^\s{6}(?:gold|silver|awards|id|name|rarity|demand|ages|grid)\s*:/.test(next)) {
      parts.push(next.trim());
      i++;
    } else break;
  }
  const combined = parts.join(" ");
  const escaped = combined.replace(/'/g, "''");
  out.push(`${indent}gold: '${escaped}'`);
}
fs.writeFileSync(file, out.join("\n") + "\n", "utf8");
console.log("quoted gold lines starting with **");
