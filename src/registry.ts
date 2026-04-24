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
  const cx = Math.max(8, width - 10);
  const cy = Math.max(8, height - 10);
  const marker =
    `<g opacity="0.55" transform="translate(${cx} ${cy})">` +
    `<circle r="5" fill="#f59e0b"/>` +
    `<text x="0" y="2" font-size="8" fill="#ffffff" text-anchor="middle" font-family="sans-serif" font-weight="700">!</text>` +
    `<title>path未生成 - エディタで再生成してください: ${escapeXmlAttr(regenUrl)}</title>` +
    `</g>`;
  const comment =
    `<!-- cosense-icon: fallback rendering -->\n` +
    `<!-- regenerate at: ${escapeXmlAttr(regenUrl)} -->\n`;
  const withComment = svg.replace(
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    `<?xml version="1.0" encoding="UTF-8"?>\n${comment}`,
  );
  return withComment.replace("</svg>", `${marker}\n</svg>`);
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
