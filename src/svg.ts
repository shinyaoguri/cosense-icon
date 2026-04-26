import type { IconOptions } from "./parser";

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function estimateFontSize(
  lines: string[],
  innerW: number,
  innerH: number,
  lineHeight: number,
): number {
  if (lines.length === 0) return 16;
  // 日本語文字はほぼ正方形、ラテン文字は約半分の幅と見積もる
  const longest = lines.reduce((max, line) => {
    let width = 0;
    for (const ch of line) {
      width += /[\x00-\x7F]/.test(ch) ? 0.55 : 1.0;
    }
    return Math.max(max, width);
  }, 0);
  const maxByWidth = longest > 0 ? innerW / longest : innerH;
  const maxByHeight = innerH / (lines.length * lineHeight);
  return Math.max(8, Math.min(maxByWidth, maxByHeight));
}

// 回転後の外殻寸法と内部 g に当てる transform を計算
export function rotationWrap(
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

export function renderSvg(lines: string[], opts: IconOptions): string {
  const { width, height, bg, fg, padding, radius, fontFamily, fontWeight, align } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const lineHeight = opts.lineHeight;
  const fontSize = opts.fontSize ?? estimateFontSize(lines, innerW, innerH, lineHeight);

  const isJustify = align === "justify";
  const anchor =
    align === "left" || isJustify
      ? "start"
      : align === "right"
      ? "end"
      : "middle";
  const textX =
    align === "left" || isJustify
      ? padding
      : align === "right"
      ? width - padding
      : width / 2;

  const totalTextHeight = fontSize * lineHeight * lines.length;
  const startY = (height - totalTextHeight) / 2 + fontSize * lineHeight * 0.8;

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : fontSize * lineHeight;
      // 両端揃え: 2文字以上ある行のみ innerW いっぱいに spacing 引き伸ばし
      const justifyAttr =
        isJustify && line.length > 1
          ? ` textLength="${innerW}" lengthAdjust="spacing"`
          : "";
      return `<tspan x="${textX}" dy="${dy}"${justifyAttr}>${escapeXml(line)}</tspan>`;
    })
    .join("");

  const letterSpacingAttr =
    opts.letterSpacing !== undefined
      ? ` letter-spacing="${opts.letterSpacing}"`
      : "";

  // 背景: gradient or 単色
  const useGrad = !!opts.gradTo;
  let gradDef = "";
  let bgFillVal = bg;
  if (useGrad) {
    const angle = (opts.gradAngle * Math.PI) / 180;
    // 0deg = 上→下, 90deg = 左→右 のような定義 (CSS と合わせる)
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const x1 = (0.5 - dx / 2) * 100;
    const y1 = (0.5 - dy / 2) * 100;
    const x2 = (0.5 + dx / 2) * 100;
    const y2 = (0.5 + dy / 2) * 100;
    gradDef = `<linearGradient id="bgGrad" x1="${x1.toFixed(2)}%" y1="${y1.toFixed(2)}%" x2="${x2.toFixed(2)}%" y2="${y2.toFixed(2)}%"><stop offset="0%" stop-color="${escapeXml(bg)}"/><stop offset="100%" stop-color="${escapeXml(opts.gradTo!)}"/></linearGradient>`;
    bgFillVal = "url(#bgGrad)";
  }
  const bgShape =
    radius > 0
      ? `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${useGrad ? bgFillVal : escapeXml(bg)}"/>`
      : `<rect width="${width}" height="${height}" fill="${useGrad ? bgFillVal : escapeXml(bg)}"/>`;

  // 影フィルタ
  const useShadow = opts.shadow === "on";
  const shadowColor = opts.shadowColor ?? "rgba(0,0,0,0.45)";
  const shadowBlur = opts.shadowBlur;
  const defParts: string[] = [];
  if (useShadow) {
    defParts.push(
      `<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${Math.max(1, shadowBlur / 2)}" stdDeviation="${shadowBlur}" flood-color="${escapeXml(shadowColor)}"/></filter>`,
    );
  }
  if (gradDef) defParts.push(gradDef);
  const filterDef = defParts.length > 0 ? `<defs>${defParts.join("")}</defs>` : "";
  const filterAttr = useShadow ? ` filter="url(#ds)"` : "";

  // ストローク (paint-order=stroke でテキストの外側に縁取り)
  const strokeAttrs =
    opts.stroke && opts.strokeWidth > 0
      ? ` stroke="${escapeXml(opts.stroke)}" stroke-width="${opts.strokeWidth}" stroke-linejoin="round" paint-order="stroke fill"`
      : "";

  const inner = `${filterDef}${bgShape}
<text x="${textX}" y="${startY}" fill="${escapeXml(fg)}" font-family="${escapeXml(fontFamily)}" font-weight="${escapeXml(fontWeight)}" font-size="${fontSize}" text-anchor="${anchor}"${letterSpacingAttr}${strokeAttrs}${filterAttr}>${tspans}</text>`;
  const { outerW, outerH, transform } = rotationWrap(width, height, opts.rotate ?? 0);
  const body = transform ? `<g transform="${transform}">\n${inner}\n</g>` : inner;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}">
${body}
</svg>`;
}
