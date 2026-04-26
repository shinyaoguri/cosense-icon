import type { ParsedPath } from "./parser";

export interface RegistryEnv {
  ICON_PATHS: R2Bucket;
  TURNSTILE_SECRET?: string;
}

export const KEY_VERSION = "v1";

function normalizedKeyParts(parsed: ParsedPath): string {
  const o = parsed.options;
  return [
    `text=${parsed.text.join("\n")}`,
    `font=${parsed.rawFontValue ?? ""}`,
    `weight=${o.fontWeight}`,
    `bg=${o.bg}`,
    `fg=${o.fg}`,
    `w=${o.width}`,
    `h=${o.height}`,
    `size=${o.fontSize ?? "auto"}`,
    `padding=${o.padding}`,
    `radius=${o.radius}`,
    `lh=${o.lineHeight}`,
    `ls=${o.letterSpacing ?? 0}`,
    `align=${o.align}`,
    `rotate=${o.rotate ?? 0}`,
    `shadow=${o.shadow ?? ""}-${o.shadowColor ?? ""}-${o.shadowBlur ?? 0}`,
    `stroke=${o.stroke ?? ""}-${o.strokeWidth ?? 0}`,
    `grad=${o.gradTo ?? ""}-${o.gradAngle ?? 135}`,
  ].join("|");
}

export async function computeKey(parsed: ParsedPath): Promise<string> {
  const source = normalizedKeyParts(parsed);
  const buf = new TextEncoder().encode(source);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex.slice(0, 32);
}

export function r2Key(hash: string): string {
  return `${KEY_VERSION}/${hash}.svg`;
}

export function buildRegenUrl(pathname: string): string {
  const utf8 = new TextEncoder().encode(pathname);
  let bin = "";
  for (const b of utf8) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `/?regen=${b64}`;
}

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function withErrorMarker(
  svg: string,
  width: number,
  height: number,
  regenUrl: string,
): string {
  const tooltip =
    "Google Fonts の登録待ちのためフォールバック表示中です。" +
    "クリックでエディタを開き、再生成してください。";
  const href = escapeXmlAttr(regenUrl);
  const tip = escapeXmlAttr(tooltip);

  // CSS-in-SVG: ホバーで強調 + クリックカーソル
  const style =
    `<style>` +
    `.ic-warn{cursor:pointer;transition:filter 180ms ease}` +
    `.ic-warn:hover{filter:brightness(1.1) drop-shadow(0 0 6px rgba(245,158,11,0.55))}` +
    `.ic-warn-chip{fill:#f59e0b;stroke:#7c2d12;stroke-width:1.5}` +
    `.ic-warn-mark-bg{fill:#7c2d12}` +
    `.ic-warn-mark{fill:#fde68a;font-family:-apple-system,system-ui,sans-serif;font-weight:700;font-size:13px;dominant-baseline:central}` +
    `.ic-warn-mark-l{fill:#fde68a;font-family:-apple-system,system-ui,sans-serif;font-weight:900;font-size:17px;dominant-baseline:central}` +
    `.ic-warn-text{fill:#3a1605;font-family:-apple-system,system-ui,"Hiragino Sans","Noto Sans JP",sans-serif;font-weight:600;font-size:12px;dominant-baseline:central}` +
    `</style>`;

  // 横幅に応じてラベル付き chip / コンパクト button を切替
  const useChip = width >= 176 && height >= 56;
  let marker: string;
  if (useChip) {
    // chip 寸法: 154 × 32, 角丸 16
    // ┌── padL=12 ┬ circle r=11 ┬ gap=8 ┬ label ≤90 ┬ padR=22 ──┐
    const x = width - 8;
    const y = height - 8;
    marker =
      `<a class="ic-warn" href="${href}" target="_top" rel="noopener">` +
      `<g transform="translate(${x} ${y})">` +
      `<rect x="-154" y="-32" width="154" height="32" rx="16" class="ic-warn-chip"/>` +
      `<circle cx="-131" cy="-16" r="11" class="ic-warn-mark-bg"/>` +
      `<text x="-131" y="-16" text-anchor="middle" class="ic-warn-mark">!</text>` +
      `<text x="-112" y="-16" class="ic-warn-text">エディタで再生成</text>` +
      `<title>${tip}</title>` +
      `</g>` +
      `</a>`;
  } else {
    // 28 × 28 角丸ボタン (任意の小さい画像にも対応)
    const x = width - 18;
    const y = height - 18;
    marker =
      `<a class="ic-warn" href="${href}" target="_top" rel="noopener">` +
      `<g transform="translate(${x} ${y})">` +
      `<rect x="-14" y="-14" width="28" height="28" rx="8" class="ic-warn-chip"/>` +
      `<text x="0" y="0" text-anchor="middle" class="ic-warn-mark-l">!</text>` +
      `<title>${tip}</title>` +
      `</g>` +
      `</a>`;
  }

  const comment =
    `<!-- cosense-icon: fallback rendering -->\n` +
    `<!-- regenerate at: ${escapeXmlAttr(regenUrl)} -->\n`;
  const withComment = svg.replace(
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    `<?xml version="1.0" encoding="UTF-8"?>\n${comment}`,
  );
  return withComment.replace("</svg>", `${style}${marker}\n</svg>`);
}

const DANGEROUS_TAGS =
  /<\/?(?:script|foreignObject|iframe|object|embed|link|meta|style)\b[^>]*>/gi;
const EVENT_HANDLERS = /\son[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g;
const JS_URLS =
  /\s(?:href|xlink:href)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*')/gi;
const XML_PI = /<\?(?!xml\b)[^>]*\?>/g;

export function sanitizeSvg(svg: string): string {
  return svg
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(JS_URLS, "")
    .replace(XML_PI, "");
}

export async function verifyTurnstile(
  token: string,
  secret: string,
  ip?: string,
): Promise<boolean> {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
