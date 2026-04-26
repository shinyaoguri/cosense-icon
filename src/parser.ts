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
  fg: "#222222",
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
