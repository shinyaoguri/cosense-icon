// 動的キーワード (today / week / month / year) の文字描画ドライバ。
//
// レンダラ側は「どこに、どの大きさで、どの色で 1 行置くか」だけを決め、
// 実際に <text> を出すのか Path 化したグリフを出すのかはこの抽象が引き受ける。
// システムフォントなら <text>、Google Fonts なら R2 のグリフパックから <use> を組む。
//
// レンダラは全て中央揃えでしか文字を置かないので、draw() は cx を中心に取る。
// 端揃えが要る呼び出しが出てきたら、そのとき anchor を足すこと。

import type { OpenTypeFont, OpenTypeGlyph } from "./fonttypes";
import { escapeXml } from "./svg";

export interface DrawAttrs {
  /** 塗り色 (未エスケープの生値) */
  fill: string;
  fontSize: number;
  /** 未指定なら font-weight 属性を出さない (親から継承させる) */
  fontWeight?: string;
  /** 未指定なら opacity 属性を出さない */
  opacity?: number | string;
}

export interface TextDrawer {
  /** text を (cx, baselineY) に中央揃えで 1 行描く */
  draw(text: string, cx: number, baselineY: number, attrs: DrawAttrs): string;
  /** <defs> に入れる内容。<text> 描画では空文字。 */
  defs(): string;
}

/**
 * 閲覧側のシステムフォントに任せる従来の <text> ドライバ。
 * 属性は fill → font-family → font-weight → font-size → text-anchor → opacity の順で出す。
 */
export function systemTextDrawer(
  fontFamily: string,
  defaultWeight?: string,
): TextDrawer {
  const family = escapeXml(fontFamily);
  return {
    draw(text, cx, baselineY, attrs) {
      const weight = attrs.fontWeight ?? defaultWeight;
      const weightAttr =
        weight !== undefined ? ` font-weight="${escapeXml(weight)}"` : "";
      const opacityAttr =
        attrs.opacity !== undefined ? ` opacity="${attrs.opacity}"` : "";
      return (
        `<text x="${cx}" y="${baselineY}" fill="${escapeXml(attrs.fill)}"` +
        ` font-family="${family}"${weightAttr}` +
        ` font-size="${attrs.fontSize}" text-anchor="middle"${opacityAttr}>` +
        `${escapeXml(text)}</text>`
      );
    },
    defs() {
      return "";
    },
  };
}

/**
 * グリフパックから <use> を組むドライバ。閲覧側にフォントが無くても同じ見た目になる。
 *
 * <text> 版と違って text-anchor が使えないので、実グリフの advance を合計して
 * 自分で中央に寄せる。同じ字が繰り返し出るほど <defs> の共有が効く (カレンダーの数字など)。
 *
 * font-weight はパックに焼き込まれている (1 パック = 1 ウェイト) ため、
 * DrawAttrs.fontWeight は無視される。
 */
export function packTextDrawer(font: OpenTypeFont): TextDrawer {
  const upe = font.unitsPerEm ?? 1000;
  const defs: string[] = [];
  const seen = new Set<string>();

  // 同じ字を同じサイズで何度も描くので、(グリフ, サイズ) 単位で <defs> を共有する
  const register = (glyph: OpenTypeGlyph, fontSize: number): string => {
    const id = `p${glyph.index}s${String(fontSize).replace(/[^0-9]/g, "")}`;
    if (!seen.has(id)) {
      seen.add(id);
      const d = glyph.getPath(0, 0, fontSize).toPathData(1);
      defs.push(`<g id="${id}"><path d="${d}"/></g>`);
    }
    return id;
  };

  return {
    draw(text, cx, baselineY, attrs) {
      const glyphs = font.stringToGlyphs?.(text) ?? [];
      if (glyphs.length === 0) return "";
      const unit = attrs.fontSize / upe;

      let width = 0;
      for (let i = 0; i < glyphs.length; i++) {
        width += (glyphs[i]!.advanceWidth ?? upe) * unit;
        if (i > 0 && font.getKerningValue) {
          width += (font.getKerningValue(glyphs[i - 1]!, glyphs[i]!) ?? 0) * unit;
        }
      }

      let x = cx - width / 2;
      const uses: string[] = [];
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i]!;
        if (i > 0 && font.getKerningValue) {
          x += (font.getKerningValue(glyphs[i - 1]!, g) ?? 0) * unit;
        }
        const id = register(g, attrs.fontSize);
        uses.push(
          `<use href="#${id}" x="${x.toFixed(1)}" y="${baselineY.toFixed(1)}"/>`,
        );
        x += (g.advanceWidth ?? upe) * unit;
      }

      const opacityAttr =
        attrs.opacity !== undefined ? ` opacity="${attrs.opacity}"` : "";
      return `<g fill="${escapeXml(attrs.fill)}"${opacityAttr}>${uses.join("")}</g>`;
    },
    defs() {
      return defs.join("");
    },
  };
}
