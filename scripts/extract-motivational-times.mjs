// Regenerate with: pdftotext -layout standards.pdf /tmp/standards.txt
// node scripts/extract-motivational-times.mjs /tmp/standards.txt > lib/motivational-times-data.json
import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Provide the pdftotext -layout output as an argument");
const text = readFileSync(input, "utf8");
const rows = [];
const counts = {};
const seen = new Set();
let age;
for (const line of text.split(/\r?\n/)) {
  const header = line.match(/\b(10 & under|11-12|13-14|15-16|17-18) Girls\b/);
  if (header) age = header[1];
  const event = /\b(\d+)\s+(FR|BK|BR|FL|IM)\s+(SCY|SCM|LCM)\b/.exec(line);
  if (!event) continue;
  if (!age) throw new Error(`Event before age header: ${line}`);
  const times = (part) => [...part.matchAll(/\b(?:\d+:)?\d{1,2}\.\d{2}\b/g)].map((match) => match[0]);
  const girls = times(line.slice(0, event.index));
  const boys = times(line.slice(event.index + event[0].length)).reverse();
  if (girls.length !== 6 || boys.length !== 6) throw new Error(`Unexpected columns: ${line}`);
  const [, distance, stroke, course] = event;
  const key = `${age}:${course}:${stroke}:${distance}`;
  if (seen.has(key)) throw new Error(`Duplicate event: ${key}`);
  seen.add(key);
  counts[`${course}:${age}`] = (counts[`${course}:${age}`] ?? 0) + 1;
  rows.push([age, course, stroke, Number(distance), girls, boys]);
}
const expected = {
  "SCY:10 & under": 12, "SCY:11-12": 18, "SCY:13-14": 17, "SCY:15-16": 17, "SCY:17-18": 17,
  "SCM:10 & under": 12, "SCM:11-12": 18, "SCM:13-14": 17, "SCM:15-16": 17, "SCM:17-18": 17,
  "LCM:10 & under": 11, "LCM:11-12": 17, "LCM:13-14": 17, "LCM:15-16": 17, "LCM:17-18": 17,
};
if (Object.keys(counts).length !== Object.keys(expected).length || Object.entries(expected).some(([key, value]) => counts[key] !== value)) {
  throw new Error(`Unexpected event counts: ${JSON.stringify(counts)}`);
}
process.stdout.write(`[\n${rows.map((row) => `  ${JSON.stringify(row)}`).join(",\n")}\n]\n`);
