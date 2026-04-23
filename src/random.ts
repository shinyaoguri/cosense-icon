function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

type Rgb = [number, number, number];

function hslToRgb(h: number, s: number, l: number): Rgb {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex(rgb: Rgb): string {
  return "#" + rgb.map((x) => x.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function deterministicPalette(seedText: string): { bg: string; fg: string } {
  const rng = mulberry32(fnv1a(seedText));
  const rand = (min: number, max: number): number => rng() * (max - min) + min;

  for (let i = 0; i < 80; i++) {
    const bgH = rand(0, 360);
    const bgS = rand(0.35, 0.9);
    const bgL = rand(0.12, 0.92);
    const bgRgb = hslToRgb(bgH, bgS, bgL);

    const dark = bgL >= 0.5;
    const fgH = (bgH + rand(-40, 40) + 360) % 360;
    const fgS = rand(0.05, dark ? 0.6 : 0.55);
    const fgL = dark ? rand(0.04, 0.2) : rand(0.88, 1.0);
    const fgRgb = hslToRgb(fgH, fgS, fgL);

    if (contrastRatio(bgRgb, fgRgb) >= 4.5) {
      return { bg: toHex(bgRgb), fg: toHex(fgRgb) };
    }
  }

  const bgH = rand(0, 360);
  const bgS = rand(0.45, 0.85);
  const bgL = rand(0.2, 0.8);
  const bgRgb = hslToRgb(bgH, bgS, bgL);
  const fg = relativeLuminance(bgRgb) > 0.4 ? "#151515" : "#fafafa";
  return { bg: toHex(bgRgb), fg };
}

export { hexToRgb };
