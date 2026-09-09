/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// The first Pages deployment accidentally allowed failed asset responses to
// inherit an immutable cache header. Keep the public asset URL versioned so a
// browser that cached one of those failures can recover without manual cache
// clearing. The worker maps this public prefix back to the build's /assets/
// directory below.
const PUBLIC_ASSET_PREFIX = "/jtsc-card-assets-20260908/";

async function fetchAsset(request: Request, env: Env, pathname: string): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  const response = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (response.ok) return response;

  // A missing build file must be rechecked after the next deployment. Never
  // let Cloudflare's immutable /assets/* rule cache an error response again.
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function versionHtmlAssets(response: Response): Promise<Response> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("text/html")) return response;

  const headers = new Headers(response.headers);
  const link = headers.get("Link");
  if (link) headers.set("Link", link.replaceAll("/assets/", PUBLIC_ASSET_PREFIX));
  headers.delete("Content-Length");

  return new Response(
    (await response.text()).replaceAll("/assets/", PUBLIC_ASSET_PREFIX),
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    },
  );
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith(PUBLIC_ASSET_PREFIX)) {
      const assetPath = `/assets/${url.pathname.slice(PUBLIC_ASSET_PREFIX.length)}`;
      return fetchAsset(request, env, assetPath);
    }

    if (
      url.pathname.startsWith("/assets/") ||
      url.pathname === "/og.png"
    ) {
      return fetchAsset(request, env, url.pathname);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return versionHtmlAssets(await handler.fetch(request, env, ctx));
  },
};

export default worker;
