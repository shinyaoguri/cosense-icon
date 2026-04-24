import { $, $input, $select, $textarea } from "./dom";
import { initial } from "./state";

export interface Preset {
  name: string;
  text: string | (() => string);
  bg?: string;
  fg?: string;
  radius?: number;
  w?: number;
  h?: number;
}

function todayText(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}年\n${m}月${day}日`;
}

export const presets: Preset[] = [
  { name: "ゼミ", text: "ゼミ", bg: "#1e40af", fg: "#ffffff", w: 600, h: 400 },
  { name: "メモ", text: "メモ", bg: "#fef3c7", fg: "#92400e", w: 600, h: 400 },
  { name: "TODO", text: "TODO", bg: "#0f172a", fg: "#fbbf24", w: 900, h: 400 },
  { name: "議事録", text: "議事録", bg: "#0f172a", fg: "#38bdf8", w: 600, h: 400 },
  { name: "雑談", text: "雑談", bg: "#fce7f3", fg: "#9f1239", w: 600, h: 400 },
  { name: "日付", text: todayText, bg: "#f43f5e", fg: "#ffffff", radius: 32, w: 600, h: 400 },
];

export function applyPreset(p: Preset, onUpdate: () => void): void {
  const rawText = typeof p.text === "function" ? p.text() : p.text;
  $textarea("text").value = rawText.replace(/\\n/g, "\n");
  if (p.bg) {
    $input("bg").value = p.bg;
    $input("bgHex").value = p.bg;
  }
  if (p.fg) {
    $input("fg").value = p.fg;
    $input("fgHex").value = p.fg;
  }
  $input("radius").value = String(p.radius || 0);
  $input("radiusRange").value = String(p.radius || 0);
  if (typeof p.w === "number") {
    $input("w").value = String(p.w);
    $input("wRange").value = String(p.w);
  }
  if (typeof p.h === "number") {
    $input("h").value = String(p.h);
    $input("hRange").value = String(p.h);
  }
  onUpdate();
}

export function applyColors(bg: string, fg: string, onUpdate: () => void): void {
  $input("bg").value = bg;
  $input("bgHex").value = bg;
  $input("fg").value = fg;
  $input("fgHex").value = fg;
  onUpdate();
}

export function renderPresets(onApply: (p: Preset) => void): void {
  const wrap = $("presets");
  presets.forEach(p => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "preset-btn";
    b.textContent = p.name;
    b.addEventListener("click", () => onApply(p));
    wrap.appendChild(b);
  });
}

export function resetForm(onUpdate: () => void): void {
  $textarea("text").value = initial.text;
  $input("bg").value = initial.bg;
  $input("bgHex").value = initial.bg;
  $input("fg").value = initial.fg;
  $input("fgHex").value = initial.fg;
  $input("w").value = String(initial.w);
  $input("wRange").value = String(initial.w);
  $input("h").value = String(initial.h);
  $input("hRange").value = String(initial.h);
  $input("padding").value = String(initial.padding);
  $input("paddingRange").value = String(initial.padding);
  $input("radius").value = String(initial.radius);
  $input("radiusRange").value = String(initial.radius);
  $input("sizeAuto").checked = initial.sizeAuto;
  $input("size").value = String(initial.size);
  $input("sizeRange").value = String(initial.size);
  $input("size").disabled = initial.sizeAuto;
  $input("sizeRange").disabled = initial.sizeAuto;
  $select("weight").value = initial.weight;
  $select("align").value = initial.align;
  $input("lh").value = String(initial.lh);
  $input("lhRange").value = String(initial.lh);
  $input("ls").value = String(initial.ls);
  $input("lsRange").value = String(initial.ls);
  $select("font").value = initial.font;
  $input("fontCustom").value = initial.fontCustom;
  $("customFontWrap").classList.remove("show");
  if (window._updateFontPickerBtn) window._updateFontPickerBtn();
  onUpdate();
}
