import { meetDetails } from "./social-content.mjs";

type FinishLineState = {
  name: string;
  classYear: string;
  headline: string;
  subline: string;
  events: { eventName: string; time: string }[];
  meetName: string;
  meetDate: string;
  image: HTMLImageElement | null;
  brandMark: HTMLImageElement | null;
  zoom: number;
  horizontalPosition: number;
  verticalPosition: number;
};

export function finishLineLayout(height: number, eventCount: number) {
  const photoTop = 54;
  const photoHeight = height > 1100 ? 650 : 500;
  const photoBottom = photoTop + photoHeight;
  const detailsTop = photoBottom + 48;
  const rowsTop = detailsTop + 128;
  const footerTop = height - 68;
  const rowHeight = Math.min(58, Math.max(38, (footerTop - rowsTop - 14) / Math.max(eventCount, 1)));
  return { photoTop, photoHeight, photoBottom, detailsTop, rowsTop, footerTop, rowHeight };
}

function fitText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  startSize: number,
  minimum = 20,
  weight = 900,
) {
  let size = startSize;
  while (size > minimum) {
    ctx.font = `${weight} ${size}px "Arial Narrow", Impact, sans-serif`;
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
  horizontalPosition: number,
  verticalPosition: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const maxX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxY = Math.max(0, image.naturalHeight - sourceHeight);
  const sourceX = Math.min(maxX, Math.max(0, maxX / 2 + horizontalPosition / 100 * maxX));
  const sourceY = Math.min(maxY, Math.max(0, maxY / 2 + verticalPosition / 100 * maxY));
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

export function drawFinishLineCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FinishLineState,
) {
  const maroon = "#67243d";
  const deepMaroon = "#431326";
  const cream = "#fffaf3";
  const paleGold = "#efc76f";
  const photoX = 48;
  const photoWidth = 754;
  const textRight = 802;
  const layout = finishLineLayout(height, state.events.length);

  ctx.fillStyle = maroon;
  ctx.fillRect(0, 0, width, height);

  // Pool-lane rays give the empty maroon field movement without competing with the photo.
  ctx.save();
  ctx.globalAlpha = .16;
  ctx.fillStyle = "#a95873";
  const rayEnds = [-60, 170, 390, 620, 855, 1090, 1330];
  rayEnds.forEach((end, index) => {
    ctx.beginPath();
    ctx.moveTo(120, height + 40);
    ctx.lineTo(index % 2 ? 180 : 225, height + 40);
    ctx.lineTo(width, end);
    ctx.lineTo(width, end + 34);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();

  if (state.brandMark) {
    ctx.save();
    ctx.globalAlpha = .075;
    const markHeight = height > 1100 ? 650 : 520;
    const markWidth = markHeight * state.brandMark.naturalWidth / state.brandMark.naturalHeight;
    ctx.drawImage(state.brandMark, 190, height - markHeight - 8, markWidth, markHeight);
    ctx.restore();
  }

  // A crisp cream frame echoes a printed meet photograph pinned to a record board.
  ctx.save();
  ctx.translate(photoX + photoWidth / 2, layout.photoTop + layout.photoHeight / 2);
  ctx.rotate(-.006);
  ctx.fillStyle = cream;
  ctx.fillRect(-photoWidth / 2 - 8, -layout.photoHeight / 2 - 8, photoWidth + 16, layout.photoHeight + 16);
  ctx.beginPath();
  ctx.rect(-photoWidth / 2, -layout.photoHeight / 2, photoWidth, layout.photoHeight);
  ctx.clip();
  if (state.image) {
    drawCover(ctx, state.image, -photoWidth / 2, -layout.photoHeight / 2, photoWidth, layout.photoHeight, state.zoom, state.horizontalPosition, state.verticalPosition);
  } else {
    const placeholder = ctx.createLinearGradient(0, -layout.photoHeight / 2, 0, layout.photoHeight / 2);
    placeholder.addColorStop(0, "#e8ddd8");
    placeholder.addColorStop(1, "#bfa9b1");
    ctx.fillStyle = placeholder;
    ctx.fillRect(-photoWidth / 2, -layout.photoHeight / 2, photoWidth, layout.photoHeight);
    ctx.fillStyle = deepMaroon;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '800 25px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("ADD YOUR SWIMMER PHOTO", 0, 0);
  }
  ctx.restore();

  const headline = (state.headline.trim() || "ACHIEVEMENT").toUpperCase();
  ctx.save();
  ctx.translate(width - 54, 42);
  ctx.rotate(Math.PI / 2);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = cream;
  const headlineSize = fitText(ctx, headline, height - 84, height > 1100 ? 126 : 112, 50);
  ctx.font = `900 ${headlineSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(headline, 0, 0);
  ctx.restore();

  const name = (state.name.trim() || "SWIMMER NAME").toUpperCase();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = cream;
  const nameSize = fitText(ctx, name, textRight - 76, height > 1100 ? 70 : 62, 34);
  ctx.font = `900 ${nameSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(name, 72, layout.detailsTop + 56, textRight - 76);

  const supporting = state.subline.trim().toUpperCase();
  if (supporting) {
    ctx.fillStyle = paleGold;
    const supportingSize = fitText(ctx, supporting, textRight - 76, 24, 16, 700);
    ctx.font = `700 ${supportingSize}px "Arial Narrow", Arial, sans-serif`;
    ctx.fillText(supporting, 74, layout.detailsTop + 94, textRight - 76);
  }

  const events = state.events.length ? state.events : [{ eventName: "EVENT", time: "TIME" }];
  events.forEach((event, index) => {
    const rowTop = layout.rowsTop + index * layout.rowHeight;
    const eventName = (event.eventName || "EVENT").toUpperCase();
    const time = (event.time || "—").toUpperCase();
    ctx.fillStyle = index === 0 ? cream : "#f4dce5";
    const eventSize = fitText(ctx, eventName, 505, Math.min(30, layout.rowHeight * .54), 17, 700);
    ctx.font = `700 ${eventSize}px "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(eventName, 74, rowTop + layout.rowHeight * .66, 505);
    ctx.fillStyle = cream;
    const timeSize = fitText(ctx, time, 174, Math.min(31, layout.rowHeight * .58), 18, 800);
    ctx.font = `800 ${timeSize}px "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(time, textRight, rowTop + layout.rowHeight * .66, 174);
    if (index < events.length - 1) {
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(74, rowTop + layout.rowHeight - 1, textRight - 74, 1);
    }
  });

  const meet = meetDetails(state.meetName, state.meetDate).toUpperCase();
  ctx.fillStyle = paleGold;
  ctx.textAlign = "left";
  ctx.font = '700 17px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(meet || "JENKS TROJAN SWIM CLUB", 74, height - 34, 520);
  ctx.textAlign = "right";
  ctx.fillStyle = cream;
  ctx.fillText(state.classYear.toUpperCase(), textRight, height - 34, 200);
}
