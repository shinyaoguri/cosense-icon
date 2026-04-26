import {
  isDynamicKeyword,
  renderDynamicSvg,
  resolveTimezone,
} from "./dynamic";
import editorHtml from "./editor.html";
import { isGoogleFontCandidate, parsePath, type ParsedPath } from "./parser";
import { deterministicPalette } from "./random";
import {
  buildRegenUrl,
  computeKey,
  r2Key,
  sanitizeSvg,
  verifyTurnstile,
  withErrorMarker,
  type RegistryEnv,
} from "./registry";
import { renderSvg } from "./svg";

const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
  "cdn-cache-control": "no-store",
  pragma: "no-cache",
  expires: "0",
};

const FALLBACK_CACHE_CONTROL =
  "public, max-age=60, stale-while-revalidate=60";
const IMMUTABLE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";
const SVG_CONTENT_TYPE = "image/svg+xml; charset=utf-8";

const MAX_REGISTER_BYTES = 200_000;

const UA_MODERN_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function handleFontCss(url: URL): Promise<Response> {
  const family = url.searchParams.get("family");
  if (!family) return new Response("missing family", { status: 400 });
  const weight = url.searchParams.get("weight");
  const text = url.searchParams.get("text");

  const buildUpstream = (w: string | null, t: string | null): string => {
    const u = new URL("https://fonts.googleapis.com/css2");
    u.searchParams.set("family", w ? `${family}:wght@${w}` : family);
    if (t) u.searchParams.set("text", t);
    return u.toString();
  };

  const combos: Array<[string | null, string | null]> = [
    [weight, text],
    [null, text],
    [weight, null],
    [null, null],
  ];

  let last: Response | null = null;
  for (const [w, t] of combos) {
    const res = await fetch(buildUpstream(w, t), {
      headers: {
        "user-agent": UA_MODERN_CHROME,
        accept: "text/css,*/*;q=0.1",
      },
    });
    if (res.ok) {
      const body = await res.text();
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "public, max-age=86400",
          "access-control-allow-origin": "*",
        },
      });
    }
    last = res;
  }
  const body = last ? await last.text() : "";
  return new Response(body, {
    status: last?.status ?? 502,
    headers: {
      "content-type": "text/css; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEditorHtml(url: URL): string {
  // 拡張子なしパスならその状態の SVG を OGP 画像に
  // それ以外（"/"）はトップページ用デフォルト画像
  const trimmed = url.pathname.replace(/^\/+/, "");
  const hasState = trimmed.length > 0;
  const ogPath = hasState
    ? "/" + trimmed.replace(/\/$/, "") + ".svg"
    : "/cosense-icon.svg";
  const ogImage = url.origin + ogPath;
  const ogUrl = url.origin + url.pathname;
  return editorHtml
    .replace(/__OG_IMAGE__/g, escapeHtml(ogImage))
    .replace(/__OG_URL__/g, escapeHtml(ogUrl));
}

// favicon / OGP 用デフォルト画像 (cosense-icon ロゴ風)
const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<rect width="600" height="600" rx="120" fill="#1e40af"/>
<text x="300" y="380" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="280" text-anchor="middle">ic</text>
</svg>`;

function applyRandomPalette(parsed: ParsedPath): void {
  if (!parsed.random) return;
  const palette = deterministicPalette(parsed.text.join("\n"));
  if (!parsed.explicit.has("bg")) parsed.options.bg = palette.bg;
  if (!parsed.explicit.has("fg")) parsed.options.fg = palette.fg;
}

async function handleIcon(
  url: URL,
  parsed: ParsedPath,
  env: RegistryEnv,
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  const dynamic = isDynamicKeyword(parsed.text);
  if (dynamic) {
    const cfTz = (request as unknown as { cf?: { timezone?: string } }).cf
      ?.timezone;
    const tz = resolveTimezone(parsed.options.timezone, cfTz);
    applyRandomPalette(parsed);
    const svg = renderDynamicSvg(dynamic, new Date(), tz, parsed.options);
    return new Response(svg, {
      headers: {
        "content-type": SVG_CONTENT_TYPE,
        ...NO_STORE_HEADERS,
      },
    });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  applyRandomPalette(parsed);

  const needsPathLookup = isGoogleFontCandidate(parsed.rawFontValue);

  if (needsPathLookup) {
    const hash = await computeKey(parsed);
    const key = r2Key(hash);
    const obj = await env.ICON_PATHS.get(key);
    if (obj) {
      const svg = await obj.text();
      const response = new Response(svg, {
        headers: {
          "content-type": SVG_CONTENT_TYPE,
          "cache-control": IMMUTABLE_CACHE_CONTROL,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
    const baseSvg = renderSvg(parsed.text, parsed.options);
    const regen = buildRegenUrl(url.pathname);
    const svg = withErrorMarker(
      baseSvg,
      parsed.options.width,
      parsed.options.height,
      regen,
    );
    return new Response(svg, {
      headers: {
        "content-type": SVG_CONTENT_TYPE,
        "cache-control": FALLBACK_CACHE_CONTROL,
      },
    });
  }

  const svg = renderSvg(parsed.text, parsed.options);
  const response = new Response(svg, {
    headers: {
      "content-type": SVG_CONTENT_TYPE,
      "cache-control": IMMUTABLE_CACHE_CONTROL,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleRegister(
  request: Request,
  env: RegistryEnv,
): Promise<Response> {
  if (!env.TURNSTILE_SECRET) {
    return new Response("turnstile not configured", { status: 503 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const body = payload as
    | { pathname?: unknown; svg?: unknown; turnstileToken?: unknown }
    | null;
  if (
    !body ||
    typeof body.pathname !== "string" ||
    typeof body.svg !== "string" ||
    typeof body.turnstileToken !== "string"
  ) {
    return new Response("missing fields", { status: 400 });
  }

  if (body.svg.length > MAX_REGISTER_BYTES) {
    return new Response("svg too large", { status: 413 });
  }

  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  const ok = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET, ip);
  if (!ok) return new Response("turnstile failed", { status: 403 });

  const parsed = parsePath(body.pathname);
  if (!parsed) return new Response("invalid pathname", { status: 400 });
  if (!isGoogleFontCandidate(parsed.rawFontValue)) {
    return new Response("no google font specified", { status: 400 });
  }

  const sanitized = sanitizeSvg(body.svg);
  const hash = await computeKey(parsed);
  const key = r2Key(hash);

  await env.ICON_PATHS.put(key, sanitized, {
    httpMetadata: { contentType: SVG_CONTENT_TYPE },
  });

  return Response.json({ ok: true, key: hash });
}

export default {
  async fetch(
    request: Request,
    env: RegistryEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(renderEditorHtml(url), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    if (url.pathname === "/api/register") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleRegister(request, env);
    }

    if (url.pathname === "/api/font-css") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      return handleFontCss(url);
    }

    if (url.pathname === "/favicon.ico" || url.pathname === "/cosense-icon.svg") {
      return new Response(FAVICON_SVG, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400",
        },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const parsed = parsePath(url.pathname);
    if (!parsed) {
      return new Response("Not Found", { status: 404 });
    }

    // 拡張子 .svg が無い場合はエディタを返す (URL = ステート の対応関係)
    const isSvgRequest = url.pathname.toLowerCase().endsWith(".svg");
    if (!isSvgRequest) {
      return new Response(renderEditorHtml(url), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }

    return handleIcon(url, parsed, env, request, ctx);
  },
} satisfies ExportedHandler<RegistryEnv>;
