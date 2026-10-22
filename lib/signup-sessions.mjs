// Signup exports contain job start times, not an explicit session identifier.
// This is a display filter only: it does not change stored assignments or permissions.
export function signupSessionPeriod(value) {
  const input = String(value ?? "").trim();
  const match = input.match(/(?:^|[T\s])(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?(?:\s|$)/i);
  if (!match) return "unknown";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || (meridiem ? hour < 1 || hour > 12 : hour > 23)) return "unknown";
  if (meridiem) hour = hour % 12 + (meridiem === "PM" ? 12 : 0);
  return hour < 12 ? "morning" : "later";
}

export const SIGNUP_SESSION_LABELS = Object.freeze({
  morning: "AM",
  later: "PM",
  unknown: "Time not recognized",
});
