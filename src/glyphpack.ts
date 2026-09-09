// グリフパック: フォントを「必要な文字ぶんのグリフ集合」に切り出した小さな JSON。
//
// countdown / countup や動的キーワードは **文字列が毎日変わっても文字集合は変わらない**。
// 完成した SVG を R2 に置く既存の仕組みはこの性質を使えないが、グリフ単位まで
// キャッシュを下げれば、エディタが 1 度登録するだけで Worker が毎回その場で組める。
//
// createPackFont() が返すオブジェクトは src/fonttypes.ts の OpenTypeFont を満たすので、
// src/pathrender.ts の組版コードはブラウザの opentype.js と区別せずに扱える。

import type {
  OpenTypeFont,
  OpenTypeGlyph,
  OpenTypePath,
} from "./fonttypes";

export const PACK_VERSION = 1;

/**
 * 縦書きの字形置換先グリフに付けるキーの接頭辞。
 * 本文の shaping からは除外されるので、本文に絶対現れない NUL を使う。
 */
export const VERT_KEY_PREFIX = "\u0000vert";

export interface PackGlyph {
  /** 合成グリフ index。vert 置換の参照先として使う */
  i: number;
  /** advance width (font units) */
  adv: number;
  /** 基準サイズ = unitsPerEm で path 化した d 属性 (= 生の font units) */
  d: string;
}

export interface GlyphPack {
  v: number;
  upe: number;
  asc: number;
  desc: number;
  /**
   * 描画単位 → グリフ。キーは通常 1 文字だが、GSUB の liga がかかる並びだけ
   * 複数文字になる (shaping は登録時にブラウザ側で済ませてある)。
   */
  glyphs: Record<string, PackGlyph>;
  /** 縦書きの字形置換 (グリフ index → グリフ index)。字形が変わるものだけ */
  vert?: Record<string, number>;
  /** 非ゼロのカーニングペアのみ。キーは左右の描画単位を連結したもの */
  kern?: Record<string, number>;
}

// opentype.js の Path.toPathData が出すのは絶対座標の M / L / Q / C / Z だけ。
// 登録時に検証済みなので、コマンドの種類は素朴に読んでよい。
const PATH_CMD = /([MLQCZ])([^MLQCZ]*)/g;

// 数値は空白では区切れない。opentype は負数の前の区切りを省くので
// "Q79-37 79-97" のように 1 トークンに見える並びが出る (実際は 79, -37, 79, -97)。
const PATH_NUM = /[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g;

/**
 * font units の path を fontSize へ拡大し、(dx, dy) へ平行移動する。
 * 基準サイズが unitsPerEm なので、変換は一様拡大 + 平行移動だけで済む。
 */
export function scaleGlyphPath(
  d: string,
  scale: number,
  dx: number,
  dy: number,
): string {
  if (!d) return "";
  let out = "";
  PATH_CMD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PATH_CMD.exec(d)) !== null) {
    const cmd = m[1]!;
    out += cmd;
    if (cmd === "Z") continue;
    const vals = m[2]!.match(PATH_NUM);
    if (!vals) continue;
    const parts: string[] = [];
    // M / L / Q / C はすべて (x, y) の並びなので 2 個ずつ変換すればよい
    for (let i = 0; i + 1 < vals.length; i += 2) {
      const x = Number(vals[i]) * scale + dx;
      const y = Number(vals[i + 1]) * scale + dy;
      parts.push(`${round1(x)} ${round1(y)}`);
    }
    out += parts.join(" ");
  }
  return out;
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
}

interface PackGlyphObj extends OpenTypeGlyph {
  /** このグリフに対応する描画単位 (カーニング検索に使う) */
  key: string;
}

/** GlyphPack を組版が扱える OpenTypeFont として見せる */
export function createPackFont(pack: GlyphPack): OpenTypeFont {
  const upe = pack.upe;
  const byIndex = new Map<number, PackGlyphObj>();
  const byKey = new Map<string, PackGlyphObj>();

  const makeGlyph = (key: string, g: PackGlyph): PackGlyphObj => ({
    key,
    index: g.i,
    advanceWidth: g.adv,
    getPath(x: number, y: number, fontSize: number): OpenTypePath {
      const d = scaleGlyphPath(g.d, fontSize / upe, x, y);
      return {
        toPathData: () => d,
        toSVG: () => `<path d="${d}"/>`,
      };
    },
  });

  for (const [key, g] of Object.entries(pack.glyphs)) {
    const obj = makeGlyph(key, g);
    byKey.set(key, obj);
    byIndex.set(g.i, obj);
  }

  // 複数文字キー (liga クラスタ) を長い順に見て最長一致させる。
  // vert 置換先は index からしか引かれないので shaping の対象に入れない。
  const multiKeys = [...byKey.keys()]
    .filter(k => !k.startsWith(VERT_KEY_PREFIX) && Array.from(k).length > 1)
    .sort((a, b) => b.length - a.length);

  // 未登録の文字は空グリフ。パックのキーは実際に描く文字集合から作るので
  // 通常ここには落ちないが、落ちたときに豆腐ではなく空白になるようにする。
  const blank: PackGlyphObj = {
    key: "",
    index: -1,
    advanceWidth: 0,
    getPath: () => ({ toPathData: () => "", toSVG: () => "" }),
  };

  const charToGlyph = (ch: string): PackGlyphObj => byKey.get(ch) ?? blank;

  const stringToGlyphs = (text: string): PackGlyphObj[] => {
    const out: PackGlyphObj[] = [];
    let rest = text;
    outer: while (rest.length > 0) {
      for (const k of multiKeys) {
        if (rest.startsWith(k)) {
          out.push(byKey.get(k)!);
          rest = rest.slice(k.length);
          continue outer;
        }
      }
      const chars = Array.from(rest);
      const ch = chars[0]!;
      out.push(charToGlyph(ch));
      rest = rest.slice(ch.length);
    }
    return out;
  };

  const kern = pack.kern ?? {};
  const getKerningValue = (l: OpenTypeGlyph, r: OpenTypeGlyph): number =>
    kern[(l as PackGlyphObj).key + (r as PackGlyphObj).key] ?? 0;

  const vertPairs = Object.entries(pack.vert ?? {}).map(([sub, by]) => ({
    sub: Number(sub),
    by,
  }));

  return {
    unitsPerEm: upe,
    ascender: pack.asc,
    descender: pack.desc,
    charToGlyph,
    stringToGlyphs,
    getKerningValue,
    glyphs: { get: (i: number) => byIndex.get(i) ?? blank },
    substitution: {
      getSingle: (feature: string) => (feature === "vert" ? vertPairs : []),
    },
    getAdvanceWidth(text: string, fontSize: number): number {
      const glyphs = stringToGlyphs(text);
      let units = 0;
      for (let i = 0; i < glyphs.length; i++) {
        units += glyphs[i]!.advanceWidth ?? 0;
        if (i > 0) units += getKerningValue(glyphs[i - 1]!, glyphs[i]!);
      }
      return (units * fontSize) / upe;
    },
    // pathrender は glyph 単位でしか描かないので、font 全体の getPath は使わない
    getPath(text: string, x: number, y: number, fontSize: number): OpenTypePath {
      const unit = fontSize / upe;
      let cursor = x;
      let d = "";
      const glyphs = stringToGlyphs(text);
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i]!;
        if (i > 0) cursor += getKerningValue(glyphs[i - 1]!, g) * unit;
        d += g.getPath(cursor, y, fontSize).toPathData();
        cursor += (g.advanceWidth ?? 0) * unit;
      }
      return { toPathData: () => d, toSVG: () => `<path d="${d}"/>` };
    },
  };
}

// ---- 検証 ----------------------------------------------------------------

// パックは Turnstile 越しとはいえ外から届く。d はそのまま SVG の属性値に入るので、
// 「絶対座標の M / L / Q / C / Z と数値だけ」に限る。これが sanitizeSvg に相当する防御。
const SAFE_PATH_DATA = /^[MLQCZ0-9eE.,+\- ]*$/;

export const MAX_PACK_GLYPHS = 512;
const MAX_PATH_LENGTH = 65_536;

export class PackValidationError extends Error {}

/** 外から届いた JSON を GlyphPack として検証する。壊れていれば投げる。 */
export function validatePack(input: unknown): GlyphPack {
  const p = input as Partial<GlyphPack> | null;
  const fail = (msg: string): never => {
    throw new PackValidationError(msg);
  };

  if (!p || typeof p !== "object") return fail("pack is not an object");
  if (p.v !== PACK_VERSION) return fail(`unsupported pack version: ${p.v}`);
  for (const k of ["upe", "asc", "desc"] as const) {
    const v = p[k];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return fail(`${k} must be a finite number`);
    }
  }
  if (!p.upe || p.upe <= 0) return fail("upe must be positive");
  if (!p.glyphs || typeof p.glyphs !== "object") return fail("glyphs missing");

  const entries = Object.entries(p.glyphs);
  if (entries.length === 0) return fail("glyphs is empty");
  if (entries.length > MAX_PACK_GLYPHS) {
    return fail(`too many glyphs: ${entries.length} > ${MAX_PACK_GLYPHS}`);
  }

  const glyphs: Record<string, PackGlyph> = {};
  for (const [key, raw] of entries) {
    const g = raw as Partial<PackGlyph> | null;
    if (!key) return fail("empty glyph key");
    if (!g || typeof g !== "object") return fail(`glyph ${key} is not an object`);
    if (typeof g.i !== "number" || !Number.isInteger(g.i)) {
      return fail(`glyph ${key}: i must be an integer`);
    }
    if (typeof g.adv !== "number" || !Number.isFinite(g.adv)) {
      return fail(`glyph ${key}: adv must be a finite number`);
    }
    if (typeof g.d !== "string") return fail(`glyph ${key}: d must be a string`);
    if (g.d.length > MAX_PATH_LENGTH) return fail(`glyph ${key}: d too long`);
    if (!SAFE_PATH_DATA.test(g.d)) {
      return fail(`glyph ${key}: d contains unexpected characters`);
    }
    glyphs[key] = { i: g.i, adv: g.adv, d: g.d };
  }

  const vert: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.vert ?? {})) {
    if (!Number.isInteger(Number(k)) || typeof v !== "number") {
      return fail("vert must map integer to integer");
    }
    vert[k] = v;
  }

  const kern: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.kern ?? {})) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      return fail(`kern ${k} must be a finite number`);
    }
    kern[k] = v;
  }

  return {
    v: PACK_VERSION,
    upe: p.upe,
    asc: p.asc as number,
    desc: p.desc as number,
    glyphs,
    ...(Object.keys(vert).length > 0 ? { vert } : {}),
    ...(Object.keys(kern).length > 0 ? { kern } : {}),
  };
}
