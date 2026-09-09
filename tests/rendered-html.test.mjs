import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("build includes the JTSC achievement card studio", async () => {
  const [page, layout, studio, assets] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CardStudio.tsx", import.meta.url), "utf8"),
    readdir(new URL("../dist/client/assets/", import.meta.url)),
  ]);
  assert.match(page, /CardStudio/);
  assert.match(layout, /JTSC Achievement Card Studio/);
  assert.match(studio, /Choose a photo/);
  assert.match(studio, /Futures/);
  assert.match(studio, /Zones/);
  assert.match(studio, /Achievement name/);
  assert.match(studio, /<span>Time<\/span>/);
  assert.match(studio, /Download PNG/);
  assert.match(studio, /canvas\.toBlob/);
  assert.match(studio, /jenks-trojan-logo\.png/);
  assert.match(studio, /CONGRATULATIONS/);
  assert.ok(assets.some((name) => name.startsWith("CardStudio-") && name.endsWith(".js")));
  assert.doesNotMatch(`${page}${layout}`, /codex-preview|react-loading-skeleton|Starter Project/);
});

test("Cloudflare worker versions browser assets and does not cache missing files", async () => {
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  assert.match(worker, /PUBLIC_ASSET_PREFIX = "\/jtsc-card-assets-[0-9]+\/"/);
  assert.match(worker, /replaceAll\("\/assets\/", PUBLIC_ASSET_PREFIX\)/);
  assert.match(worker, /headers\.set\("Cache-Control", "no-store"\)/);
});
