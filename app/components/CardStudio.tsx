"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import SocialCaptions from "./SocialCaptions";
import { imageFilename, socialFormats, meetDetails } from "../../lib/social-content.mjs";

type CardFormat = "portrait" | "square";
type CardTemplate = "classic" | "signature" | "race";

type CardDrawingState = {
  name: string;
  classYear: string;
  headline: string;
  subline: string;
  eventLine: string;
  eventName: string;
  time: string;
  meetName: string;
  meetDate: string;
  format: CardFormat;
  template: CardTemplate;
  image: HTMLImageElement | null;
  brandMark: HTMLImageElement | null;
  zoom: number;
  horizontalPosition: number;
  verticalPosition: number;
};

const achievements = [
  { label: "Futures", headline: "FUTURES QUALIFIER", subline: "USA SWIMMING FUTURES CHAMPIONSHIPS" },
  { label: "Sectionals", headline: "SECTIONALS QUALIFIER", subline: "CENTRAL ZONE SECTIONALS" },
  { label: "Zones", headline: "ZONES QUALIFIER", subline: "CENTRAL ZONE CHAMPIONSHIPS" },
  { label: "Made State", headline: "STATE QUALIFIER", subline: "OSSAA STATE CHAMPIONSHIPS" },
  { label: "Junior Nationals", headline: "JUNIOR NATIONAL QUALIFIER", subline: "USA SWIMMING JUNIOR NATIONALS" },
  { label: "National Team", headline: "NATIONAL TEAM", subline: "SELECTED • TEAM USA PATHWAY" },
  { label: "Season Best", headline: "SEASON BEST", subline: "" },
] as const;

const initialAchievement = achievements[0];

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawCoverImage(
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
  const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const sourceWidth = width / coverScale;
  const sourceHeight = height / coverScale;
  const maxX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxY = Math.max(0, image.naturalHeight - sourceHeight);
  const sourceX = Math.min(maxX, Math.max(0, maxX / 2 + (horizontalPosition / 100) * maxX));
  const sourceY = Math.min(maxY, Math.max(0, maxY / 2 + (verticalPosition / 100) * maxY));
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 800) {
  let size = startSize;
  do {
    ctx.font = `${weight} ${size}px "Arial Narrow", "Helvetica Neue", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 24);
  return size;
}

function drawCenteredTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
) {
  const characters = [...text];
  const width = characters.reduce((sum, character) => sum + ctx.measureText(character).width, 0) + tracking * (characters.length - 1);
  let x = centerX - width / 2;
  ctx.textAlign = "left";
  for (const character of characters) {
    ctx.fillText(character, x, y);
    x += ctx.measureText(character).width + tracking;
  }
}

function drawClassicCard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: CardDrawingState,
) {
  const maroon = "#781D42";
  const maroonDark = "#2B0817";
  const aqua = "#54C7DB";
  const cream = "#F5F0E6";
  const portrait = state.format === "portrait";
  const bandY = portrait ? height - 390 : height - 342;
  const bandHeight = portrait ? 244 : 218;

  const backdrop = ctx.createLinearGradient(0, 0, width, height);
  backdrop.addColorStop(0, "#BAC4C4");
  backdrop.addColorStop(1, "#4E777F");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);
  if (state.image) {
    ctx.save();
    ctx.filter = "saturate(.88) contrast(1.04)";
    drawCoverImage(ctx, state.image, 0, 0, width, height, state.zoom, state.horizontalPosition, state.verticalPosition);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(43,8,23,.18)";
    ctx.beginPath();
    ctx.arc(540, height * .35, 105, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(540, height * .65, 235, 310, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.textAlign = "center";
    ctx.font = '800 20px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("UPLOAD A SWIMMER PHOTO", width / 2, height * .52);
  }

  ctx.strokeStyle = maroon;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  // The original banner format: full photograph plus a bold information band.
  ctx.fillStyle = "rgba(255,255,255,.97)";
  ctx.fillRect(0, bandY, width, bandHeight);
  ctx.fillStyle = maroonDark;
  ctx.fillRect(0, bandY + bandHeight * .52, width, 4);
  ctx.fillRect(0, bandY + bandHeight - 5, width, 5);

  const logoWidth = portrait ? 72 : 62;
  const logoHeight = portrait ? 85 : 73;
  if (state.brandMark) ctx.drawImage(state.brandMark, width / 2 - logoWidth / 2, bandY + 13, logoWidth, logoHeight);
  ctx.fillStyle = maroon;
  ctx.textAlign = "center";
  ctx.font = `900 ${portrait ? 18 : 16}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText("JENKS TROJANS", width / 2, bandY + (portrait ? 116 : 99));

  const safeName = (state.name || "SWIMMER NAME").toUpperCase();
  const nameSize = fitText(ctx, safeName, 355, portrait ? 39 : 34, 900);
  ctx.fillStyle = maroon;
  ctx.textAlign = "left";
  ctx.font = `900 ${nameSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(safeName, 52, bandY + bandHeight * .76);

  const event = (state.eventLine || "EVENT • TIME").toUpperCase();
  const eventSize = fitText(ctx, event, 355, portrait ? 36 : 31, 900);
  ctx.textAlign = "right";
  ctx.font = `900 ${eventSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(event, width - 52, bandY + bandHeight * .76);

  const achievement = (state.headline || "ACHIEVEMENT").toUpperCase();
  const achievementSize = fitText(ctx, achievement, 260, portrait ? 25 : 21, 900);
  ctx.fillStyle = maroon;
  ctx.textAlign = "center";
  ctx.font = `900 ${achievementSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(achievement, width / 2, bandY + bandHeight * .72);
  ctx.fillStyle = "#6D6267";
  ctx.font = `700 ${portrait ? 11 : 10}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText(state.classYear.toUpperCase(), width / 2, bandY + bandHeight * .84);

  ctx.fillStyle = "rgba(43,8,23,.78)";
  ctx.fillRect(0, bandY + bandHeight, width, height - bandY - bandHeight);
  ctx.fillStyle = cream;
  const meet = meetDetails(state.meetName, state.meetDate);
  if (meet) {
    ctx.textAlign = "center";
    ctx.font = '600 22px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(meet.toUpperCase(), width / 2, height - 88, width - 96);
  }
  ctx.font = `800 ${portrait ? 16 : 14}px "Helvetica Neue", Arial, sans-serif`;
  drawCenteredTrackedText(ctx, "JENKS TROJAN SWIM CLUB", width / 2, height - 48, 5);
  ctx.fillStyle = aqua;
  ctx.fillRect(width / 2 - 52, height - 28, 104, 4);
}

function drawRaceCard(ctx: CanvasRenderingContext2D, width: number, height: number, state: CardDrawingState) {
  const top = height - 330;
  ctx.fillStyle = "#17090f"; ctx.fillRect(0, 0, width, height);
  if (state.image) {
    ctx.save(); ctx.filter = "blur(24px) brightness(.5)";
    drawCoverImage(ctx, state.image, 0, 0, width, top, 1, 0, 0); ctx.restore();
    const areaHeight = top - 92;
    const scale = Math.min(width / state.image.naturalWidth, areaHeight / state.image.naturalHeight) * state.zoom;
    const w = state.image.naturalWidth * scale, h = state.image.naturalHeight * scale;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 92, width, areaHeight); ctx.clip();
    ctx.drawImage(state.image, (width - w) / 2 + state.horizontalPosition / 100 * Math.abs(width - w), 92 + (areaHeight - h) / 2 + state.verticalPosition / 100 * Math.abs(areaHeight - h), w, h); ctx.restore();
  }
  ctx.fillStyle = "#781D42"; ctx.fillRect(0, 0, width, 92); ctx.fillRect(0, top, width, 118);
  ctx.fillStyle = "#f0c347"; ctx.textAlign = "left";
  fitText(ctx, state.headline.toUpperCase(), 930, 31); ctx.fillText(state.headline.toUpperCase(), 50, 57, 930);
  ctx.fillStyle = "#ffffff"; fitText(ctx, state.time || "TIME", 620, 110, 900); ctx.fillText(state.time || "TIME", 48, top + 102, 620);
  ctx.fillStyle = "#f0c347"; ctx.fillRect(727, top + 23, 4, 75);
  ctx.font = '600 20px Arial, sans-serif'; ctx.fillText("EVENT", 757, top + 45);
  ctx.fillStyle = "#ffffff"; fitText(ctx, state.eventName.toUpperCase() || "EVENT", 275, 28, 800); ctx.fillText(state.eventName.toUpperCase() || "EVENT", 757, top + 84, 275);
  fitText(ctx, state.name.toUpperCase() || "SWIMMER NAME", 980, 65, 900); ctx.fillText(state.name.toUpperCase() || "SWIMMER NAME", 48, top + 185, 980);
  ctx.fillStyle = "#e0c9d2"; ctx.font = '600 22px Arial, sans-serif'; ctx.fillText(meetDetails(state.meetName, state.meetDate).toUpperCase(), 50, top + 229, 960);
  ctx.font = '500 18px Arial, sans-serif'; ctx.fillText(state.subline.toUpperCase(), 50, top + 260, 960);
  ctx.fillStyle = "#f0c347"; ctx.font = '700 18px Arial, sans-serif'; ctx.fillText(`JTSC  /  ${state.classYear.toUpperCase()}`, 50, top + 301, 880);
  if (state.brandMark) ctx.drawImage(state.brandMark, 980, top + 267, 35, 42);
}

function drawCard(
  canvas: HTMLCanvasElement,
  state: CardDrawingState,
) {
  const width = 1080;
  const height = socialFormats[state.format].height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = width;
  canvas.height = height;

  if (state.template === "classic") {
    drawClassicCard(ctx, width, height, state);
    return;
  }
  if (state.template === "race") {
    drawRaceCard(ctx, width, height, state);
    return;
  }

  const maroon = "#781D42";
  const panelHeight = 318;
  const panelTop = height - panelHeight - 28;
  const photoTop = 108;
  const photoBottom = panelTop - 20;
  const panelX = 28;
  const panelWidth = width - 56;

  ctx.fillStyle = "#24131d";
  ctx.fillRect(0, 0, width, height);
  if (state.image) {
    // An ambient background fills the card; the foreground photo fits entirely
    // above the information panel at the default zoom, including its lower edge.
    ctx.save();
    ctx.filter = "blur(30px) brightness(.55)";
    drawCoverImage(ctx, state.image, -50, -50, width + 100, height + 100, 1, 0, 0);
    ctx.restore();

    const photoWidth = width - 56;
    const photoHeight = photoBottom - photoTop;
    const scale = Math.min(photoWidth / state.image.naturalWidth, photoHeight / state.image.naturalHeight) * state.zoom;
    const dw = state.image.naturalWidth * scale;
    const dh = state.image.naturalHeight * scale;
    const dx = 28 + (photoWidth - dw) / 2 + state.horizontalPosition / 100 * Math.abs(photoWidth - dw);
    const dy = photoTop + (photoHeight - dh) / 2 + state.verticalPosition / 100 * Math.abs(photoHeight - dh);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(28, photoTop, photoWidth, photoHeight, 22);
    ctx.clip();
    ctx.drawImage(state.image, dx, dy, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#eadfe5";
    ctx.textAlign = "center";
    ctx.font = '600 28px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("Add your swimmer photo", width / 2, (photoTop + photoBottom) / 2);
  }

  // A quiet header occupies its own space instead of covering the portrait.
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("CONGRATULATIONS", 46, 66);
  ctx.fillStyle = "#d9bac9";
  ctx.textAlign = "right";
  ctx.font = '600 18px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("JENKS TROJAN SWIM CLUB", 1034, 64);

  // Rasterized backdrop blur is part of the exported PNG, not just CSS.
  const backdrop = document.createElement("canvas");
  backdrop.width = width;
  backdrop.height = height;
  backdrop.getContext("2d")?.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(panelX, panelTop, panelWidth, panelHeight, 28);
  ctx.clip();
  ctx.filter = "blur(22px)";
  ctx.drawImage(backdrop, 0, 0);
  ctx.filter = "none";
  const glass = ctx.createLinearGradient(panelX, panelTop, width, height);
  glass.addColorStop(0, "rgba(120,29,66,.78)");
  glass.addColorStop(.55, "rgba(69,18,41,.86)");
  glass.addColorStop(1, "rgba(39,16,29,.9)");
  ctx.fillStyle = glass;
  ctx.fillRect(panelX, panelTop, panelWidth, panelHeight);
  const sheen = ctx.createLinearGradient(0, panelTop, 0, panelTop + panelHeight);
  sheen.addColorStop(0, "rgba(255,255,255,.16)");
  sheen.addColorStop(.45, "rgba(255,255,255,.015)");
  sheen.addColorStop(1, "rgba(255,255,255,.04)");
  ctx.fillStyle = sheen;
  ctx.fillRect(panelX, panelTop, panelWidth, panelHeight);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(panelX + 1, panelTop + 1, panelWidth - 2, panelHeight - 2, 27);
  ctx.stroke();

  const meet = meetDetails(state.meetName, state.meetDate);
  const name = (state.name.trim() || "SWIMMER NAME").toUpperCase();
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  fitText(ctx, name, 900, 64, 800);
  ctx.fillText(name, 62, panelTop + (meet ? 65 : 76), 900);

  ctx.fillStyle = "#efdbe4";
  fitText(ctx, (state.headline || "ACHIEVEMENT").toUpperCase(), 900, 32, 700);
  ctx.fillText((state.headline || "ACHIEVEMENT").toUpperCase(), 64, panelTop + (meet ? 108 : 125), 900);
  ctx.fillStyle = "#d6bdc9";
  ctx.font = '500 18px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(state.subline.toUpperCase(), 64, panelTop + (meet ? 134 : 157), 900);
  if (meet) {
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 18px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(meet.toUpperCase(), 64, panelTop + 161, 900);
  }

  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.beginPath();
  ctx.roundRect(62, panelTop + 178, 956, 49, 12);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.17)";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 23px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText((state.eventLine || "EVENT • TIME").toUpperCase(), 80, panelTop + 210, 920);

  ctx.fillStyle = "rgba(255,255,255,.2)";
  ctx.fillRect(62, panelTop + 244, 956, 1);
  if (state.brandMark) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(62, panelTop + 257, 43, 47, 9);
    ctx.fill();
    ctx.drawImage(state.brandMark, 67, panelTop + 260, 32, 38);
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 18px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("JENKS TROJANS", 120, panelTop + 284);
  ctx.textAlign = "right";
  ctx.fillStyle = "#e7d1dc";
  ctx.font = '600 17px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(state.classYear.toUpperCase(), 1018, panelTop + 284, 500);
  ctx.fillStyle = maroon;
  ctx.fillRect(0, height - 4, width, 4);
}

export default function CardStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("Avery Thompson");
  const [classYear, setClassYear] = useState("Class of 2027");
  const [achievementIndex, setAchievementIndex] = useState(0);
  const [headline, setHeadline] = useState<string>(initialAchievement.headline);
  const [subline, setSubline] = useState<string>(initialAchievement.subline);
  const [eventName, setEventName] = useState("100Y Butterfly");
  const [time, setTime] = useState("55.42");
  const [meetName, setMeetName] = useState("");
  const [meetDate, setMeetDate] = useState("");
  const [format, setFormat] = useState<CardFormat>("portrait");
  const [template, setTemplate] = useState<CardTemplate>("signature");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [brandMark, setBrandMark] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [horizontalPosition, setHorizontalPosition] = useState(0);
  const [verticalPosition, setVerticalPosition] = useState(0);
  const [exporting, setExporting] = useState<CardTemplate | null>(null);
  const [exportNotice, setExportNotice] = useState("");
  const [photoError, setPhotoError] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;
    const eventLine = [eventName.trim(), time.trim()].filter(Boolean).join(" • ");
    drawCard(canvasRef.current, { name, classYear, headline, subline, eventLine, eventName, time, meetName, meetDate, format, template, image: photo, brandMark, zoom, horizontalPosition, verticalPosition });
  }, [name, classYear, headline, subline, eventName, time, meetName, meetDate, format, template, photo, brandMark, zoom, horizontalPosition, verticalPosition]);

  useEffect(() => {
    loadImage("/jenks-trojan-logo.png").then(setBrandMark).catch(() => setBrandMark(null));
  }, []);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  function chooseAchievement(index: number) {
    const next = achievements[index];
    setAchievementIndex(index);
    setHeadline(next.headline);
    setSubline(next.subline);
  }

  async function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Please choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setPhotoError("Please choose a photo smaller than 20 MB.");
      return;
    }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setZoom(1);
    setHorizontalPosition(0);
    setVerticalPosition(0);
    try {
      setPhoto(await loadImage(url));
    } catch {
      setPhoto(null);
      setPhotoError("This photo could not be opened. Please choose another JPG, PNG, or WebP image.");
    }
  }

  function downloadCard(targetTemplate: CardTemplate) {
    const exportCanvas = document.createElement("canvas");
    const eventLine = [eventName.trim(), time.trim()].filter(Boolean).join(" • ");
    setExporting(targetTemplate);
    setExportNotice("");
    try {
    drawCard(exportCanvas, { name, classYear, headline, subline, eventLine, eventName, time, meetName, meetDate, format, template: targetTemplate, image: photo, brandMark, zoom, horizontalPosition, verticalPosition });
    exportCanvas.toBlob((blob) => {
      if (!blob) { setExporting(null); setExportNotice("The image could not be prepared. Please try again."); return; }
      const link = document.createElement("a");
      link.download = imageFilename(name, targetTemplate, format);
      link.href = URL.createObjectURL(blob);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 30000);
      setExportNotice(`${targetTemplate === "classic" ? "Classic" : targetTemplate === "race" ? "Race Result" : "Signature"} PNG prepared at 1080 × ${socialFormats[format].height}. Check your downloads or save the image if your browser opens it.`);
      setExporting(null);
    }, "image/png");
    } catch {
      setExporting(null);
      setExportNotice("The image could not be exported. Please reload your photo and try again.");
    }
  }

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <a className="studio-brand" href="#top" aria-label="Jenks Trojan Swim Club card studio home">
          <span className="studio-brand-mark" aria-hidden="true" />
          <span><b>JENKS TROJANS</b><small>SWIM CLUB</small></span>
        </a>
        <div className="header-title"><span>TEAM TOOL</span><b>ACHIEVEMENT CARD STUDIO</b></div>
        <span className="privacy-note"><i /> Photos stay on this device</span>
      </header>

      <section className="studio-intro" id="top">
        <div>
          <span className="studio-kicker"><i /> CELEBRATE THE NEXT LEVEL</span>
          <h1>Make their moment<br /><em>look legendary.</em></h1>
        </div>
        <p>Create a polished, team-ready achievement graphic in minutes. Add the swimmer, choose the milestone, then download a high-resolution PNG.</p>
      </section>

      <section className="studio-workspace" aria-label="Achievement card maker">
        <aside className="studio-controls">
          <div className="control-section photo-control">
            <span className="section-number">01</span>
            <div className="section-heading"><h2>Add swimmer photo</h2><span>JPG, PNG or WebP</span></div>
            <input ref={fileRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} />
            <button className="upload-button" type="button" onClick={() => fileRef.current?.click()}>
              <span className="upload-icon">↑</span>
              <span><b>{photo ? "Replace photo" : "Choose a photo"}</b><small>{photo ? "Photo ready • click to change" : "Portrait photos work best"}</small></span>
              <b className="button-arrow">→</b>
            </button>
            <small className="device-note">Photos stay on this device · up to 20 MB</small>
            {photoError && <p role="alert">{photoError}</p>}
            {photo && (
              <div className="photo-sliders">
                <label><span>Zoom</span><input aria-label="Photo zoom" type="range" min="1" max="2" step="0.02" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
                <label><span>Left / right</span><input aria-label="Photo horizontal focus" type="range" min="-50" max="50" step="1" value={horizontalPosition} onChange={(e) => setHorizontalPosition(Number(e.target.value))} /></label>
                <label><span>Up / down</span><input aria-label="Photo vertical focus" type="range" min="-50" max="50" step="1" value={verticalPosition} onChange={(e) => setVerticalPosition(Number(e.target.value))} /></label>
              </div>
            )}
          </div>

          <div className="control-section">
            <span className="section-number">02</span>
            <div className="section-heading"><h2>Choose the milestone</h2><span>Seven team presets</span></div>
            <div className="achievement-grid" role="group" aria-label="Achievement preset">
              {achievements.map((item, index) => (
                <button key={item.label} type="button" className={achievementIndex === index ? "active" : ""} onClick={() => chooseAchievement(index)}>
                  <span>{String(index + 1).padStart(2, "0")}</span>{item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-section details-section">
            <span className="section-number">03</span>
            <div className="section-heading"><h2>Personalize the card</h2><span>Edits update live</span></div>
            <label className="studio-field"><span>Swimmer name</span><input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} /></label>
            <label className="studio-field"><span>Achievement name</span><input value={headline.replaceAll("\n", " ")} maxLength={34} onChange={(e) => { setHeadline(e.target.value.toUpperCase()); setAchievementIndex(-1); }} /></label>
            <div className="field-row">
              <label className="studio-field"><span>Class / team</span><input value={classYear} maxLength={24} onChange={(e) => setClassYear(e.target.value)} /></label>
              <label className="studio-field"><span>Event</span><input value={eventName} maxLength={24} onChange={(e) => setEventName(e.target.value)} /></label>
            </div>
            <label className="studio-field"><span>Time</span><input value={time} maxLength={16} inputMode="decimal" placeholder="e.g. 55.42" onChange={(e) => setTime(e.target.value)} /></label>
            <label className="studio-field"><span>Supporting line</span><input value={subline} maxLength={48} onChange={(e) => setSubline(e.target.value)} /></label>
            <label className="studio-field"><span>Meet name (optional)</span><input value={meetName} maxLength={60} placeholder="e.g. Central Zone Championships" onChange={(e) => setMeetName(e.target.value)} /></label>
            <label className="studio-field"><span>Meet date (optional)</span><input type="date" value={meetDate} min="1900-01-01" max="9999-12-31" onChange={(e) => setMeetDate(e.target.value)} /></label>
          </div>
        </aside>

        <div className="preview-panel">
          <div className="preview-toolbar">
            <div><span>LIVE PREVIEW</span><small>{format === "portrait" ? "1080 × 1350 PX" : "1080 × 1080 PX"}</small></div>
            <div className="format-toggle" role="group" aria-label="Card format">
              <button type="button" aria-pressed={format === "portrait"} className={format === "portrait" ? "active" : ""} onClick={() => setFormat("portrait")}><i className="portrait-icon" /> Instagram · 4:5</button>
              <button type="button" aria-pressed={format === "square"} className={format === "square" ? "active" : ""} onClick={() => setFormat("square")}><i className="square-icon" /> Facebook · 1:1</button>
            </div>
          </div>
          <div className="template-picker" role="group" aria-label="Card template">
            <button type="button" className={template === "classic" ? "active" : ""} onClick={() => setTemplate("classic")}>
              <span>01</span><div><b>Classic Zone</b><small>Original banner format</small></div><i>Current</i>
            </button>
            <button type="button" className={template === "signature" ? "active" : ""} onClick={() => setTemplate("signature")}>
              <span>02</span><div><b>JTSC Signature</b><small>Compact frosted glass</small></div><i>New</i>
            </button>
            <button type="button" aria-pressed={template === "race"} className={template === "race" ? "active" : ""} onClick={() => setTemplate("race")}>
              <span>03</span><div><b>Race Result</b><small>Bold time-first layout</small></div><i>New</i>
            </button>
          </div>
          <div className={`canvas-stage ${format}`}>
            <canvas ref={canvasRef} aria-label="Preview of the swimmer achievement card" />
          </div>
          <div className="export-row">
            <div><b>Download any design</b><span>{socialFormats[format].label} · 1080 × {socialFormats[format].height} · PNG</span></div>
            <div className="download-options">
              <button type="button" className="secondary-download" onClick={() => downloadCard("classic")} disabled={exporting !== null}><span>↓</span>{exporting === "classic" ? "Preparing…" : "Classic PNG"}</button>
              <button type="button" onClick={() => downloadCard("signature")} disabled={exporting !== null}><span>↓</span>{exporting === "signature" ? "Preparing…" : "Signature PNG"}</button>
              <button type="button" onClick={() => downloadCard("race")} disabled={exporting !== null}><span>↓</span>{exporting === "race" ? "Preparing…" : "Race Result PNG"}</button>
            </div>
          </div>
          <p className="export-help">Both sizes can be uploaded to Instagram and Facebook feeds. Choose a size above, then download Classic, Signature, or Race Result. Profile-grid previews may crop differently.</p>
          <p className="export-status" role="status">{exportNotice}</p>
        </div>
      </section>

      <SocialCaptions details={{ name, headline, subline, eventName, time, meetName, meetDate }} />

      <footer className="studio-footer"><span>JTSC • JENKS, OKLAHOMA</span><b>Built for every breakthrough.</b><span>RISE TOGETHER</span></footer>
    </main>
  );
}
