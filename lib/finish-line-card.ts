import { meetDetails } from "./social-content.mjs";

export type FinishRect = { x: number; y: number; w: number; h: number }; // Fractions of the output card.
export type FinishLayer = FinishRect & {
  id: string;
  kind: "text" | "image" | "panel";
  text: string;
  color: string;
  background: string;
  fontSize: number;
  imageId?: string;
  hidden?: boolean;
};

export function defaultPhotoRect(height: number): FinishRect {
  const layout = finishLineLayout(height, 1);
  return { x: 48 / 1080, y: layout.photoTop / height, w: 754 / 1080, h: layout.photoHeight / height };
}

export function boundFinishRect(rect: FinishRect): FinishRect {
  const w = Math.max(.06, Math.min(1, rect.w));
  const h = Math.max(.04, Math.min(1, rect.h));
  return {
    x: Math.max(0, Math.min(1 - w, rect.x)),
    y: Math.max(0, Math.min(1 - h, rect.y)), w, h,
  };
}

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
  photoRect?: FinishRect | null;
  textRects?: Record<string, FinishRect>;
  textStyles?: Record<string, FinishTextStyle>;
  eventIds?: string[];
  layers?: FinishLayer[];
  layerImages?: Record<string, HTMLImageElement>;
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

export type FinishTextBlock = { id: string; label: string; rect: FinishRect };
export type FinishTextStyle = { color?: string; background?: string };

export function defaultFinishTextColor(id: string, eventIndex = 0) {
  return id === "subline" || id === "meet" ? "#efc76f" : id.startsWith("event:") && eventIndex > 0 ? "#f4dce5" : "#fffaf3";
}

export function finishLineTextBlocks(height: number, eventIds: string[]): FinishTextBlock[] {
  const layout = finishLineLayout(height, eventIds.length);
  const scaled = (x: number, y: number, w: number, h: number): FinishRect => ({ x: x / 1080, y: y / height, w: w / 1080, h: h / height });
  const headlineSize = height > 1100 ? 126 : 112;
  return [
    { id: "headline", label: "Milestone", rect: scaled(1026 - headlineSize, 42, headlineSize, height - 84) },
    { id: "name", label: "Swimmer name", rect: scaled(72, layout.detailsTop - 12, 726, 86) },
    { id: "subline", label: "Supporting line", rect: scaled(74, layout.detailsTop + 72, 726, 42) },
    ...eventIds.flatMap((eventId, index) => {
      const rowTop = layout.rowsTop + index * layout.rowHeight;
      return [
        { id: `event:${eventId}`, label: `Event ${index + 1}`, rect: scaled(74, rowTop, 505, layout.rowHeight) },
        { id: `time:${eventId}`, label: `Time ${index + 1}`, rect: scaled(628, rowTop, 174, layout.rowHeight) },
      ];
    }),
    { id: "meet", label: "Meet / club line", rect: scaled(74, height - 66, 520, 44) },
    { id: "classYear", label: "Class / team", rect: scaled(602, height - 66, 200, 44) },
  ];
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
  const photoRect = boundFinishRect(state.photoRect ?? defaultPhotoRect(height));
  const photoX = photoRect.x * width;
  const photoWidth = photoRect.w * width;
  const photoTop = photoRect.y * height;
  const photoHeight = photoRect.h * height;
  const layout = finishLineLayout(height, state.events.length);
  const eventKeys = state.eventIds?.length ? state.eventIds : state.events.length ? state.events.map((_, index) => String(index)) : ["placeholder"];
  const textBlocks = finishLineTextBlocks(height, eventKeys);
  const textRect = (id: string) => {
    const original = textBlocks.find(block => block.id === id)?.rect;
    return boundFinishRect(state.textRects?.[id] ?? original ?? { x: 0, y: 0, w: .1, h: .1 });
  };
  const pixels = (rect: FinishRect) => ({ x: rect.x * width, y: rect.y * height, w: rect.w * width, h: rect.h * height });
  const textBackground = (id: string) => {
    const background = state.textStyles?.[id]?.background;
    if (!background) return;
    const rect = pixels(textRect(id));
    ctx.fillStyle = background;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  };
  const textColor = (id: string, eventIndex = 0) => state.textStyles?.[id]?.color ?? defaultFinishTextColor(id, eventIndex);

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
  ctx.translate(photoX + photoWidth / 2, photoTop + photoHeight / 2);
  ctx.rotate(-.006);
  ctx.fillStyle = cream;
  ctx.fillRect(-photoWidth / 2 - 8, -photoHeight / 2 - 8, photoWidth + 16, photoHeight + 16);
  ctx.beginPath();
  ctx.rect(-photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight);
  ctx.clip();
  if (state.image) {
    drawCover(ctx, state.image, -photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight, state.zoom, state.horizontalPosition, state.verticalPosition);
  } else {
    const placeholder = ctx.createLinearGradient(0, -photoHeight / 2, 0, photoHeight / 2);
    placeholder.addColorStop(0, "#e8ddd8");
    placeholder.addColorStop(1, "#bfa9b1");
    ctx.fillStyle = placeholder;
    ctx.fillRect(-photoWidth / 2, -photoHeight / 2, photoWidth, photoHeight);
    ctx.fillStyle = deepMaroon;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '800 25px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("ADD YOUR SWIMMER PHOTO", 0, 0);
  }
  ctx.restore();

  const headline = (state.headline.trim() || "ACHIEVEMENT").toUpperCase();
  textBackground("headline");
  const headlineRect = pixels(textRect("headline"));
  const defaultHeadlineRect = pixels(textBlocks[0].rect);
  ctx.save();
  ctx.translate(headlineRect.x + headlineRect.w, headlineRect.y);
  ctx.rotate(Math.PI / 2);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = textColor("headline");
  const headlineSize = fitText(ctx, headline, headlineRect.h, Math.min(180, (height > 1100 ? 126 : 112) * headlineRect.w / defaultHeadlineRect.w), 20);
  ctx.font = `900 ${headlineSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(headline, 0, 0, headlineRect.h);
  ctx.restore();

  const name = (state.name.trim() || "SWIMMER NAME").toUpperCase();
  textBackground("name");
  const nameRect = pixels(textRect("name"));
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = textColor("name");
  const nameSize = fitText(ctx, name, nameRect.w, Math.min(180, (height > 1100 ? 70 : 62) * nameRect.h / 86), 20);
  ctx.font = `900 ${nameSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(name, nameRect.x, nameRect.y + nameRect.h * 68 / 86, nameRect.w);

  const supporting = state.subline.trim().toUpperCase();
  if (supporting) {
    textBackground("subline");
    const supportingRect = pixels(textRect("subline"));
    ctx.fillStyle = textColor("subline");
    const supportingSize = fitText(ctx, supporting, supportingRect.w, Math.min(100, 24 * supportingRect.h / 42), 12, 700);
    ctx.font = `700 ${supportingSize}px "Arial Narrow", Arial, sans-serif`;
    ctx.fillText(supporting, supportingRect.x, supportingRect.y + supportingRect.h * 22 / 42, supportingRect.w);
  }

  const events = state.events.length ? state.events : [{ eventName: "EVENT", time: "TIME" }];
  events.forEach((event, index) => {
    const eventId = eventKeys[index] ?? "placeholder";
    textBackground(`event:${eventId}`);
    textBackground(`time:${eventId}`);
    const eventRect = pixels(textRect(`event:${eventId}`));
    const timeRect = pixels(textRect(`time:${eventId}`));
    const rowTop = layout.rowsTop + index * layout.rowHeight;
    const eventName = (event.eventName || "EVENT").toUpperCase();
    const time = (event.time || "—").toUpperCase();
    ctx.fillStyle = textColor(`event:${eventId}`, index);
    const eventSize = fitText(ctx, eventName, eventRect.w, Math.min(120, Math.min(30, layout.rowHeight * .54) * eventRect.h / layout.rowHeight), 12, 700);
    ctx.font = `700 ${eventSize}px "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(eventName, eventRect.x, eventRect.y + eventRect.h * .66, eventRect.w);
    ctx.fillStyle = textColor(`time:${eventId}`);
    const timeSize = fitText(ctx, time, timeRect.w, Math.min(120, Math.min(31, layout.rowHeight * .58) * timeRect.h / layout.rowHeight), 12, 800);
    ctx.font = `800 ${timeSize}px "Arial Narrow", Arial, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(time, timeRect.x + timeRect.w, timeRect.y + timeRect.h * .66, timeRect.w);
    if (index < events.length - 1) {
      ctx.fillStyle = "rgba(255,255,255,.22)";
      ctx.fillRect(74, rowTop + layout.rowHeight - 1, 728, 1);
    }
  });

  const meet = meetDetails(state.meetName, state.meetDate).toUpperCase();
  textBackground("meet");
  textBackground("classYear");
  const meetRect = pixels(textRect("meet"));
  const classRect = pixels(textRect("classYear"));
  ctx.fillStyle = textColor("meet");
  ctx.textAlign = "left";
  ctx.font = `700 ${Math.min(64, 17 * meetRect.h / 44)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(meet || "JENKS TROJAN SWIM CLUB", meetRect.x, meetRect.y + meetRect.h * 32 / 44, meetRect.w);
  ctx.textAlign = "right";
  ctx.fillStyle = textColor("classYear");
  ctx.font = `700 ${Math.min(64, 17 * classRect.h / 44)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(state.classYear.toUpperCase(), classRect.x + classRect.w, classRect.y + classRect.h * 32 / 44, classRect.w);

  for (const layer of state.layers ?? []) {
    if (layer.hidden) continue;
    const rect = boundFinishRect(layer);
    const x = rect.x * width, y = rect.y * height, w = rect.w * width, h = rect.h * height;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (layer.kind === "panel") {
      ctx.fillStyle = layer.background;
      ctx.fillRect(x, y, w, h);
    } else if (layer.kind === "image") {
      const image = state.layerImages?.[layer.imageId ?? layer.id];
      if (image) drawCover(ctx, image, x, y, w, h, 1, 0, 0);
      else {
        ctx.fillStyle = "#fffaf3"; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "#431326"; ctx.textAlign = "center";
        ctx.font = '700 22px Arial, sans-serif';
        ctx.fillText("ADD IMAGE", x + w / 2, y + h / 2, w - 12);
      }
    } else {
      if (layer.background !== "transparent") { ctx.fillStyle = layer.background; ctx.fillRect(x, y, w, h); }
      ctx.fillStyle = layer.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = `900 ${layer.fontSize}px "Arial Narrow", Impact, sans-serif`;
      layer.text.split("\n").slice(0, 8).forEach((line, index) =>
        ctx.fillText(line, x + 8, y + 6 + index * layer.fontSize * 1.1, Math.max(1, w - 16)));
    }
    ctx.restore();
  }
}
