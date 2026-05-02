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

// 縦書き wrap: VerticalCell の配列をトークン単位 (CJK/TCY/空白/ラテン語) で列に分割
interface VCellToken {
  cells: VerticalCell[];
  cellCount: number;
  isSpace: boolean;
}

function tokenizeVerticalCells(cells: VerticalCell[]): VCellToken[] {
  const tokens: VCellToken[] = [];
  let buf: VerticalCell[] = [];

  const flush = (): void => {
    if (buf.length > 0) {
      tokens.push({ cells: buf, cellCount: buf.length, isSpace: false });
      buf = [];
    }
  };

  for (const cell of cells) {
    if (cell.type === "rotate") {
      if (/\s/.test(cell.ch)) {
        flush();
        tokens.push({ cells: [cell], cellCount: 1, isSpace: true });
      } else {
        // ラテン・記号は連続して 1 単語化 (atomic)
        buf.push(cell);
      }
    } else {
      // CJK / TCY: 個別トークン
      flush();
      tokens.push({ cells: [cell], cellCount: 1, isSpace: false });
    }
  }
  flush();
  return tokens;
}

function isSpaceCell(cell: VerticalCell): boolean {
  return cell.type === "rotate" && /\s/.test(cell.ch);
}

function wrapVerticalCells(
  cells: VerticalCell[],
  maxCells: number,
): VerticalCell[][] {
  if (cells.length === 0) return [];
  if (maxCells <= 0) return [cells];

  const tokens = tokenizeVerticalCells(cells);
  const cols: VerticalCell[][] = [];
  let buf: VerticalCell[] = [];

  const stripTrailingSpace = (arr: VerticalCell[]): void => {
    while (arr.length > 0 && isSpaceCell(arr[arr.length - 1]!)) arr.pop();
  };

  for (const tok of tokens) {
    if (tok.cellCount > maxCells && !tok.isSpace) {
      if (buf.length > 0) {
        stripTrailingSpace(buf);
        if (buf.length > 0) cols.push(buf);
        buf = [];
      }
      // ラテン語 (rotate run) を maxCells ごとに強制分割
      let chunk: VerticalCell[] = [];
      for (const c of tok.cells) {
        if (chunk.length >= maxCells) {
          cols.push(chunk);
          chunk = [];
        }
        chunk.push(c);
      }
      buf = chunk;
      continue;
    }

    if (buf.length + tok.cellCount > maxCells && buf.length > 0) {
      stripTrailingSpace(buf);
      if (buf.length > 0) cols.push(buf);
      buf = tok.isSpace ? [] : [...tok.cells];
    } else {
      if (tok.isSpace && buf.length === 0) continue;
      buf.push(...tok.cells);
    }
  }
  if (buf.length > 0) {
    stripTrailingSpace(buf);
    if (buf.length > 0) cols.push(buf);
  }
  return cols;
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

// 多くの Google Fonts は絵文字グリフを持たないため、line 全体を path 化すると
// .notdef (豆腐) になる。絵文字クラスタは <text> として残し、閲覧 OS の
// カラー絵文字フォントに描画させる。
const EMOJI_FONT_STACK =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

interface LineSegment {
  kind: "text" | "emoji";
  value: string;
  width: number;
}

function isEmojiCluster(s: string): boolean {
  return /\p{Extended_Pictographic}/u.test(s);
}

function segmentLine(
  line: string,
  font: OpenTypeFont,
  fontSize: number,
): LineSegment[] {
  if (line === "") return [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const out: LineSegment[] = [];
  let curKind: "text" | "emoji" | null = null;
  let curBuf = "";
  let curEmojiCount = 0;
  const flush = (): void => {
    if (curKind === null || curBuf === "") return;
    if (curKind === "text") {
      out.push({
        kind: "text",
        value: curBuf,
        width: font.getAdvanceWidth(curBuf, fontSize),
      });
    } else {
      // 絵文字は概ね 1em 幅。getAdvanceWidth は .notdef を返してしまうので使わない。
      out.push({
        kind: "emoji",
        value: curBuf,
        width: curEmojiCount * fontSize,
      });
    }
    curBuf = "";
    curEmojiCount = 0;
  };
  for (const { segment } of segmenter.segment(line)) {
    const k: "text" | "emoji" = isEmojiCluster(segment) ? "emoji" : "text";
    if (curKind !== null && k !== curKind) flush();
    curKind = k;
    curBuf += segment;
    if (k === "emoji") curEmojiCount++;
  }
  flush();
  return out;
}

function lineWidthOf(segs: LineSegment[]): number {
  return segs.reduce((sum, s) => sum + s.width, 0);
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
      const w = lineWidthOf(segmentLine(line, font, probe));
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
  const emojiEls: string[] = [];
  const emojiFontAttr =
    ` font-family="${xmlEscape(EMOJI_FONT_STACK)}" font-size="${fontSize}"`;

  for (let i = 0; i < renderLines.length; i++) {
    const line = renderLines[i]!;
    const y = startY + i * fontSize * lh;
    const segs = segmentLine(line, font, fontSize);
    if (segs.length === 0) continue;
    const totalLineWidth = lineWidthOf(segs);
    let x: number;
    if (align === "left") x = padding;
    else if (align === "right") x = width - padding - totalLineWidth;
    else x = (width - totalLineWidth) / 2;

    const unit = fontSize / upe;
    for (const seg of segs) {
      if (seg.kind === "text") {
        // GSUB shaping (liga 等) を適用したグリフ列
        const shaped = font.stringToGlyphs?.(seg.value);
        if (shaped && shaped.length > 0) {
          let cursorX = x;
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
      } else {
        // 絵文字は閲覧 OS のカラー絵文字フォント任せ。<text> として残す。
        emojiEls.push(
          `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}"${emojiFontAttr}>${xmlEscape(seg.value)}</text>`,
        );
      }
      x += seg.width;
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
  // <use> は単一の親 <g> でまとめて塗り/縁取り/影属性を共有 (1 字ごとに付けるとサイズ膨張)。
  // 絵文字 <text> も同じ <g> に入れ、fill / shadow を継承させる
  // (color emoji は fill を無視するが、monochrome フォールバック時は fg が効く)
  const textLayer = `<g fill="${xmlEscape(fg)}"${strokeAttrs}${filterAttr}>${useEls.join("")}${emojiEls.join("")}</g>`;

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
  wrap = false,
): string {
  const { width, height, padding, bg, fg, radius, align, lh } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const upe = font.unitsPerEm ?? 1000;
  const ascRatio = (font.ascender ?? upe * 0.85) / upe;

  const vertSubMap = getVertSubMap(font);

  // 各入力行をセル列に分割
  const lineCells = lines.map(chunkVertical);

  // 出力用の列配列。wrap モードでは入力行をさらに分割する。
  let colCells: VerticalCell[][];
  let fontSize: number;

  if (wrap) {
    if (opts.size) {
      fontSize = opts.size;
      const maxCellsPerCol = Math.max(1, Math.floor(innerH / fontSize));
      colCells = [];
      for (const cs of lineCells) {
        const split = wrapVerticalCells(cs, maxCellsPerCol);
        if (split.length === 0) colCells.push([]);
        else colCells.push(...split);
      }
    } else {
      // 自動サイズ: √(innerW × innerH / (totalCells × lh)) で初期推定
      const totalCells = lineCells.reduce((s, cs) => s + cs.length, 0) || 1;
      fontSize = Math.sqrt((innerW * innerH) / (totalCells * lh));
      fontSize = Math.min(fontSize, innerH);
      fontSize = Math.max(8, fontSize);

      const wrapAt = (fs: number): VerticalCell[][] => {
        const max = Math.max(1, Math.floor(innerH / fs));
        const out: VerticalCell[][] = [];
        for (const cs of lineCells) {
          const split = wrapVerticalCells(cs, max);
          if (split.length === 0) out.push([]);
          else out.push(...split);
        }
        return out;
      };

      colCells = wrapAt(fontSize);
      for (let it = 0; it < 8; it++) {
        const totalW = colCells.length * fontSize * lh;
        if (totalW <= innerW) break;
        fontSize *= 0.92;
        if (fontSize < 8) {
          fontSize = 8;
          colCells = wrapAt(fontSize);
          break;
        }
        colCells = wrapAt(fontSize);
      }
    }
  } else {
    colCells = lineCells;
    const maxCells = colCells.reduce((m, cs) => Math.max(m, cs.length), 0);
    if (opts.size) {
      fontSize = opts.size;
    } else {
      fontSize = Math.max(
        8,
        Math.min(
          innerH / Math.max(1, maxCells),
          innerW / Math.max(1, colCells.length * lh),
        ),
      );
    }
  }
  const nCols = Math.max(1, colCells.length);

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

  for (let ci = 0; ci < colCells.length; ci++) {
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
