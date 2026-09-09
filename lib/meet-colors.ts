import { meetThemes, type ThemeId } from "./meet-day";

export function normalizeHex(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return "#" + [...hex].map(c => c + c).join("").toLowerCase();
  return /^[0-9a-f]{6}$/i.test(hex) ? "#" + hex.toLowerCase() : null;
}
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
function mix(hex: string, target: number, fraction: number) {
  return "#" + rgb(hex).map(c => Math.round(c * (1 - fraction) + target * fraction).toString(16).padStart(2, "0")).join("");
}
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map(c => { const s = c / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return r * .2126 + g * .7152 + b * .0722;
}
export function colorContrast(a: string, b: string) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function resolveMeetTheme(id: ThemeId, customColor?: string | null) {
  const base = meetThemes[id];
  const primary = customColor ? normalizeHex(customColor) : null;
  if (!primary) return { ...base, onPrimary: "#ffffff", accentOnPrimary: base.accent, primaryText: base.primary };
  const dark = mix(primary, 0, .88), ink = mix(primary, 0, .76), paper = mix(primary, 255, .98), accent = mix(primary, 255, .68);
  const onPrimary = colorContrast(primary, "#ffffff") >= colorContrast(primary, "#000000") ? "#ffffff" : "#000000";
  return { ...base, primary, dark, ink, paper, accent, onPrimary, accentOnPrimary: colorContrast(primary, accent) >= 4.5 ? accent : onPrimary, primaryText: colorContrast(primary, paper) >= 4.5 ? primary : ink };
}
