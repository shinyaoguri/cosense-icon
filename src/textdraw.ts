// 動的キーワード (today / week / month / year) の文字描画ドライバ。
//
// レンダラ側は「どこに、どの大きさで、どの色で 1 行置くか」だけを決め、
// 実際に <text> を出すのか Path 化したグリフを出すのかはこの抽象が引き受ける。
// システムフォントなら <text>、Google Fonts なら R2 のグリフパックから <use> を組む。
//
// レンダラは全て中央揃えでしか文字を置かないので、draw() は cx を中心に取る。
// 端揃えが要る呼び出しが出てきたら、そのとき anchor を足すこと。

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
