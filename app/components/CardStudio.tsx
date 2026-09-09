"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type CardFormat = "portrait" | "square";

const achievements = [
  { label: "Made State", headline: "STATE\nQUALIFIER", subline: "2026 OSSAA STATE CHAMPIONSHIPS" },
  { label: "Sectionals", headline: "SECTIONALS\nBOUND", subline: "2026 CENTRAL ZONE SECTIONALS" },
  { label: "Junior Nationals", headline: "JUNIOR\nNATIONALS", subline: "QUALIFIED • UNITED WE SWIM" },
  { label: "National Team", headline: "NATIONAL\nTEAM", subline: "SELECTED • TEAM USA PATHWAY" },
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
  const maroonDark = "#35101F";
  const aqua = "#54C7DB";
  const cream = "#F5F0E6";
  const photoBottom = height - 242;

  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.beginPath();
  ctx.rect(302, 0, width - 302, photoBottom);
  ctx.clip();
  if (state.image) {
    drawCoverImage(ctx, state.image, 302, 0, width - 302, photoBottom, state.zoom, state.verticalPosition);
    const photoWash = ctx.createLinearGradient(302, 0, width, photoBottom);
    photoWash.addColorStop(0, "rgba(53,16,31,.48)");
    photoWash.addColorStop(.35, "rgba(53,16,31,.06)");
    photoWash.addColorStop(1, "rgba(53,16,31,.18)");
    ctx.fillStyle = photoWash;
    ctx.fillRect(302, 0, width - 302, photoBottom);
  } else {
    const placeholder = ctx.createLinearGradient(302, 0, width, photoBottom);
    placeholder.addColorStop(0, "#D9D4CD");
    placeholder.addColorStop(1, "#A7A3A0");
    ctx.fillStyle = placeholder;
    ctx.fillRect(302, 0, width - 302, photoBottom);
    ctx.fillStyle = "rgba(255,255,255,.2)";
    for (let y = 100; y < photoBottom; y += 122) ctx.fillRect(302, y, width - 302, 4);
    ctx.fillStyle = "rgba(53,16,31,.24)";
    ctx.beginPath();
    ctx.arc(734, Math.min(440, photoBottom * .42), 112, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(734, Math.min(810, photoBottom * .76), 235, 290, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.textAlign = "center";
    ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText("ADD SWIMMER PHOTO", 735, Math.min(630, photoBottom * .58));
  }
  ctx.restore();

  // The angular maroon field is the recognizable Trojan card signature.
  ctx.fillStyle = maroon;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(565, 0);
  ctx.lineTo(412, photoBottom);
  ctx.lineTo(0, photoBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = maroonDark;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(34, 0);
  ctx.lineTo(192, photoBottom);
  ctx.lineTo(0, photoBottom);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.lineWidth = 3;
  for (let y = 520; y < photoBottom - 60; y += 84) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(120, y - 34, 220, y + 35, 410, y - 5);
    ctx.stroke();
  }

  ctx.fillStyle = aqua;
  ctx.beginPath();
  ctx.moveTo(0, photoBottom - 28);
  ctx.lineTo(416, photoBottom - 28);
  ctx.lineTo(412, photoBottom);
  ctx.lineTo(0, photoBottom);
  ctx.closePath();
  ctx.fill();

  // Brand lockup.
  ctx.fillStyle = cream;
  ctx.fillRect(74, 72, 106, 106);
  ctx.fillStyle = maroon;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 55px "Arial Narrow", Impact, sans-serif';
  ctx.fillText("JT", 127, 129);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '800 23px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("JENKS TROJANS", 203, 113);
  ctx.fillStyle = aqua;
  ctx.font = '700 18px "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = "4px";
  ctx.fillText("SWIM CLUB", 203, 147);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = aqua;
  ctx.fillRect(74, 278, 46, 7);
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font = '700 19px "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = "4px";
  ctx.fillText("BUILT FOR THE NEXT LEVEL", 74, 328);
  ctx.letterSpacing = "0px";

  const lines = state.headline.toUpperCase().split("\n").slice(0, 3);
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  lines.forEach((line, index) => {
    fitText(ctx, line, 408, lines.length > 2 ? 99 : 114);
    ctx.fillText(line, 72, 460 + index * (lines.length > 2 ? 94 : 108));
  });

  const subY = 494 + lines.length * (lines.length > 2 ? 94 : 108);
  ctx.fillStyle = aqua;
  ctx.font = '800 22px "Helvetica Neue", Arial, sans-serif';
  const subWords = state.subline.toUpperCase().split(" ");
  let subFirst = "";
  let subSecond = "";
  for (const word of subWords) {
    const candidate = subFirst ? `${subFirst} ${word}` : word;
    if (!subSecond && ctx.measureText(candidate).width < 350) subFirst = candidate;
    else subSecond = subSecond ? `${subSecond} ${word}` : word;
  }
  ctx.fillText(subFirst, 74, subY);
  if (subSecond) ctx.fillText(subSecond, 74, subY + 31);

  // Bottom information plate.
  ctx.fillStyle = cream;
  ctx.fillRect(0, photoBottom, width, height - photoBottom);
  ctx.fillStyle = maroon;
  ctx.fillRect(0, photoBottom, 22, height - photoBottom);
  ctx.fillStyle = maroon;
  const safeName = (state.name || "SWIMMER NAME").toUpperCase();
  const nameSize = fitText(ctx, safeName, 735, 78, 900);
  ctx.font = `900 ${nameSize}px "Arial Narrow", Impact, sans-serif`;
  ctx.fillText(safeName, 70, photoBottom + 101);
  ctx.fillStyle = "#282128";
  ctx.font = '700 22px "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = "2px";
  ctx.fillText((state.eventLine || "EVENT • TIME").toUpperCase(), 74, photoBottom + 155);
  ctx.fillStyle = maroon;
  ctx.textAlign = "right";
  ctx.font = '800 22px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText((state.classYear || "CLASS OF 2027").toUpperCase(), 1010, photoBottom + 101);
  ctx.fillStyle = "#6E6268";
  ctx.font = '700 16px "Helvetica Neue", Arial, sans-serif';
  ctx.letterSpacing = "3px";
  ctx.fillText("RISE TOGETHER", 1010, photoBottom + 155);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = aqua;
  ctx.fillRect(74, height - 34, 936, 5);
}

export default function CardStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("Avery Thompson");
  const [classYear, setClassYear] = useState("Class of 2027");
  const [achievementIndex, setAchievementIndex] = useState(0);
  const [headline, setHeadline] = useState<string>(initialAchievement.headline);
  const [subline, setSubline] = useState<string>(initialAchievement.subline);
  const [eventLine, setEventLine] = useState("100Y Butterfly • 55.42");
  const [format, setFormat] = useState<CardFormat>("portrait");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [verticalPosition, setVerticalPosition] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    drawCard(canvasRef.current, { name, classYear, headline, subline, eventLine, format, image: photo, zoom, verticalPosition });
  }, [name, classYear, headline, subline, eventLine, format, photo, zoom, verticalPosition]);

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
          <span className="studio-brand-mark">JT</span>
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
            <div className="section-heading"><h2>Choose the milestone</h2><span>Four team presets</span></div>
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
            <div className="field-row">
              <label className="studio-field"><span>Class / team</span><input value={classYear} maxLength={24} onChange={(e) => setClassYear(e.target.value)} /></label>
              <label className="studio-field"><span>Event / time</span><input value={eventLine} maxLength={34} onChange={(e) => setEventLine(e.target.value)} /></label>
            </div>
            <label className="studio-field"><span>Achievement headline</span><input value={headline.replace("\n", " ")} maxLength={28} onChange={(e) => setHeadline(e.target.value.toUpperCase().replace(" ", "\n"))} /></label>
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
