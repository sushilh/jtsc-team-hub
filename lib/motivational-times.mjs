import rows from "./motivational-times-data.json" with { type: "json" };
import { parseSwimTime } from "./state-qualifying-times.mjs";

export const MOTIVATIONAL_SOURCE = "https://websitedevsa.blob.core.windows.net/sitefinity/docs/default-source/timesdocuments/time-standards/2025/2028-motivational-standards-age-group.pdf";
export const MOTIVATIONAL_LEVELS = ["B", "BB", "A", "AA", "AAA", "AAAA"].map((name) => ({
  id: `motivational-${name}`, name, color: "#741b38", sourceUrl: MOTIVATIONAL_SOURCE,
}));
const STROKE_CODES = { Free: "FR", Back: "BK", Breast: "BR", Fly: "FL", IM: "IM" };

export function motivationalAgeGroup(age) {
  if (!Number.isInteger(age) || age < 5 || age > 18) return null;
  if (age <= 10) return "10 & under";
  if (age <= 12) return "11-12";
  if (age <= 14) return "13-14";
  if (age <= 16) return "15-16";
  return "17-18";
}

export function getMotivationalSeries({ age, gender, stroke, course }) {
  const ageGroupLabel = motivationalAgeGroup(age);
  if (!ageGroupLabel || !["girls", "boys"].includes(gender) || !STROKE_CODES[stroke] || !["SCY", "SCM", "LCM"].includes(course)) return [];
  const matched = rows.filter(([group, pool, event]) => group === ageGroupLabel && pool === course && event === STROKE_CODES[stroke]);
  return MOTIVATIONAL_LEVELS.map((level, index) => ({
    ...level, ageGroupLabel,
    points: matched.map((row) => {
      const timeText = row[gender === "girls" ? 4 : 5][index];
      return { distance: row[3], timeText, seconds: parseSwimTime(timeText) };
    }),
  }));
}
