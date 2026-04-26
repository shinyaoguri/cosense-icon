export type IconOptions = {
  bg: string;
  fg: string;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily: string;
  fontWeight: string;
  padding: number;
  radius: number;
  lineHeight: number;
  letterSpacing?: number;
  align: "left" | "center" | "right" | "justify";
  rotate: 0 | 90 | 180 | 270;
  shadow?: string; // 例: "4-rgba(0,0,0,.4)" → blur4 + 色 (簡略)
  shadowBlur: number;
  shadowColor?: string;
  stroke?: string; // 文字色とは別の縁取り色
  strokeWidth: number;
  gradTo?: string; // 設定されていればグラデ背景 (bg → gradTo)
  gradAngle: number; // 角度 (deg)。デフォ 135
  timezone?: string;
};

export type ParsedPath = {
  text: string[];
  options: IconOptions;
  random: boolean;
  explicit: Set<keyof IconOptions>;
  rawFontValue?: string;
};

const KEY_ALIASES: Record<string, keyof IconOptions> = {
  bg: "bg",
  background: "bg",
  "background-color": "bg",
  "背景": "bg",
  fg: "fg",
  color: "fg",
  text: "fg",
  "foreground": "fg",
  "文字色": "fg",
  w: "width",
  width: "width",
  "幅": "width",
  h: "height",
  height: "height",
  "高さ": "height",
  size: "fontSize",
  fontsize: "fontSize",
  "font-size": "fontSize",
  "文字サイズ": "fontSize",
  font: "fontFamily",
  "font-family": "fontFamily",
  family: "fontFamily",
  weight: "fontWeight",
  "font-weight": "fontWeight",
  bold: "fontWeight",
  padding: "padding",
  p: "padding",
  radius: "radius",
  r: "radius",
  "rounded": "radius",
  "border-radius": "radius",
  lh: "lineHeight",
  "line-height": "lineHeight",
  lineheight: "lineHeight",
  ls: "letterSpacing",
  "letter-spacing": "letterSpacing",
  spacing: "letterSpacing",
  align: "align",
  "text-align": "align",
  rotate: "rotate",
  rot: "rotate",
  "回転": "rotate",
  shadow: "shadow",
  "影": "shadow",
  "shadow-blur": "shadowBlur",
  "blur": "shadowBlur",
  "shadow-color": "shadowColor",
  stroke: "stroke",
  "縁": "stroke",
  outline: "stroke",
  "stroke-w": "strokeWidth",
  "stroke-width": "strokeWidth",
  "grad": "gradTo",
  "grad-to": "gradTo",
  "to": "gradTo",
  "grad-angle": "gradAngle",
  "angle": "gradAngle",
  tz: "timezone",
  timezone: "timezone",
  "タイムゾーン": "timezone",
};

const FONT_STACKS: Record<string, string> = {
  sans: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', Meiryo, sans-serif",
  serif: "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, 'Noto Serif JP', 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  rounded: "'Hiragino Maru Gothic ProN', 'Hiragino Maru Gothic Pro', 'M PLUS Rounded 1c', sans-serif",
  gothic: "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', Meiryo, sans-serif",
  mincho: "'Hiragino Mincho ProN', 'Yu Mincho', YuMincho, 'Noto Serif JP', 'Times New Roman', serif",
};

export function expandFontFamily(v: string): string {
  const key = v.trim().toLowerCase();
  return FONT_STACKS[key] ?? v;
}

export function isGoogleFontCandidate(raw: string | undefined): boolean {
  if (!raw) return false;
  return !(raw.trim().toLowerCase() in FONT_STACKS);
}

const TZ_SHORTCUTS: Record<string, string> = {
  jst: "Asia/Tokyo",
  utc: "UTC",
  est: "America/New_York",
  edt: "America/New_York",
  et: "America/New_York",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",
  pt: "America/Los_Angeles",
  cst: "America/Chicago",
  ct: "America/Chicago",
  mst: "America/Denver",
  mt: "America/Denver",
  cet: "Europe/Paris",
  cest: "Europe/Paris",
  gmt: "Europe/London",
  bst: "Europe/London",
  ist: "Asia/Kolkata",
  kst: "Asia/Seoul",
};

const DEFAULTS: IconOptions = {
  bg: "#ffffff",
  fg: "#000000",
  width: 600,
  height: 400,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', Meiryo, sans-serif",
  fontWeight: "700",
  padding: 24,
  radius: 0,
  lineHeight: 1.2,
  align: "center",
  rotate: 0,
  shadowBlur: 4,
  strokeWidth: 0,
  gradAngle: 135,
};

const KV_SEPARATORS = /[-=:]/;

function splitFirst(s: string, re: RegExp): [string, string] | null {
  const m = re.exec(s);
  if (!m) return null;
  return [s.slice(0, m.index), s.slice(m.index + m[0].length)];
}

function parseColor(v: string): string | null {
  const raw = v.trim();
  if (!raw) return null;
  if (raw === "transparent" || raw === "none") return raw;
  if (/^#?[0-9a-fA-F]{3}$/.test(raw) || /^#?[0-9a-fA-F]{4}$/.test(raw)) {
    return raw.startsWith("#") ? raw : `#${raw}`;
  }
  if (/^#?[0-9a-fA-F]{6}$/.test(raw) || /^#?[0-9a-fA-F]{8}$/.test(raw)) {
    return raw.startsWith("#") ? raw : `#${raw}`;
  }
  if (/^[a-zA-Z]+$/.test(raw)) return raw.toLowerCase();
  if (/^rgba?\([\d\s.,%]+\)$/.test(raw)) return raw;
  if (/^hsla?\([\d\s.,%]+\)$/.test(raw)) return raw;
  return null;
}

function parseNumber(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseAlign(v: string): IconOptions["align"] | null {
  const t = v.toLowerCase();
  if (t === "left" || t === "center" || t === "right" || t === "justify") return t;
  return null;
}

function applyOption(
  opts: IconOptions,
  explicit: Set<keyof IconOptions>,
  state: { rawFontValue?: string },
  rawKey: string,
  rawValue: string,
): void {
  const key = KEY_ALIASES[rawKey.toLowerCase()];
  if (!key) return;
  switch (key) {
    case "bg":
    case "fg": {
      const c = parseColor(rawValue);
      if (c) {
        opts[key] = c;
        explicit.add(key);
      }
      return;
    }
    case "width":
    case "height":
    case "padding":
    case "radius": {
      const n = parseNumber(rawValue);
      if (n !== null) {
        opts[key] = n;
        explicit.add(key);
      }
      return;
    }
    case "fontSize":
    case "letterSpacing": {
      const n = parseNumber(rawValue);
      if (n !== null) {
        opts[key] = n;
        explicit.add(key);
      }
      return;
    }
    case "lineHeight": {
      const n = Number(rawValue);
      if (Number.isFinite(n) && n > 0) {
        opts.lineHeight = n;
        explicit.add("lineHeight");
      }
      return;
    }
    case "fontFamily": {
      opts.fontFamily = expandFontFamily(rawValue);
      explicit.add("fontFamily");
      state.rawFontValue = rawValue.trim();
      return;
    }
    case "fontWeight": {
      opts.fontWeight = rawValue;
      explicit.add("fontWeight");
      return;
    }
    case "timezone": {
      const v = rawValue.trim();
      if (!v) return;
      opts.timezone = TZ_SHORTCUTS[v.toLowerCase()] ?? v;
      explicit.add("timezone");
      return;
    }
    case "align": {
      const a = parseAlign(rawValue);
      if (a) {
        opts.align = a;
        explicit.add("align");
      }
      return;
    }
    case "rotate": {
      const n = ((Number(rawValue) % 360) + 360) % 360;
      if (n === 0 || n === 90 || n === 180 || n === 270) {
        opts.rotate = n as 0 | 90 | 180 | 270;
        explicit.add("rotate");
      }
      return;
    }
    case "shadow": {
      const v = rawValue.trim().toLowerCase();
      // "off"/"none" は無効化
      if (!v || v === "off" || v === "none" || v === "0") return;
      // 値 = ON フラグ。色は shadow-color で別指定可。値自体を色とみなす場合も許可
      if (v === "on" || v === "1" || v === "true") {
        opts.shadow = "on";
      } else {
        const c = parseColor(rawValue);
        if (c) {
          opts.shadow = "on";
          opts.shadowColor = c;
        }
      }
      explicit.add("shadow");
      return;
    }
    case "shadowBlur": {
      const n = Number(rawValue);
      if (Number.isFinite(n) && n >= 0) {
        opts.shadowBlur = n;
        explicit.add("shadowBlur");
      }
      return;
    }
    case "shadowColor": {
      const c = parseColor(rawValue);
      if (c) {
        opts.shadowColor = c;
        explicit.add("shadowColor");
      }
      return;
    }
    case "stroke": {
      const v = rawValue.trim().toLowerCase();
      if (!v || v === "off" || v === "none" || v === "0") return;
      const c = parseColor(rawValue);
      if (c) {
        opts.stroke = c;
        explicit.add("stroke");
      }
      return;
    }
    case "strokeWidth": {
      const n = Number(rawValue);
      if (Number.isFinite(n) && n >= 0) {
        opts.strokeWidth = n;
        explicit.add("strokeWidth");
      }
      return;
    }
    case "gradTo": {
      const c = parseColor(rawValue);
      if (c) {
        opts.gradTo = c;
        explicit.add("gradTo");
      }
      return;
    }
    case "gradAngle": {
      const n = Number(rawValue);
      if (Number.isFinite(n)) {
        opts.gradAngle = ((n % 360) + 360) % 360;
        explicit.add("gradAngle");
      }
      return;
    }
  }
}

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseText(raw: string): string[] {
  // \n 文字列を改行として扱う
  const normalized = raw.replace(/\\n/g, "\n");
  return normalized.split(/\n/);
}

export function parsePath(pathname: string): ParsedPath | null {
  const trimmed = pathname.replace(/^\/+/, "");
  if (!trimmed) return null;
  const segments = trimmed.split("/").map(decode).filter((s) => s.length > 0);
  if (segments.length === 0) return null;

  const last = segments[segments.length - 1]!;
  const textRaw = last.replace(/\.svg$/i, "");
  if (!textRaw) return null;

  const optionSegments = segments.slice(0, -1);
  const opts: IconOptions = { ...DEFAULTS };
  const explicit = new Set<keyof IconOptions>();
  const state: { rawFontValue?: string } = {};
  let random = false;

  for (const seg of optionSegments) {
    if (seg.toLowerCase() === "random") {
      random = true;
      continue;
    }
    for (const token of seg.split(",")) {
      const pair = splitFirst(token, KV_SEPARATORS);
      if (!pair) continue;
      const [k, v] = pair;
      if (!k || v === undefined) continue;
      applyOption(opts, explicit, state, k, v);
    }
  }

  return {
    text: parseText(textRaw),
    options: opts,
    random,
    explicit,
    rawFontValue: state.rawFontValue,
  };
}
