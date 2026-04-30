import type { ParsedPath } from "./parser";

export interface RegistryEnv {
  ICON_PATHS: R2Bucket;
  TURNSTILE_SECRET?: string;
}

// R2 キーと Cache API キーの prefix。
// レンダリング仕様 (svg.ts / dynamic.ts) を変えて「同じオプション集合でも見た目が変わる」
// 非互換変更を入れる場合は必ずここを bump (v1 → v2) する。
// bump すると:
//   - 旧キャッシュは未到達になり (新パスで lookup されるので)、自然に剥がれる
//   - R2 の旧オブジェクトは残るが、新しい R2 キーで再登録される
// テキスト・色・サイズなどのオプションは自動的にハッシュへ含まれるので、
// 単にオプションを追加するだけならここの bump は不要。
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
    `math=${parsed.math ? "1" : "0"}`,
    `vertical=${parsed.vertical ? "1" : "0"}`,
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

// SVG 全体を <a href="<editor-url>"> でラップ。
// 単独表示や <object>/<iframe> でクリックすると編集画面に飛ぶ。
// (<img> 経由埋め込みではブラウザ仕様上クリック無効)
export function withEditorLink(svg: string, editorUrl: string): string {
  // 既にラップ済みなら何もしない
  if (svg.includes("<a class=\"ic-edit\"")) return svg;
  const href = escapeXmlAttr(editorUrl);
  const aOpen =
    `<a class="ic-edit" href="${href}" target="_top" rel="noopener">` +
    `<title>クリックでエディタを開く</title>`;
  return svg
    .replace(/<svg([^>]*)>/, (_m, attrs) => `<svg${attrs}>${aOpen}`)
    .replace(/<\/svg>/, `</a></svg>`);
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
  const tip = escapeXmlAttr(tooltip);

  // CSS-in-SVG: chip はクリック対象ではなく視覚的な警告のみ。
  // クリックは外側 `withEditorLink` の <a> が担う。
  const style =
    `<style>` +
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
    const x = width - 8;
    const y = height - 8;
    marker =
      `<g class="ic-warn" transform="translate(${x} ${y})">` +
      `<rect x="-154" y="-32" width="154" height="32" rx="16" class="ic-warn-chip"/>` +
      `<circle cx="-131" cy="-16" r="11" class="ic-warn-mark-bg"/>` +
      `<text x="-131" y="-16" text-anchor="middle" class="ic-warn-mark">!</text>` +
      `<text x="-112" y="-16" class="ic-warn-text">エディタで再生成</text>` +
      `<title>${tip}</title>` +
      `</g>`;
  } else {
    const x = width - 18;
    const y = height - 18;
    marker =
      `<g class="ic-warn" transform="translate(${x} ${y})">` +
      `<rect x="-14" y="-14" width="28" height="28" rx="8" class="ic-warn-chip"/>` +
      `<text x="0" y="0" text-anchor="middle" class="ic-warn-mark-l">!</text>` +
      `<title>${tip}</title>` +
      `</g>`;
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
