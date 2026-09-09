import { POSTER_WIDTH, POSTER_HEIGHT, meetThemes, sessionDate, type MeetBlock, type ThemeId } from "./meet-day";

export function drawMeetPoster(canvas: HTMLCanvasElement, blocks: MeetBlock[], themeId: ThemeId, images: Record<string, HTMLImageElement>, selectedId?: string) {
  canvas.width = POSTER_WIDTH; canvas.height = POSTER_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not create the poster canvas.");
  const ctx = context;
  const theme = meetThemes[themeId];
  const family = typeof document === "undefined" ? '"Arial Narrow", Arial, sans-serif' : getComputedStyle(document.body).getPropertyValue("--font-display") || '"Arial Narrow", Arial, sans-serif';
  ctx.fillStyle = theme.paper; ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT);
  ctx.fillStyle = theme.dark; ctx.fillRect(0, 0, POSTER_WIDTH, 340); ctx.fillRect(0, 1495, POSTER_WIDTH, 125);
  ctx.fillStyle = theme.primary; ctx.fillRect(0, 340, POSTER_WIDTH, 118);
  ctx.fillStyle = theme.accent; ctx.fillRect(0, 340, POSTER_WIDTH, 4);

  function text(value: string, x: number, y: number, w: number, size: number, color: string, align: CanvasTextAlign = "left") {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "top";
    ctx.font = `800 ${size}px ${family}`;
    ctx.fillText(value, x, y, Math.max(1, w));
  }
  for (const block of blocks) {
    if (block.hidden) continue;
    const { x, y, w, h } = block;
    const color = block.color || (block.tone === "ink" ? theme.ink : block.tone === "accent" ? theme.accent : "#ffffff");
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (block.background) { ctx.fillStyle = block.background; ctx.fillRect(x, y, w, h); }
    if (block.kind === "panel") {
      ctx.fillStyle = block.background || theme.primary; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill();
    } else if (block.kind === "image" || block.kind === "qr") {
      const image = images[block.id];
      const pad = block.kind === "qr" ? 24 : 0;
      if (block.kind === "qr") { ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h); }
      if (image) {
        const scale = block.kind !== "qr" && block.fit === "cover" ? Math.max(w / image.naturalWidth, h / image.naturalHeight) : Math.min((w - pad * 2) / image.naturalWidth, (h - pad * 2) / image.naturalHeight);
        const dw = image.naturalWidth * scale, dh = image.naturalHeight * scale;
        ctx.globalAlpha = block.kind === "qr" ? 1 : block.opacity ?? 1;
        ctx.imageSmoothingEnabled = block.kind !== "qr";
        ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      } else if (block.kind === "qr") {
        text("UPLOAD QR", x + w / 2, y + h / 2 - 12, w - 30, 22, theme.ink, "center");
      }
    } else if (block.kind === "session") {
      ctx.fillStyle = block.background || "#ffffff"; ctx.fillRect(x, y, w, h);
      const dayW = w * .21, left = x + dayW + 15, available = w - dayW - 30;
      const size = Math.min(block.fontSize, h / 5.2);
      ctx.fillStyle = theme.primary; ctx.fillRect(x, y, dayW, h);
      text(block.day || "", x + 10, y + 16, dayW - 20, size * 1.3, "#ffffff");
      text(sessionDate(block.date), x + 10, y + h * .58, dayW - 20, size * .78, theme.accent);
      text(block.text || "", left, y + 10, available, size * 1.08, block.color || theme.ink);
      text(block.ageGroup || "", left, y + h * .35, available, size * .82, block.color || theme.primary);
      text(`${block.warmupLabel || ""}  ${block.warmup || ""}`, left, y + h * .64, available * .63, size * .8, block.color || theme.ink);
      text(`${block.startLabel || ""}  ${block.start || ""}`, left + available * .65, y + h * .64, available * .35, size * .8, block.color || theme.ink);
      ctx.fillStyle = theme.accent; ctx.fillRect(left, y + h - 1, available, 1);
    } else {
      const lines = (block.text || "").split("\n");
      const size = Math.min(block.fontSize, h / Math.max(1, lines.length) / 1.15);
      const align = block.align || "left";
      const tx = align === "center" ? x + w / 2 : align === "right" ? x + w : x;
      lines.forEach((line, index) => text(line, tx, y + index * size * 1.15, w, size, color, align));
    }
    ctx.restore();
  }
  const selected = blocks.find(b => b.id === selectedId && !b.hidden);
  if (selected) {
    ctx.strokeStyle = "#168eea"; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
    ctx.strokeRect(selected.x, selected.y, selected.w, selected.h); ctx.setLineDash([]);
  }
}
