// MathJax v3 を遅延ロードし、TeX → SVG path 化 + アイコンサイズに合わせて組み立て。
// pathify.ts と同じ役割を「数式」用に提供。
import { xmlEscape } from "./dom";
import type { IconOpts } from "./state";

declare global {
  interface Window {
    MathJax?: MathJaxAPI;
  }
}

interface MathJaxAPI {
  tex2svg: (tex: string, options?: { display?: boolean }) => HTMLElement;
  startup: {
    promise: Promise<void>;
    document: { reset: () => void; updateDocument: () => void };
    defaultReady: () => void;
    typeset: boolean;
    ready?: () => void;
  };
}

const MATHJAX_VERSION = "3.2.2";
const MATHJAX_CDN = `https://cdn.jsdelivr.net/npm/mathjax@${MATHJAX_VERSION}/es5/tex-svg.js`;

let _mathjaxPromise: Promise<void> | null = null;

export function ensureMathJax(): Promise<void> {
  if (_mathjaxPromise) return _mathjaxPromise;
  _mathjaxPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (action: () => void): void => {
      if (settled) return;
      settled = true;
      action();
    };
    // 設定を script ロード前に注入
    (window as unknown as { MathJax: unknown }).MathJax = {
      startup: {
        typeset: false,
        ready: (): void => {
          try {
            const mj = window.MathJax!;
            mj.startup.defaultReady();
            mj.startup.promise
              .then(() => settle(() => resolve()))
              .catch(e => settle(() => reject(e)));
          } catch (e) {
            settle(() => reject(e));
          }
        },
      },
      options: {
        enableAssistiveMml: false,
      },
    };
    const s = document.createElement("script");
    s.src = MATHJAX_CDN;
    s.async = true;
    s.onerror = (): void => {
      _mathjaxPromise = null;
      settle(() => reject(new Error("MathJax script の読み込みに失敗")));
    };
    // セーフティ: 30 秒以内に ready が呼ばれなければ失敗扱い
    const timer = setTimeout(() => {
      if (!settled) {
        _mathjaxPromise = null;
        settle(() => reject(new Error("MathJax 初期化タイムアウト (30s)")));
      }
    }, 30_000);
    // resolve/reject 後にタイマー解除するため Promise を保存
    Promise.resolve()
      .then(async () => {
        try {
          await _mathjaxPromise;
        } catch {
          /* 失敗時もタイマー解除 */
        } finally {
          clearTimeout(timer);
        }
      })
      .catch(() => {});
    document.head.appendChild(s);
  });
  return _mathjaxPromise;
}

// MathJax の defs id (`MJX-1-TEX-...`) はグローバルカウンタ採番。
// 描画前に reset() するとカウンタが 1 から始まり、同じ TeX に対して同じ出力になる。
export async function renderMathSvgEl(tex: string): Promise<SVGSVGElement> {
  await ensureMathJax();
  const mj = window.MathJax;
  if (!mj) throw new Error("MathJax 未初期化");
  mj.startup.document.reset();
  const wrapper = mj.tex2svg(tex, { display: true });
  // MathJax v3 は通常 <mjx-container><svg>...</svg></mjx-container> を返す。
  // バージョン/設定によっては <svg> を直接返すこともあるので両対応。
  let svg: SVGSVGElement | null = wrapper.querySelector("svg");
  if (!svg && wrapper.tagName.toLowerCase() === "svg") {
    svg = wrapper as unknown as SVGSVGElement;
  }
  if (!svg) {
    throw new Error(
      "MathJax SVG 抽出に失敗しました (wrapper: " + wrapper.outerHTML.slice(0, 80) + ")",
    );
  }
  return svg;
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

// 念のため defs の id を確定的な連番に正規化 (再現性をより堅く)
function normalizeIds(defsHtml: string, bodyHtml: string): { defs: string; body: string } {
  const idRe = /id="([^"]+)"/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(defsHtml)) !== null) {
    if (m[1] && !ids.includes(m[1])) ids.push(m[1]);
  }
  let defs = defsHtml;
  let body = bodyHtml;
  ids.forEach((oldId, i) => {
    const newId = `M${i}`;
    const escOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    defs = defs.replace(new RegExp(`id="${escOld}"`, "g"), `id="${newId}"`);
    const refRe = new RegExp(`(href|xlink:href)="#${escOld}"`, "g");
    defs = defs.replace(refRe, `$1="#${newId}"`);
    body = body.replace(refRe, `$1="#${newId}"`);
  });
  return { defs, body };
}

export async function buildSvgFromTex(
  tex: string,
  opts: IconOpts,
): Promise<string> {
  if (!tex.trim()) {
    // 空テキスト時は "?" をプレースホルダとして描画
    tex = "?";
  }
  const mathSvg = await renderMathSvgEl(tex);

  // viewBox: "minX minY width height" (空白かカンマ区切り)
  const viewBox = mathSvg.getAttribute("viewBox") ?? "0 0 100 100";
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter(n => Number.isFinite(n));
  const vx = parts[0] ?? 0;
  const vy = parts[1] ?? 0;
  const vw = Math.max(1, parts[2] ?? 100);
  const vh = Math.max(1, parts[3] ?? 100);

  const { width, height, padding, bg, fg, radius, align } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);

  // 比率維持で内側に最大スケール
  const scale = Math.min(innerW / vw, innerH / vh);
  const scaledW = vw * scale;
  const scaledH = vh * scale;

  // 揃え
  let tx: number;
  if (align === "left") tx = padding - vx * scale;
  else if (align === "right") tx = width - padding - scaledW - vx * scale;
  else tx = padding + (innerW - scaledW) / 2 - vx * scale; // center / justify
  const ty = padding + (innerH - scaledH) / 2 - vy * scale;

  // defs と他 (主に <g>) を分離
  let defsHtml = "";
  const bodyParts: string[] = [];
  for (const child of Array.from(mathSvg.children)) {
    if (child.tagName.toLowerCase() === "defs") {
      defsHtml += child.outerHTML;
    } else {
      bodyParts.push(child.outerHTML);
    }
  }
  let bodyHtml = bodyParts.join("");
  const norm = normalizeIds(defsHtml, bodyHtml);
  defsHtml = norm.defs;
  bodyHtml = norm.body;

  // 背景: gradient or 単色
  const useGrad = !!opts.gradTo;
  const defParts: string[] = [];
  let bgFillVal = xmlEscape(bg);
  if (useGrad) {
    const angle = ((opts.gradAngle ?? 135) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const x1 = (0.5 - dx / 2) * 100;
    const y1 = (0.5 - dy / 2) * 100;
    const x2 = (0.5 + dx / 2) * 100;
    const y2 = (0.5 + dy / 2) * 100;
    defParts.push(
      `<linearGradient id="bgGrad" x1="${x1.toFixed(2)}%" y1="${y1.toFixed(2)}%" x2="${x2.toFixed(2)}%" y2="${y2.toFixed(2)}%"><stop offset="0%" stop-color="${xmlEscape(bg)}"/><stop offset="100%" stop-color="${xmlEscape(opts.gradTo!)}"/></linearGradient>`,
    );
    bgFillVal = "url(#bgGrad)";
  }
  const useShadow = opts.shadow === "on";
  const shadowColor = opts.shadowColor ?? "rgba(0,0,0,0.45)";
  const shadowBlur = opts.shadowBlur ?? 4;
  if (useShadow) {
    defParts.push(
      `<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${Math.max(1, shadowBlur / 2)}" stdDeviation="${shadowBlur}" flood-color="${xmlEscape(shadowColor)}"/></filter>`,
    );
  }
  // MathJax の defs (path 定義) は最後に追記
  if (defsHtml) {
    // defs タグから中身を抽出して結合
    const mDefs = defsHtml.match(/<defs[^>]*>([\s\S]*?)<\/defs>/i);
    if (mDefs && mDefs[1]) defParts.push(mDefs[1]);
  }
  const allDefs =
    defParts.length > 0 ? `<defs>${defParts.join("")}</defs>` : "";

  const bgShape = radius > 0
    ? `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${bgFillVal}"/>`
    : `<rect width="${width}" height="${height}" fill="${bgFillVal}"/>`;

  // MathJax の <g> は fill="currentColor". CSS color で fg を流し込む。
  const filterAttr = useShadow ? ` filter="url(#ds)"` : "";
  const strokeAttrs =
    opts.stroke && (opts.strokeWidth ?? 0) > 0
      ? ` stroke="${xmlEscape(opts.stroke)}" stroke-width="${opts.strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"`
      : "";
  const mathLayer =
    `<g transform="translate(${tx} ${ty}) scale(${scale})" color="${xmlEscape(fg)}" fill="${xmlEscape(fg)}"${strokeAttrs}${filterAttr}>` +
    bodyHtml +
    `</g>`;

  const inner = `${allDefs}${bgShape}\n${mathLayer}`;
  const { outerW, outerH, transform } = rotationWrap(width, height, opts.rotate ?? 0);
  const body = transform ? `<g transform="${transform}">\n${inner}\n</g>` : inner;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}">
${body}
</svg>`;
}
