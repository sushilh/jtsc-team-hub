import { multiEventLayout } from "./achievement-events";
import { meetDetails } from "./social-content.mjs";

type State = {
  name: string; classYear: string; headline: string; subline: string; meetName: string; meetDate: string;
  template: "classic" | "signature" | "race"; events: { eventName: string; time: string }[];
  image: HTMLImageElement | null; brandMark: HTMLImageElement | null;
  zoom: number; horizontalPosition: number; verticalPosition: number;
};

export function drawMultiEventCard(ctx: CanvasRenderingContext2D, width: number, height: number, state: State) {
  const layout = multiEventLayout(height, state.events.length);
  const classic = state.template === "classic", race = state.template === "race";
  const maroon = "#781d42", ink = classic ? maroon : "#ffffff";
  const muted = classic ? "#67515c" : "#e7ccd7", accent = race ? "#f0c347" : muted;
  const left = 62, right = width - 62, contentWidth = right - left;
  ctx.fillStyle = "#24131d"; ctx.fillRect(0, 0, width, height);
  function text(value: string, x: number, y: number, max: number, size: number, color: string, weight = 700, align: CanvasTextAlign = "left") {
    ctx.fillStyle = color; ctx.textAlign = align;
    while (size > 18) { ctx.font = `${weight} ${size}px "Arial Narrow", Arial, sans-serif`; if (ctx.measureText(value).width <= max) break; size--; }
    ctx.fillText(value, x, y, max);
  }
  if (state.image) {
    const image = state.image;
    ctx.save(); ctx.filter = "blur(28px) brightness(.45)";
    const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    ctx.drawImage(image, (width - image.naturalWidth * cover) / 2, (height - image.naturalHeight * cover) / 2, image.naturalWidth * cover, image.naturalHeight * cover); ctx.restore();
    const photoWidth = width - 56, photoHeight = layout.photoBottom - layout.photoTop;
    const scale = Math.min(photoWidth / image.naturalWidth, photoHeight / image.naturalHeight) * state.zoom;
    const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
    ctx.save(); ctx.beginPath(); ctx.rect(28, layout.photoTop, photoWidth, photoHeight); ctx.clip();
    ctx.drawImage(image, 28 + (photoWidth - w) / 2 + state.horizontalPosition / 100 * Math.abs(photoWidth - w), layout.photoTop + (photoHeight - h) / 2 + state.verticalPosition / 100 * Math.abs(photoHeight - h), w, h); ctx.restore();
  } else text("Add your swimmer photo", width / 2, (layout.photoTop + layout.photoBottom) / 2, 850, 28, "#ffffff", 600, "center");
  text("CONGRATULATIONS", 46, 59, 700, 26, "#ffffff");
  text(`${state.events.length} EVENTS`, width - 46, 59, 200, 20, "#ffffff", 700, "right");
  ctx.save(); ctx.beginPath();
  ctx.roundRect(28, layout.panelTop, width - 56, layout.panelHeight, state.template === "signature" ? 28 : 0); ctx.clip();
  ctx.fillStyle = classic ? "#ffffff" : race ? "#17090f" : "rgba(93,22,52,.94)";
  ctx.fillRect(28, layout.panelTop, width - 56, layout.panelHeight);
  if (state.template === "signature") {
    const sheen = ctx.createLinearGradient(0, layout.panelTop, width, height);
    sheen.addColorStop(0, "rgba(255,255,255,.17)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen; ctx.fillRect(28, layout.panelTop, width - 56, layout.panelHeight);
  }
  if (race) { ctx.fillStyle = maroon; ctx.fillRect(28, layout.panelTop, width - 56, 116); }
  text((state.name.trim() || "SWIMMER NAME").toUpperCase(), left, layout.panelTop + 56, contentWidth, 52, ink, 900);
  text((state.headline || "ACHIEVEMENT").toUpperCase(), left, layout.panelTop + 96, contentWidth, 30, race ? "#f0c347" : ink);
  text(state.subline.toUpperCase(), left, layout.panelTop + 132, contentWidth, 20, muted, 500);
  text("EVENT", left, layout.rowsTop - 10, 500, 18, accent);
  text("TIME", right, layout.rowsTop - 10, 300, 18, accent, 700, "right");
  state.events.forEach((event, index) => {
    const y = layout.rowsTop + index * layout.rowHeight;
    ctx.fillStyle = classic ? "#ddd0d6" : "#745765"; ctx.fillRect(left, y, contentWidth, 1);
    text(event.eventName.toUpperCase(), left, y + 32, 620, 28, ink);
    text(event.time || "—", right, y + 32, 295, race ? 34 : 29, ink, 800, "right");
  });
  text(meetDetails(state.meetName, state.meetDate).toUpperCase(), left, height - 83, contentWidth, 20, muted, 500);
  if (state.brandMark) {
    ctx.fillStyle = "#ffffff"; ctx.fillRect(left, height - 68, 30, 35);
    ctx.drawImage(state.brandMark, left + 2, height - 66, 26, 31);
  }
  text("JENKS TROJANS", left + 42, height - 42, 470, 18, ink);
  text(state.classYear.toUpperCase(), right, height - 42, 420, 18, muted, 600, "right");
  ctx.restore(); ctx.fillStyle = maroon; ctx.fillRect(0, height - 4, width, 4);
}
