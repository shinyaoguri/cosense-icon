import type { IconOptions } from "./parser";

function escapeXml(s: string): string {
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

export function renderSvg(lines: string[], opts: IconOptions): string {
  const { width, height, bg, fg, padding, radius, fontFamily, fontWeight, align } = opts;
  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  const lineHeight = opts.lineHeight;
  const fontSize = opts.fontSize ?? estimateFontSize(lines, innerW, innerH, lineHeight);

  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const textX =
    align === "left" ? padding : align === "right" ? width - padding : width / 2;

  const totalTextHeight = fontSize * lineHeight * lines.length;
  const startY = (height - totalTextHeight) / 2 + fontSize * lineHeight * 0.8;

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : fontSize * lineHeight;
      return `<tspan x="${textX}" dy="${dy}">${escapeXml(line)}</tspan>`;
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${bgShape}
<text x="${textX}" y="${startY}" fill="${escapeXml(fg)}" font-family="${escapeXml(fontFamily)}" font-weight="${escapeXml(fontWeight)}" font-size="${fontSize}" text-anchor="${anchor}"${letterSpacingAttr}>${tspans}</text>
</svg>`;
}
