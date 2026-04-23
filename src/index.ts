import {
  isDynamicKeyword,
  renderDynamicSvg,
  resolveTimezone,
} from "./dynamic";
import editorHtml from "./editor.html";
import { parsePath } from "./parser";
import { deterministicPalette } from "./random";
import { renderSvg } from "./svg";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "cdn-cache-control": "no-store",
  pragma: "no-cache",
  expires: "0",
};

export default {
  async fetch(
    request: Request,
    _env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(editorHtml, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const parsed = parsePath(url.pathname);
    if (!parsed) {
      return new Response("Not Found", { status: 404 });
    }

    const dynamic = isDynamicKeyword(parsed.text);
    if (dynamic) {
      const cfTz = (request as unknown as { cf?: { timezone?: string } }).cf
        ?.timezone;
      const tz = resolveTimezone(parsed.options.timezone, cfTz);
      const svg = renderDynamicSvg(dynamic, new Date(), tz, parsed.options);
      return new Response(svg, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          ...NO_STORE_HEADERS,
        },
      });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    if (parsed.random) {
      const palette = deterministicPalette(parsed.text.join("\n"));
      if (!parsed.explicit.has("bg")) parsed.options.bg = palette.bg;
      if (!parsed.explicit.has("fg")) parsed.options.fg = palette.fg;
    }

    const svg = renderSvg(parsed.text, parsed.options);

    const response = new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
} satisfies ExportedHandler;
