import { $, $input, $select } from "./dom";

export function applyColors(bg: string, fg: string, onUpdate: () => void): void {
  $input("bg").value = bg;
  $input("bgHex").value = bg;
  $input("fg").value = fg;
  $input("fgHex").value = fg;
  onUpdate();
}

export function applyFont(value: string, onUpdate: () => void): void {
  $select("font").value = value;
  $("customFontWrap").classList.toggle("show", value === "custom");
  if (window._updateFontPickerBtn) window._updateFontPickerBtn();
  onUpdate();
}
