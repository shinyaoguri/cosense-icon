// opentype.js が parse したフォントから、指定した文字集合ぶんのグリフパックを組む
// (ブラウザ専用。Worker 側は src/glyphpack.ts の createPackFont で読むだけ)。

import {
  PACK_VERSION,
  VERT_KEY_PREFIX,
  type GlyphPack,
  type PackGlyph,
} from "../glyphpack";
import type { OpenTypeFont, OpenTypeGlyph } from "../fonttypes";
import { ensureFont } from "./pathify";

/**
 * charset の各文字 (と、その並びに liga がかかる場合はそのクラスタ) を
 * パックへ書き出す。
 *
 * path は基準サイズ = unitsPerEm で出す。opentype 自身の出力なので y 反転や
 * ベースライン処理を Worker 側で再実装せずに済み、任意のサイズへは
 * 一様拡大 + 平行移動だけで正確に落とせる。
 */
export function buildPack(font: OpenTypeFont, charset: string): GlyphPack {
  const upe = font.unitsPerEm ?? 1000;
  const glyphs: Record<string, PackGlyph> = {};
  const indexOfKey = new Map<number, string>();

  const put = (key: string, glyph: OpenTypeGlyph): void => {
    if (glyphs[key]) return;
    glyphs[key] = {
      i: glyph.index,
      adv: glyph.advanceWidth ?? upe,
      // 基準サイズ = upe なので、座標はフォント本来の整数 units になる
      d: glyph.getPath(0, 0, upe).toPathData(0),
    };
    indexOfKey.set(glyph.index, key);
  };

  const chars = Array.from(charset);
  for (const ch of chars) {
    const g = font.charToGlyph?.(ch);
    if (g) put(ch, g);
  }

  // liga 等で 2 文字が 1 グリフに合成される並びを拾う。charset は小さいので総当たりでよい。
  for (const a of chars) {
    for (const b of chars) {
      const pair = a + b;
      const shaped = font.stringToGlyphs?.(pair);
      if (shaped && shaped.length === 1 && shaped[0]) put(pair, shaped[0]);
    }
  }

  // ここまでのキーは実際に描く文字 (と liga クラスタ)。カーニングはこれだけを見る。
  const textKeys = Object.keys(glyphs);

  // 縦書きの字形置換。charset に含まれるグリフが差し替わるものだけ持てばよい。
  // 置換先は index でしか参照されないので、キーは本文に絶対現れない VERT_KEY_PREFIX
  // 始まりにする (createPackFont の最長一致 shaping から除外される)。
  const vert: Record<string, number> = {};
  const subs = font.substitution?.getSingle("vert") ?? [];
  for (const s of subs) {
    if (!indexOfKey.has(s.sub)) continue;
    const alt = font.glyphs?.get(s.by);
    if (!alt) continue;
    put(VERT_KEY_PREFIX + s.by, alt);
    vert[String(s.sub)] = s.by;
  }

  // 非ゼロのカーニングペアだけ。charset が小さいので全ペアを引いてよい。
  const kern: Record<string, number> = {};
  if (font.getKerningValue) {
    const glyphOf = new Map<string, OpenTypeGlyph>();
    for (const k of textKeys) {
      const g = font.stringToGlyphs?.(k)?.[0] ?? font.charToGlyph?.(k);
      if (g) glyphOf.set(k, g);
    }
    for (const [l, lg] of glyphOf) {
      for (const [r, rg] of glyphOf) {
        const v = font.getKerningValue(lg, rg) ?? 0;
        if (v !== 0) kern[l + r] = v;
      }
    }
  }

  return {
    v: PACK_VERSION,
    upe,
    asc: font.ascender ?? Math.round(upe * 0.88),
    desc: font.descender ?? -Math.round(upe * 0.12),
    glyphs,
    ...(Object.keys(vert).length > 0 ? { vert } : {}),
    ...(Object.keys(kern).length > 0 ? { kern } : {}),
  };
}

// 同じ (family, weight, charset) のパックを組み直さないための小さなキャッシュ。
// プレビューは入力のたびに走るうえ buildPack は文字集合の総当たりを含むので、ここが効く。
// フォント本体の取得は ensureFont 側でキャッシュされている。
const _packCache = new Map<string, GlyphPack>();
const PACK_CACHE_MAX = 8;

/**
 * その文字集合ぶんのグリフパックを用意する。
 *
 * プレビューと R2 登録の両方がここを通るので、登録ボタンを押した時点では
 * たいてい組み上がっており、残るのは Turnstile 認証と POST だけになる。
 */
export async function ensurePack(
  family: string,
  weight: string,
  charset: string,
): Promise<GlyphPack> {
  const key = [family, weight, charset].join("|");
  const hit = _packCache.get(key);
  if (hit) {
    _packCache.delete(key);
    _packCache.set(key, hit);
    return hit;
  }
  // charset を text として渡すことで、Google Fonts 側で必要な字だけに絞られる
  const font = await ensureFont(family, weight, charset);
  const pack = buildPack(font, charset);
  _packCache.set(key, pack);
  while (_packCache.size > PACK_CACHE_MAX) {
    const oldest = _packCache.keys().next().value;
    if (oldest === undefined) break;
    _packCache.delete(oldest);
  }
  return pack;
}
