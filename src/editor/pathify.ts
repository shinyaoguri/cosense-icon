import { xmlEscape } from "./dom";
import type { IconOpts } from "./state";
import type { OpenTypeFont } from "./types";

export async function fetchFontCss(
  family: string,
  weight: string,
  text: string,
): Promise<string> {
  const p = new URLSearchParams();
  p.set("family", family);
  if (weight) p.set("weight", String(weight));
  if (text) p.set("text", text);
  const res = await fetch("/api/font-css?" + p.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      "Google Fonts CSS取得失敗: " + res.status + " " + body.slice(0, 120),
    );
  }
  return res.text();
}

export function extractFontUrls(css: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*['"]?(https?:\/\/[^)'"\s]+)['"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const url = m[1];
    if (url) urls.push(url);
  }
  return urls;
}

type FontFormat = "woff2" | "woff" | "otf" | "ttf" | "unknown";

export function detectFontFormat(u8: Uint8Array): FontFormat {
  if (u8.length < 4) return "unknown";
  const sig = String.fromCharCode(u8[0]!, u8[1]!, u8[2]!, u8[3]!);
  if (sig === "wOF2") return "woff2";
  if (sig === "wOFF") return "woff";
  if (sig === "OTTO") return "otf";
  if (sig === "true" || sig === "typ1") return "ttf";
  if (u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00) return "ttf";
  return "unknown";
}

let _wawoff2Ready: Promise<void> | null = null;

export function waitForWawoff2(): Promise<void> {
  if (_wawoff2Ready) return _wawoff2Ready;
  _wawoff2Ready = new Promise((resolve, reject) => {
    let n = 0;
    const tick = (): void => {
      if (window.Module && typeof window.Module.decompress === "function") {
        resolve();
      } else if (++n >= 200) {
        reject(new Error("wawoff2 初期化タイムアウト"));
      } else {
        setTimeout(tick, 50);
      }
    };
    tick();
  });
  return _wawoff2Ready;
}

export async function fetchFontBuffer(
  family: string,
  weight: string,
  text: string,
): Promise<ArrayBuffer> {
  const css = await fetchFontCss(family, weight, text);
  const urls = extractFontUrls(css);
  if (urls.length === 0) {
    console.error("CSS body:", css.slice(0, 400));
    throw new Error("font URL not found in CSS: " + css.slice(0, 120));
  }
  const priority: RegExp[] = [
    /\.woff2(\?|$|#)/i,
    /\.woff(\?|$|#)/i,
    /\.ttf(\?|$|#)/i,
    /\.otf(\?|$|#)/i,
  ];
  let fontUrl: string | null = null;
  for (const re of priority) {
    fontUrl = urls.find(u => re.test(u)) ?? null;
    if (fontUrl) break;
  }
  if (!fontUrl) fontUrl = urls[0]!;

  const buf = await fetch(fontUrl).then(r => {
    if (!r.ok) throw new Error("font download failed: " + r.status);
    return r.arrayBuffer();
  });
  let u8: Uint8Array<ArrayBufferLike> = new Uint8Array(buf);
  const fmt = detectFontFormat(u8);
  if (fmt === "woff2") {
    await waitForWawoff2();
    if (!window.Module || typeof window.Module.decompress !== "function") {
      throw new Error("wawoff2 decompress unavailable");
    }
    const out = window.Module.decompress(u8);
    u8 = out instanceof Uint8Array ? out : new Uint8Array(out);
    const decSig = detectFontFormat(u8);
    if (decSig === "woff2" || decSig === "unknown") {
      throw new Error("woff2 decompress failed (still " + decSig + ")");
    }
  } else if (fmt === "woff") {
    throw new Error("woff (v1) フォーマットは未対応。woff2/ttf を期待。");
  }
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

function rotationWrap(
  width: number,
  height: number,
  rotate: number,
): { outerW: number; outerH: number; transform: string | null } {
  if (rotate === 90)
    return { outerW: height, outerH: width, transform: `translate(${height} 0) rotate(90)` };
  if (rotate === 180)
    return { outerW: width, outerH: height, transform: `translate(${width} ${height}) rotate(180)` };
  if (rotate === 270)
    return { outerW: height, outerH: width, transform: `translate(0 ${width}) rotate(270)` };
  return { outerW: width, outerH: height, transform: null };
}

export function buildSvgFromFont(
  font: OpenTypeFont,
  lines: string[],
  opts: IconOpts,
): string {
  const { width, height, padding, bg, fg, radius, align, lh } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  let fontSize: number;
  if (opts.size) {
    fontSize = opts.size;
  } else {
    const probe = 100;
    const longest = lines.reduce((max, line) => {
      const w = font.getAdvanceWidth(line, probe);
      return Math.max(max, w);
    }, 0);
    const maxByWidth = longest > 0 ? (innerW / longest) * probe : innerH;
    const maxByHeight = innerH / (lines.length * lh);
    fontSize = Math.max(8, Math.min(maxByWidth, maxByHeight));
  }

  const totalTextHeight = fontSize * lh * lines.length;
  const startY = (height - totalTextHeight) / 2 + fontSize * lh * 0.8;

  const pathDatas = lines.map((line, i) => {
    const y = startY + i * fontSize * lh;
    const lineWidth = font.getAdvanceWidth(line, fontSize);
    let x: number;
    if (align === "left") x = padding;
    else if (align === "right") x = width - padding - lineWidth;
    else x = (width - lineWidth) / 2;
    return font.getPath(line, x, y, fontSize).toPathData(2);
  });

  const bgShape = radius > 0
    ? `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${xmlEscape(bg)}"/>`
    : `<rect width="${width}" height="${height}" fill="${xmlEscape(bg)}"/>`;
  const pathEls = pathDatas
    .map(d => `<path d="${d}" fill="${xmlEscape(fg)}"/>`)
    .join("\n");

  const inner = `${bgShape}\n${pathEls}`;
  const { outerW, outerH, transform } = rotationWrap(width, height, opts.rotate ?? 0);
  const body = transform ? `<g transform="${transform}">\n${inner}\n</g>` : inner;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}">
${body}
</svg>`;
}

const _fontCache = new Map<string, OpenTypeFont>();
const FONT_CACHE_MAX = 8;
let _inflightFont: Promise<OpenTypeFont> | null = null;
let _inflightFontKey = "";

export async function ensureFont(
  family: string,
  weight: string,
  text: string,
): Promise<OpenTypeFont> {
  const key = family + "|" + weight + "|" + text;
  const cached = _fontCache.get(key);
  if (cached) {
    _fontCache.delete(key);
    _fontCache.set(key, cached);
    return cached;
  }
  if (_inflightFontKey === key && _inflightFont) return _inflightFont;

  _inflightFontKey = key;
  _inflightFont = (async () => {
    const buf = await fetchFontBuffer(family, weight, text);
    const font = opentype.parse(buf);
    _fontCache.set(key, font);
    while (_fontCache.size > FONT_CACHE_MAX) {
      const first = _fontCache.keys().next().value;
      if (first === undefined) break;
      _fontCache.delete(first);
    }
    return font;
  })();
  try {
    return await _inflightFont;
  } finally {
    if (_inflightFontKey === key) {
      _inflightFontKey = "";
      _inflightFont = null;
    }
  }
}
