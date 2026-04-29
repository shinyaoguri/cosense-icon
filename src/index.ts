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
  withEditorLink,
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

// Google Fonts 未登録時のフォールバック SVG 用。
// 登録が完了してから外部埋め込み (Cosense 等) で警告マーカーが消えるまでの
// 最大ウインドウは max-age + stale-while-revalidate = 60 秒。
const FALLBACK_CACHE_CONTROL =
  "public, max-age=15, stale-while-revalidate=45";
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

// PWA 用 maskable アイコン (角丸なし。OS 側で形にマスク)
const FAVICON_MASKABLE_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<rect width="600" height="600" fill="#1e40af"/>
<text x="300" y="370" fill="#ffffff" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="240" text-anchor="middle">ic</text>
</svg>`;

const PWA_MANIFEST = JSON.stringify({
  name: "Cosense Icon Generator",
  short_name: "Cosense Icon",
  description: "テキストと色を URL に埋め込むだけで SVG アイコンが作れるエディタ",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  background_color: "#060a14",
  theme_color: "#060a14",
  lang: "ja",
  dir: "ltr",
  categories: ["productivity", "design", "utilities"],
  icons: [
    { src: "/cosense-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    { src: "/cosense-icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
  ],
});

// Service Worker (オフライン対応 + シェルキャッシュ)
const SW_SCRIPT = `// cosense-icon Service Worker
const CACHE = "cosense-icon-shell-v2";
const SHELL = ["/", "/cosense-icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url; try { url = new URL(req.url); } catch { return; }
  if (url.pathname.startsWith("/api/")) return;

  const accept = req.headers.get("accept") || "";
  const isNav = req.mode === "navigate" || accept.includes("text/html");

  // ナビゲーション: network-first / cache fallback
  if (isNav && url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh.ok) {
          const c = await caches.open(CACHE);
          c.put("/", fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch {
        const cached = await caches.match("/", { ignoreSearch: true });
        return cached || new Response("オフラインです。一度オンライン状態でアクセスするとキャッシュされます。", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

  // CDN / Google Fonts: cache-first
  if (url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com" || url.host === "cdn.jsdelivr.net" || url.host === "challenges.cloudflare.com") {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) {
          const c = await caches.open(CACHE);
          c.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        return cached || new Response("offline", { status: 503 });
      }
    })());
    return;
  }

  // 同一オリジン: アイコン SVG (動的生成) は network-first
  // 未登録 → 登録の遷移時にフォールバック chip 版が SW にキャッシュされて居座らないように
  const isGeneratedIcon =
    url.origin === self.location.origin &&
    url.pathname.endsWith(".svg") &&
    url.pathname !== "/cosense-icon.svg" &&
    url.pathname !== "/cosense-icon-maskable.svg";
  if (isGeneratedIcon) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          // 1 年 immutable のものだけキャッシュ (フォールバックの短 TTL は除外)
          const cc = res.headers.get("cache-control") || "";
          if (cc.includes("immutable")) {
            const c = await caches.open(CACHE);
            c.put(req, res.clone()).catch(() => {});
          }
        }
        return res;
      } catch {
        const cached = await caches.match(req);
        return cached || new Response("offline", { status: 503 });
      }
    })());
    return;
  }

  // 同一オリジン静的: cache-first (manifest / favicon 等)
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) {
        // バックグラウンド更新
        fetch(req).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
        }).catch(() => {});
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res.ok) {
          const c = await caches.open(CACHE);
          c.put(req, res.clone()).catch(() => {});
        }
        return res;
      } catch {
        return new Response("offline", { status: 503 });
      }
    })());
  }
});
`;

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

  // SVG 全体を <a href="<editor-url>"> でラップ。
  // 単独表示や object/iframe からクリックでエディタへ。
  const editorUrl = url.origin + url.pathname.replace(/\.svg$/i, "");

  if (needsPathLookup) {
    const hash = await computeKey(parsed);
    const key = r2Key(hash);
    const obj = await env.ICON_PATHS.get(key);
    if (obj) {
      const raw = await obj.text();
      const svg = withEditorLink(raw, editorUrl);
      const response = new Response(svg, {
        headers: {
          "content-type": SVG_CONTENT_TYPE,
          "cache-control": IMMUTABLE_CACHE_CONTROL,
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }
    // R2 未登録: chip マーカーを内部に挿入してから、外側を「自動再登録 URL」でラップ。
    // クリックすると /?regen=base64(...) → エディタが開いて自動で登録フローが走る。
    const baseSvg = renderSvg(parsed.text, parsed.options);
    const regen = url.origin + buildRegenUrl(url.pathname);
    const withChip = withErrorMarker(
      baseSvg,
      parsed.options.width,
      parsed.options.height,
      regen,
    );
    const svg = withEditorLink(withChip, regen);
    return new Response(svg, {
      headers: {
        "content-type": SVG_CONTENT_TYPE,
        "cache-control": FALLBACK_CACHE_CONTROL,
      },
    });
  }

  const baseSvg = renderSvg(parsed.text, parsed.options);
  const svg = withEditorLink(baseSvg, editorUrl);
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

    if (url.pathname === "/cosense-icon-maskable.svg") {
      return new Response(FAVICON_MASKABLE_SVG, {
        headers: {
          "content-type": "image/svg+xml; charset=utf-8",
          "cache-control": "public, max-age=86400",
        },
      });
    }

    if (url.pathname === "/manifest.webmanifest") {
      return new Response(PWA_MANIFEST, {
        headers: {
          "content-type": "application/manifest+json; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname === "/sw.js") {
      return new Response(SW_SCRIPT, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          // SW 自体はキャッシュさせず、最新を取得させる
          "cache-control": "no-cache, max-age=0, must-revalidate",
          "service-worker-allowed": "/",
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
