import { $, $input, $select, $textarea } from "./dom";
import { initial } from "./state";

export interface Preset {
  name: string;
  text: string;
  bg?: string;
  fg?: string;
  radius?: number;
}

export const presets: Preset[] = [
  { name: "ゼミ", text: "B4ゼミ", bg: "#1e40af", fg: "#ffffff" },
  { name: "メモ", text: "メモ", bg: "#fef3c7", fg: "#92400e" },
  { name: "TODO", text: "TODO", bg: "#0f172a", fg: "#fbbf24" },
  { name: "会議", text: "議事録", bg: "#0f172a", fg: "#38bdf8" },
  { name: "雑談", text: "雑談", bg: "#fce7f3", fg: "#9f1239" },
  { name: "日付", text: "2026年\n04月19日", bg: "#f43f5e", fg: "#ffffff", radius: 32 },
];

export function applyPreset(p: Preset, onUpdate: () => void): void {
  $textarea("text").value = p.text.replace(/\\n/g, "\n");
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
