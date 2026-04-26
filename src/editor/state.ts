import { $input, $select, $textarea } from "./dom";

export interface Defaults {
  bg: string;
  fg: string;
  w: number;
  h: number;
  weight: string;
  padding: number;
  radius: number;
  align: string;
  lh: number;
  ls: number;
  font: string;
  rotate: number;
}

export const defaults: Defaults = {
  bg: "#ffffff",
  fg: "#222222",
  w: 600,
  h: 400,
  weight: "700",
  padding: 24,
  radius: 0,
  align: "center",
  lh: 1.2,
  ls: 0,
  font: "sans",
  rotate: 0,
};

export interface InitialValues extends Defaults {
  text: string;
  sizeAuto: boolean;
  size: number;
  fontCustom: string;
}

export const initial: InitialValues = {
  ...defaults,
  text: "",
  bg: "#1e40af",
  fg: "#ffffff",
  w: 600,
  h: 400,
  padding: 24,
  radius: 0,
  sizeAuto: true,
  size: 160,
  weight: "700",
  align: "center",
  lh: 1.2,
  ls: 0,
  font: "sans",
  rotate: 0,
  fontCustom: "",
};

export interface IconOpts {
  width: number;
  height: number;
  padding: number;
  radius: number;
  lh: number;
  bg: string;
  fg: string;
  align: "left" | "center" | "right" | "justify";
  size: number | null;
  rotate: 0 | 90 | 180 | 270;
}

export function collectIconOpts(): IconOpts {
  const r = (+$input("rotate").value || 0) as IconOpts["rotate"];
  return {
    width: +$input("w").value,
    height: +$input("h").value,
    padding: +$input("padding").value,
    radius: +$input("radius").value,
    lh: +$input("lh").value,
    bg: $input("bg").value,
    fg: $input("fg").value,
    align: $select("align").value as IconOpts["align"],
    size: $input("sizeAuto").checked ? null : +$input("size").value,
    rotate: r,
  };
}

export function currentFontValue(): string {
  const v = $select("font").value;
  if (v === "custom") return $input("fontCustom").value.trim();
  return v;
}

export function build(): string {
  const opts: string[] = [];
  const bg = $input("bg").value.toLowerCase();
  if (bg !== defaults.bg) opts.push("bg-" + bg.replace("#", ""));
  const fg = $input("fg").value.toLowerCase();
  if (fg !== defaults.fg) opts.push("fg-" + fg.replace("#", ""));
  const w = Number($input("w").value);
  if (w !== defaults.w) opts.push("w-" + w);
  const h = Number($input("h").value);
  if (h !== defaults.h) opts.push("h-" + h);
  if (!$input("sizeAuto").checked) opts.push("size-" + Number($input("size").value));
  const weight = $select("weight").value;
  if (weight !== defaults.weight) opts.push("weight-" + weight);
  const padding = Number($input("padding").value);
  if (padding !== defaults.padding) opts.push("padding-" + padding);
  const radius = Number($input("radius").value);
  if (radius !== defaults.radius) opts.push("radius-" + radius);
  const align = $select("align").value;
  if (align !== defaults.align) opts.push("align-" + align);
  const lh = Number($input("lh").value);
  if (lh !== defaults.lh) opts.push("lh-" + lh);
  const ls = Number($input("ls").value);
  if (ls !== defaults.ls) opts.push("ls-" + ls);
  const rotate = Number($input("rotate").value);
  if (rotate !== defaults.rotate) opts.push("rotate-" + rotate);

  const fontSel = $select("font").value;
  if (fontSel === "custom") {
    const custom = $input("fontCustom").value.trim().replace(/,/g, "");
    if (custom) opts.push("font-" + custom);
  } else if (fontSel !== defaults.font) {
    opts.push("font-" + fontSel);
  }

  const text = $textarea("text").value.replace(/\r?\n/g, "\\n");
  const safeText = text.length ? text : "sample";
  const segText = encodeURIComponent(safeText) + ".svg";
  return "/" + [...opts.map(encodeURIComponent), segText].join("/");
}
