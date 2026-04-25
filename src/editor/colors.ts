import { $, $input } from "./dom";

export type RGB = [number, number, number];

const rand = (min: number, max: number): number => Math.random() * (max - min) + min;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export function hslToRgb(hDeg: number, s: number, l: number): RGB {
  const h = ((hDeg % 360) + 360) % 360;
  const sc = clamp01(s);
  const lc = clamp01(l);
  const c = (1 - Math.abs(2 * lc - 1)) * sc;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lc - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export const toHex = (rgb: RGB): string =>
  "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

export function relativeLuminance([r, g, b]: RGB): number {
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(rgb1: RGB, rgb2: RGB): number {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function randomPalette(): { bg: string; fg: string } {
  // 背景をHSLで候補生成、文字色は明暗対比 + 軽い色相ずらしで作り、コントラスト4.5以上になるまで試行
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

export function updateContrast(): void {
  const bg = hexToRgb($input("bg").value);
  const fg = hexToRgb($input("fg").value);
  const r = contrastRatio(bg, fg);
  const el = $("contrastLabel");
  el.classList.remove("ok", "warn", "ng");
  // AA (4.5) 以上は表示しない。それ未満のときだけ警告
  if (r >= 4.5) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  const rounded = r.toFixed(2);
  if (r >= 3) {
    el.textContent = "コントラスト比 " + rounded + " : 1 — 小さい文字は読みづらい";
    el.classList.add("warn");
  } else {
    el.textContent = "コントラスト比 " + rounded + " : 1 — 読みにくい配色";
    el.classList.add("ng");
  }
}
