import { xmlEscape } from "./dom";
import type { IconOpts } from "./state";
import type { OpenTypeFont, OpenTypeGlyph } from "./types";
import { fitFontSizeWithWrap, wrapLines as wrapAllLines } from "../textwrap";

// 縦書きで上向きのまま組む文字 (CJK 系)
function isCJK(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x3000 && cp <= 0x303f) ||  // CJK Symbols and Punctuation
    (cp >= 0x3040 && cp <= 0x309f) ||  // Hiragana
    (cp >= 0x30a0 && cp <= 0x30ff) ||  // Katakana
    (cp >= 0x3400 && cp <= 0x4dbf) ||  // CJK Ext-A
    (cp >= 0x4e00 && cp <= 0x9fff) ||  // CJK Unified
    (cp >= 0xf900 && cp <= 0xfaff) ||  // CJK Compatibility
    (cp >= 0xff00 && cp <= 0xffef)     // Halfwidth/Fullwidth
  );
}

type VerticalCell =
  | { type: "cjk"; ch: string }
  | { type: "rotate"; ch: string }
  | { type: "tcy"; text: string };

// 1 列分の入力文字列を、縦書き 1 セル単位 (CJK / 90°回転 / 縦中横) に分割
function chunkVertical(line: string): VerticalCell[] {
  const cells: VerticalCell[] = [];
  const chars = Array.from(line);
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < chars.length && /[0-9]/.test(chars[j]!)) j++;
      const run = chars.slice(i, j).join("");
      if (run.length <= 2) {
        cells.push({ type: "tcy", text: run });
      } else {
        // 3 桁以上は 1 文字ずつ回転 (タテチュウヨコしない)
        for (const c of chars.slice(i, j)) cells.push({ type: "rotate", ch: c });
      }
      i = j;
    } else if (isCJK(ch)) {
      cells.push({ type: "cjk", ch });
      i++;
    } else {
      // ラテン・記号: 90° 回転
      cells.push({ type: "rotate", ch });
      i++;
    }
  }
  return cells;
}

// vert (Vertical Alternates) 機能の単一置換マップを取得
// フォントが GSUB の vert を持たない場合は空マップ
function getVertSubMap(font: OpenTypeFont): Map<number, number> {
  const map = new Map<number, number>();
  const sub = font.substitution;
  if (!sub) return map;
  try {
    const subs = sub.getSingle("vert");
    if (!subs) return map;
    for (const { sub: s, by } of subs) {
      map.set(s, by);
    }
  } catch {
    // 一部フォントで例外を投げることがある。無視して identity に倒す
  }
  return map;
}

// グリフ index → defs 内 id のレジスタ。<use> で参照される。
// 同じ字が繰り返し出現するほど削減効果が大きい (CJK 文章で 30〜60%)
class GlyphRegistry {
  private defs: string[] = [];
  private seen = new Set<number>();
  constructor(
    private font: OpenTypeFont,
    private fontSize: number,
  ) {}

  // glyph を defs に登録 (重複は無視)。返り値は <use href="#..."> 用の id。
  register(glyph: OpenTypeGlyph): string {
    const idx = glyph.index;
    const id = `g${idx}`;
    if (this.seen.has(idx)) return id;
    this.seen.add(idx);
    // origin (0, 0) で 1 回だけ path 化。<use x= y=> で位置決めする。
    const d = glyph.getPath(0, 0, this.fontSize).toPathData(1);
    // 空 d の場合は空 <symbol> を出さず、<use> 側で空表示にする (id ありの空 <g>)
    this.defs.push(`<g id="${id}"><path d="${d}"/></g>`);
    return id;
  }

  defsHtml(): string {
    return this.defs.join("");
  }
}

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
  wrap = false,
): string {
  const { width, height, padding, bg, fg, radius, align, lh } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  // 実フォントのアドバンス幅 (em 単位、size=1 で測る)
  const charWidthEm = (ch: string): number => font.getAdvanceWidth(ch, 1);

  let fontSize: number;
  let renderLines = lines;

  if (wrap) {
    if (opts.size) {
      fontSize = opts.size;
      renderLines = wrapAllLines(lines, innerW / fontSize, charWidthEm);
    } else {
      const fit = fitFontSizeWithWrap(lines, innerW, innerH, lh, charWidthEm);
      fontSize = fit.fontSize;
      renderLines = fit.wrappedLines;
    }
  } else if (opts.size) {
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

  const totalTextHeight = fontSize * lh * renderLines.length;
  const startY = (height - totalTextHeight) / 2 + fontSize * lh * 0.8;

  const upe = font.unitsPerEm ?? 1000;
  const registry = new GlyphRegistry(font, fontSize);
  const useEls: string[] = [];

  for (let i = 0; i < renderLines.length; i++) {
    const line = renderLines[i]!;
    const y = startY + i * fontSize * lh;
    const lineWidth = font.getAdvanceWidth(line, fontSize);
    let x: number;
    if (align === "left") x = padding;
    else if (align === "right") x = width - padding - lineWidth;
    else x = (width - lineWidth) / 2;

    // GSUB shaping (liga 等) を適用したグリフ列
    const shaped = font.stringToGlyphs?.(line);
    if (!shaped || shaped.length === 0) continue;

    let cursorX = x;
    const unit = fontSize / upe;
    for (let gi = 0; gi < shaped.length; gi++) {
      const glyph = shaped[gi]!;
      // GPOS kern (Latin で重要、CJK ではほぼ 0)
      if (gi > 0 && font.getKerningValue) {
        const kern = font.getKerningValue(shaped[gi - 1]!, glyph) ?? 0;
        cursorX += kern * unit;
      }
      const id = registry.register(glyph);
      useEls.push(
        `<use href="#${id}" x="${cursorX.toFixed(1)}" y="${y.toFixed(1)}"/>`,
      );
      cursorX += (glyph.advanceWidth ?? upe) * unit;
    }
  }

  // 背景: gradient or 単色
  const useGrad = !!opts.gradTo;
  let gradDef = "";
  let bgFillVal = xmlEscape(bg);
  if (useGrad) {
    const angle = ((opts.gradAngle ?? 135) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const x1 = (0.5 - dx / 2) * 100;
    const y1 = (0.5 - dy / 2) * 100;
    const x2 = (0.5 + dx / 2) * 100;
    const y2 = (0.5 + dy / 2) * 100;
    gradDef = `<linearGradient id="bgGrad" x1="${x1.toFixed(2)}%" y1="${y1.toFixed(2)}%" x2="${x2.toFixed(2)}%" y2="${y2.toFixed(2)}%"><stop offset="0%" stop-color="${xmlEscape(bg)}"/><stop offset="100%" stop-color="${xmlEscape(opts.gradTo!)}"/></linearGradient>`;
    bgFillVal = "url(#bgGrad)";
  }
  const bgShape = radius > 0
    ? `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${bgFillVal}"/>`
    : `<rect width="${width}" height="${height}" fill="${bgFillVal}"/>`;
  const useShadow = opts.shadow === "on";
  const shadowColor = opts.shadowColor ?? "rgba(0,0,0,0.45)";
  const shadowBlur = opts.shadowBlur ?? 4;
  const defParts: string[] = [];
  if (useShadow) {
    defParts.push(
      `<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${Math.max(1, shadowBlur / 2)}" stdDeviation="${shadowBlur}" flood-color="${xmlEscape(shadowColor)}"/></filter>`,
    );
  }
  if (gradDef) defParts.push(gradDef);
  // グリフ定義を defs に同梱
  const glyphDefs = registry.defsHtml();
  const allDefParts = [...defParts, glyphDefs].filter(s => s.length > 0);
  const filterDef = allDefParts.length > 0 ? `<defs>${allDefParts.join("")}</defs>` : "";
  const filterAttr = useShadow ? ` filter="url(#ds)"` : "";
  const strokeAttrs =
    opts.stroke && (opts.strokeWidth ?? 0) > 0
      ? ` stroke="${xmlEscape(opts.stroke)}" stroke-width="${opts.strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"`
      : "";
  // <use> は単一の親 <g> でまとめて塗り/縁取り/影属性を共有 (1 字ごとに付けるとサイズ膨張)
  const textLayer = `<g fill="${xmlEscape(fg)}"${strokeAttrs}${filterAttr}>${useEls.join("")}</g>`;

  const inner = `${filterDef}${bgShape}\n${textLayer}`;
  const { outerW, outerH, transform } = rotationWrap(width, height, opts.rotate ?? 0);
  const body = transform ? `<g transform="${transform}">\n${inner}\n</g>` : inner;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}">
${body}
</svg>`;
}

export function buildVerticalSvgFromFont(
  font: OpenTypeFont,
  lines: string[],
  opts: IconOpts,
): string {
  const { width, height, padding, bg, fg, radius, align, lh } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const upe = font.unitsPerEm ?? 1000;
  const ascRatio = (font.ascender ?? upe * 0.85) / upe;

  const vertSubMap = getVertSubMap(font);

  // 各列のセル列を事前に分割
  const colCells = lines.map(chunkVertical);
  const maxCells = colCells.reduce((m, cs) => Math.max(m, cs.length), 0);
  const nCols = Math.max(1, lines.length);

  // 自動サイズ: 高さ方向 (セル数) と横方向 (列数 × lineHeight) の両制約
  let fontSize: number;
  if (opts.size) {
    fontSize = opts.size;
  } else {
    fontSize = Math.max(
      8,
      Math.min(
        innerH / Math.max(1, maxCells),
        innerW / Math.max(1, nCols * lh),
      ),
    );
  }

  const colWidth = fontSize * lh;
  const totalColsW = nCols * colWidth;

  // 列群の右端 (最初の列) の中心 X
  let rightCenterX: number;
  if (align === "left" || align === "justify") {
    rightCenterX = padding + totalColsW - colWidth / 2;
  } else if (align === "right") {
    rightCenterX = width - padding - colWidth / 2;
  } else {
    rightCenterX = (width - totalColsW) / 2 + totalColsW - colWidth / 2;
  }

  const registry = new GlyphRegistry(font, fontSize);
  const useEls: string[] = [];
  // TCY セル内の小グリフ群は registry とは別 fontSize 系列なので、
  // group ごとの transform で位置決めし、内部に <use> を並べる。
  // (TCY は CJK と同じ fontSize の glyph を使うが、scaleX で潰す)

  for (let ci = 0; ci < lines.length; ci++) {
    const cells = colCells[ci]!;
    const colCenterX = rightCenterX - ci * colWidth;

    // 列内の縦位置: align によって 上/中央/下
    let colTopY: number;
    if (align === "left" || align === "justify") {
      colTopY = padding;
    } else if (align === "right") {
      colTopY = height - padding - cells.length * fontSize;
    } else {
      colTopY = (height - cells.length * fontSize) / 2;
    }

    let cellTopY = colTopY;
    for (const cell of cells) {
      const cellCenterY = cellTopY + fontSize / 2;

      if (cell.type === "cjk") {
        const glyph = font.charToGlyph?.(cell.ch);
        if (!glyph) {
          cellTopY += fontSize;
          continue;
        }
        const targetIndex = vertSubMap.get(glyph.index) ?? glyph.index;
        const g = font.glyphs?.get(targetIndex) ?? glyph;
        const id = registry.register(g);
        const glyphAdv = ((g.advanceWidth ?? upe) * fontSize) / upe;
        const x = colCenterX - glyphAdv / 2;
        const baselineY = cellTopY + ascRatio * fontSize;
        useEls.push(
          `<use href="#${id}" x="${x.toFixed(1)}" y="${baselineY.toFixed(1)}"/>`,
        );
      } else if (cell.type === "rotate") {
        const glyph = font.charToGlyph?.(cell.ch);
        if (!glyph) {
          cellTopY += fontSize;
          continue;
        }
        const g = font.glyphs?.get(glyph.index) ?? glyph;
        const id = registry.register(g);
        const glyphAdv = ((g.advanceWidth ?? upe * 0.5) * fontSize) / upe;
        const x = colCenterX - glyphAdv / 2;
        const baselineY = cellCenterY + fontSize * 0.25;
        // <use> 自身に transform を載せて回転 (個別 <g> でラップしない)
        useEls.push(
          `<use href="#${id}" x="${x.toFixed(1)}" y="${baselineY.toFixed(1)}" transform="rotate(90 ${colCenterX.toFixed(2)} ${cellCenterY.toFixed(2)})"/>`,
        );
      } else {
        // tcy: 1〜2 桁を 1 em 角に圧縮。文字毎にグリフを並べて <g> に scaleX を当てる
        const shaped = font.stringToGlyphs?.(cell.text);
        if (!shaped || shaped.length === 0) {
          cellTopY += fontSize;
          continue;
        }
        const runAdv = font.getAdvanceWidth(cell.text, fontSize);
        if (runAdv <= 0) {
          cellTopY += fontSize;
          continue;
        }
        const targetW = fontSize * 0.85;
        const scaleX = targetW / runAdv;
        const tx = colCenterX - targetW / 2;
        const ty = cellTopY + ascRatio * fontSize;
        // group 内ローカル座標で並べた <use> 列を transform で配置
        let cursor = 0;
        const inner: string[] = [];
        for (const gly of shaped) {
          const id = registry.register(gly);
          inner.push(
            `<use href="#${id}" x="${cursor.toFixed(1)}" y="0"/>`,
          );
          cursor += ((gly.advanceWidth ?? upe) * fontSize) / upe;
        }
        useEls.push(
          `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scaleX.toFixed(4)} 1)">${inner.join("")}</g>`,
        );
      }
      cellTopY += fontSize;
    }
  }

  // 背景・グラデーション・影 (buildSvgFromFont と同じロジック)
  const useGrad = !!opts.gradTo;
  let gradDef = "";
  let bgFillVal = xmlEscape(bg);
  if (useGrad) {
    const angle = ((opts.gradAngle ?? 135) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const x1 = (0.5 - dx / 2) * 100;
    const y1 = (0.5 - dy / 2) * 100;
    const x2 = (0.5 + dx / 2) * 100;
    const y2 = (0.5 + dy / 2) * 100;
    gradDef = `<linearGradient id="bgGrad" x1="${x1.toFixed(2)}%" y1="${y1.toFixed(2)}%" x2="${x2.toFixed(2)}%" y2="${y2.toFixed(2)}%"><stop offset="0%" stop-color="${xmlEscape(bg)}"/><stop offset="100%" stop-color="${xmlEscape(opts.gradTo!)}"/></linearGradient>`;
    bgFillVal = "url(#bgGrad)";
  }
  const bgShape = radius > 0
    ? `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${bgFillVal}"/>`
    : `<rect width="${width}" height="${height}" fill="${bgFillVal}"/>`;

  const useShadow = opts.shadow === "on";
  const shadowColor = opts.shadowColor ?? "rgba(0,0,0,0.45)";
  const shadowBlur = opts.shadowBlur ?? 4;
  const defParts: string[] = [];
  if (useShadow) {
    defParts.push(
      `<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${Math.max(1, shadowBlur / 2)}" stdDeviation="${shadowBlur}" flood-color="${xmlEscape(shadowColor)}"/></filter>`,
    );
  }
  if (gradDef) defParts.push(gradDef);
  const glyphDefs = registry.defsHtml();
  const allDefParts = [...defParts, glyphDefs].filter(s => s.length > 0);
  const filterDef = allDefParts.length > 0 ? `<defs>${allDefParts.join("")}</defs>` : "";
  const filterAttr = useShadow ? ` filter="url(#ds)"` : "";

  const strokeAttrs =
    opts.stroke && (opts.strokeWidth ?? 0) > 0
      ? ` stroke="${xmlEscape(opts.stroke)}" stroke-width="${opts.strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"`
      : "";

  // 全 use を共通の塗り/縁取り/影属性つきの <g> でまとめる
  const textLayer = `<g fill="${xmlEscape(fg)}"${strokeAttrs}${filterAttr}>${useEls.join("")}</g>`;

  const inner = `${filterDef}${bgShape}\n${textLayer}`;
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
