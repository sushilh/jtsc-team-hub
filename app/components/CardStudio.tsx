"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type CardFormat = "portrait" | "square";

const achievements = [
  { label: "Futures", headline: "FUTURES QUALIFIER", subline: "USA SWIMMING FUTURES CHAMPIONSHIPS" },
  { label: "Sectionals", headline: "SECTIONALS QUALIFIER", subline: "CENTRAL ZONE SECTIONALS" },
  { label: "Zones", headline: "ZONES QUALIFIER", subline: "CENTRAL ZONE CHAMPIONSHIPS" },
  { label: "Made State", headline: "STATE QUALIFIER", subline: "OSSAA STATE CHAMPIONSHIPS" },
  { label: "Junior Nationals", headline: "JUNIOR NATIONAL QUALIFIER", subline: "USA SWIMMING JUNIOR NATIONALS" },
  { label: "National Team", headline: "NATIONAL TEAM", subline: "SELECTED • TEAM USA PATHWAY" },
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
  verticalPosition: number,
) {
  const coverScale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const sourceWidth = width / coverScale;
  const sourceHeight = height / coverScale;
  const maxX = Math.max(0, image.naturalWidth - sourceWidth);
  const maxY = Math.max(0, image.naturalHeight - sourceHeight);
  const sourceX = maxX / 2;
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

function fitDisplayText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  font: string,
) {
  let size = startSize;
  do {
    ctx.font = font.replace("{size}", String(size));
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  } while (size > 28);
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

function drawCard(
  canvas: HTMLCanvasElement,
  state: {
    name: string;
    classYear: string;
    headline: string;
    subline: string;
    eventLine: string;
    format: CardFormat;
    image: HTMLImageElement | null;
    brandMark: HTMLImageElement | null;
    zoom: number;
    verticalPosition: number;
  },
) {
  const width = 1080;
  const height = state.format === "portrait" ? 1350 : 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = width;
  canvas.height = height;

  const maroon = "#781D42";
  const maroonDark = "#2B0817";
  const aqua = "#54C7DB";

  // Full-bleed photography and a cool editorial color grade.
  const baseGradient = ctx.createLinearGradient(0, 0, width, height);
  baseGradient.addColorStop(0, "#DDE7E8");
  baseGradient.addColorStop(.45, "#5EC8D4");
  baseGradient.addColorStop(1, "#075E7B");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, width, height);

  if (state.image) {
    ctx.save();
    ctx.filter = "saturate(.72) contrast(1.08)";
    drawCoverImage(ctx, state.image, 0, 0, width, height, state.zoom, state.verticalPosition);
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (let y = 155; y < height; y += 142) ctx.fillRect(0, y, width, 3);
    ctx.fillStyle = "rgba(43,8,23,.22)";
    ctx.beginPath();
    ctx.arc(540, height * .4, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(540, height * .68, 250, 330, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const topGlow = ctx.createLinearGradient(0, 0, 0, height * .52);
  topGlow.addColorStop(0, "rgba(248,250,248,.92)");
  topGlow.addColorStop(.48, "rgba(230,247,249,.4)");
  topGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, width, height * .58);

  ctx.fillStyle = "rgba(20,190,214,.17)";
  ctx.fillRect(0, 0, width, height);

  const lowerShade = ctx.createLinearGradient(0, height * .38, 0, height);
  lowerShade.addColorStop(0, "rgba(43,8,23,0)");
  lowerShade.addColorStop(.56, "rgba(43,8,23,.18)");
  lowerShade.addColorStop(1, "rgba(43,8,23,.9)");
  ctx.fillStyle = lowerShade;
  ctx.fillRect(0, height * .38, width, height * .62);

  const edgeShade = ctx.createLinearGradient(0, 0, width, 0);
  edgeShade.addColorStop(0, "rgba(120,29,66,.34)");
  edgeShade.addColorStop(.28, "rgba(120,29,66,0)");
  edgeShade.addColorStop(.75, "rgba(43,8,23,0)");
  edgeShade.addColorStop(1, "rgba(43,8,23,.32)");
  ctx.fillStyle = edgeShade;
  ctx.fillRect(0, 0, width, height);

  // Loose lane lines and orbit strokes keep the composition in motion.
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(515, height * .46, 425, height * .18, -.16, 0, Math.PI * 1.82);
  ctx.stroke();
  ctx.strokeStyle = "rgba(84,199,219,.8)";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.ellipse(540, height * .47, 470, height * .2, -.1, .08, Math.PI * 1.18);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,.2)";
  ctx.lineWidth = 2;
  for (let y = height * .7; y < height - 150; y += 62) {
    ctx.beginPath();
    ctx.moveTo(55, y);
    ctx.bezierCurveTo(280, y - 35, 630, y + 40, 1025, y - 8);
    ctx.stroke();
  }

  // Slim, widely tracked celebration line from the reference direction.
  ctx.fillStyle = maroon;
  ctx.textAlign = "center";
  ctx.font = `500 ${state.format === "portrait" ? 31 : 27}px "Arial Narrow", "Helvetica Neue", sans-serif`;
  drawCenteredTrackedText(ctx, "CONGRATULATIONS", width / 2, state.format === "portrait" ? 102 : 82, 17);

  const nameParts = (state.name.trim() || "SWIMMER NAME").split(/\s+/);
  const firstName = nameParts.shift() || "SWIMMER";
  const lastName = nameParts.join(" ") || "TROJAN";
  const bigNameY = state.format === "portrait" ? 490 : 405;
  const firstSize = fitDisplayText(ctx, firstName.toUpperCase(), 950, state.format === "portrait" ? 270 : 225, '900 {size}px "Arial Narrow", Impact, sans-serif');
  const nameGradient = ctx.createLinearGradient(90, bigNameY - firstSize, 900, bigNameY);
  nameGradient.addColorStop(0, "#16D3E1");
  nameGradient.addColorStop(.55, "#42C8DD");
  nameGradient.addColorStop(1, "#067BA2");
  ctx.textAlign = "center";
  ctx.font = `900 ${firstSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,.64)";
  ctx.strokeText(firstName.toUpperCase(), width / 2, bigNameY);
  ctx.fillStyle = nameGradient;
  ctx.globalAlpha = .88;
  ctx.fillText(firstName.toUpperCase(), width / 2, bigNameY);
  ctx.globalAlpha = 1;

  const scriptY = state.format === "portrait" ? 685 : 565;
  const scriptSize = fitDisplayText(ctx, lastName, 860, state.format === "portrait" ? 178 : 145, '500 {size}px "Snell Roundhand", "Segoe Script", "Brush Script MT", cursive');
  ctx.font = `500 ${scriptSize}px "Snell Roundhand", "Segoe Script", "Brush Script MT", cursive`;
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(43,8,23,.36)";
  ctx.shadowBlur = 16;
  ctx.fillText(lastName, width / 2, scriptY);
  ctx.shadowBlur = 0;

  if (!state.image) {
    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = '700 20px "Helvetica Neue", Arial, sans-serif';
    drawCenteredTrackedText(ctx, "UPLOAD A SWIMMER PHOTO", width / 2, scriptY + 62, 4);
  }

  const detailTop = state.format === "portrait" ? height - 455 : height - 390;
  ctx.fillStyle = aqua;
  ctx.font = '800 18px "Helvetica Neue", Arial, sans-serif';
  drawCenteredTrackedText(ctx, "ACHIEVEMENT UNLOCKED", width / 2, detailTop, 7);
  ctx.fillStyle = "rgba(255,255,255,.94)";
  const achievement = (state.headline || "ACHIEVEMENT").toUpperCase();
  const achievementSize = fitText(ctx, achievement, 930, 66, 900);
  ctx.font = `900 ${achievementSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(achievement, width / 2, detailTop + 78);
  ctx.fillStyle = "rgba(255,255,255,.8)";
  ctx.font = '700 19px "Helvetica Neue", Arial, sans-serif';
  drawCenteredTrackedText(ctx, state.subline.toUpperCase(), width / 2, detailTop + 126, 3);

  ctx.fillStyle = "rgba(245,240,230,.92)";
  ctx.beginPath();
  ctx.roundRect(135, detailTop + 166, 810, 68, 34);
  ctx.fill();
  ctx.fillStyle = maroonDark;
  ctx.font = '800 24px "Helvetica Neue", Arial, sans-serif';
  drawCenteredTrackedText(ctx, (state.eventLine || "EVENT • TIME").toUpperCase(), width / 2, detailTop + 210, 4);

  // Official mark and compact team signature.
  const footerY = height - 135;
  ctx.fillStyle = "rgba(245,240,230,.94)";
  ctx.fillRect(0, footerY, width, 135);
  if (state.brandMark) ctx.drawImage(state.brandMark, 58, footerY + 17, 77, 91);
  ctx.fillStyle = maroonDark;
  ctx.textAlign = "left";
  ctx.font = '900 25px "Arial Narrow", Impact, sans-serif';
  ctx.fillText("JENKS TROJANS", 162, footerY + 56);
  ctx.fillStyle = maroon;
  ctx.font = '800 14px "Helvetica Neue", Arial, sans-serif';
  drawCenteredTrackedText(ctx, "SWIM CLUB", 227, footerY + 85, 4);
  ctx.fillStyle = aqua;
  ctx.fillRect(419, footerY + 28, 3, 76);
  ctx.fillStyle = maroon;
  ctx.textAlign = "right";
  ctx.font = '800 20px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText((state.classYear || "CLASS OF 2027").toUpperCase(), 1017, footerY + 58);
  ctx.fillStyle = "#6D6267";
  ctx.font = '700 14px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("BUILT FOR THE NEXT LEVEL", 1017, footerY + 87);
  ctx.fillStyle = maroon;
  ctx.fillRect(0, height - 8, width, 8);
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
  const [format, setFormat] = useState<CardFormat>("portrait");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [brandMark, setBrandMark] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [verticalPosition, setVerticalPosition] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    const eventLine = [eventName.trim(), time.trim()].filter(Boolean).join(" • ");
    drawCard(canvasRef.current, { name, classYear, headline, subline, eventLine, format, image: photo, brandMark, zoom, verticalPosition });
  }, [name, classYear, headline, subline, eventName, time, format, photo, brandMark, zoom, verticalPosition]);

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
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    const url = URL.createObjectURL(file);
    setPhotoUrl(url);
    setZoom(1);
    setVerticalPosition(0);
    try {
      setPhoto(await loadImage(url));
    } catch {
      setPhoto(null);
    }
  }

  function downloadCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setExporting(true);
    canvas.toBlob((blob) => {
      if (!blob) { setExporting(false); return; }
      const link = document.createElement("a");
      link.download = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "jtsc-swimmer"}-${format}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setExporting(false);
    }, "image/png");
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
            {photo && (
              <div className="photo-sliders">
                <label><span>Zoom</span><input aria-label="Photo zoom" type="range" min="1" max="2" step="0.02" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label>
                <label><span>Position</span><input aria-label="Photo vertical position" type="range" min="-50" max="50" step="1" value={verticalPosition} onChange={(e) => setVerticalPosition(Number(e.target.value))} /></label>
              </div>
            )}
          </div>

          <div className="control-section">
            <span className="section-number">02</span>
            <div className="section-heading"><h2>Choose the milestone</h2><span>Six team presets</span></div>
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
          </div>
        </aside>

        <div className="preview-panel">
          <div className="preview-toolbar">
            <div><span>LIVE PREVIEW</span><small>{format === "portrait" ? "1080 × 1350 PX" : "1080 × 1080 PX"}</small></div>
            <div className="format-toggle" role="group" aria-label="Card format">
              <button type="button" className={format === "portrait" ? "active" : ""} onClick={() => setFormat("portrait")}><i className="portrait-icon" /> Portrait</button>
              <button type="button" className={format === "square" ? "active" : ""} onClick={() => setFormat("square")}><i className="square-icon" /> Square</button>
            </div>
          </div>
          <div className={`canvas-stage ${format}`}>
            <canvas ref={canvasRef} aria-label="Preview of the swimmer achievement card" />
          </div>
          <div className="export-row">
            <div><b>Ready to celebrate?</b><span>High-resolution PNG • Instagram & Facebook ready</span></div>
            <button type="button" onClick={downloadCard} disabled={exporting}><span>↓</span>{exporting ? "Preparing…" : "Download PNG"}</button>
          </div>
        </div>
      </section>

      <footer className="studio-footer"><span>JTSC • JENKS, OKLAHOMA</span><b>Built for every breakthrough.</b><span>RISE TOGETHER</span></footer>
    </main>
  );
}
