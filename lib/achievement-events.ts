export const MAX_CARD_EVENTS = 6;
export type AchievementEvent = { id: string; eventName: string; time: string };

export function eventNameMissing(event: AchievementEvent) {
  return Boolean(event.time.trim() && !event.eventName.trim());
}

export function multiEventLayout(height: number, count: number) {
  const rowHeight = 44;
  const panelHeight = 254 + count * rowHeight;
  const panelTop = height - panelHeight - 28;
  return { panelTop, panelHeight, rowHeight, rowsTop: panelTop + 175, photoTop: 96, photoBottom: panelTop - 18 };
}
