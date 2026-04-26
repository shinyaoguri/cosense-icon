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

  const bgShape =
    radius > 0
      ? `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${escapeXml(bg)}"/>`
      : `<rect width="${width}" height="${height}" fill="${escapeXml(bg)}"/>`;

  const inner = `${bgShape}
<text x="${textX}" y="${startY}" fill="${escapeXml(fg)}" font-family="${escapeXml(fontFamily)}" font-weight="${escapeXml(fontWeight)}" font-size="${fontSize}" text-anchor="${anchor}"${letterSpacingAttr}>${tspans}</text>`;
  const { outerW, outerH, transform } = rotationWrap(width, height, opts.rotate ?? 0);
  const body = transform ? `<g transform="${transform}">\n${inner}\n</g>` : inner;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}">
${body}
</svg>`;
}
