import { $, $input, $select, $textarea } from "./dom";
import { BUILTIN_FONTS, isGoogleFont } from "./fonts";

const KEY_ALIASES: Record<string, string> = {
  bg: "bg",
  background: "bg",
  "background-color": "bg",
  "背景": "bg",
  fg: "fg",
  color: "fg",
  text: "fg",
  foreground: "fg",
  "文字色": "fg",
  w: "w",
  width: "w",
  "幅": "w",
  h: "h",
  height: "h",
  "高さ": "h",
  size: "size",
  fontsize: "size",
  "font-size": "size",
  "文字サイズ": "size",
  font: "font",
  "font-family": "font",
  family: "font",
  weight: "weight",
  "font-weight": "weight",
  bold: "weight",
  padding: "padding",
  p: "padding",
  radius: "radius",
  r: "radius",
  rounded: "radius",
  "border-radius": "radius",
  lh: "lh",
  "line-height": "lh",
  lineheight: "lh",
  ls: "ls",
  "letter-spacing": "ls",
  spacing: "ls",
  align: "align",
  "text-align": "align",
  rotate: "rotate",
  rot: "rotate",
  shadow: "shadow",
  blur: "shadowBlur",
  "shadow-blur": "shadowBlur",
  stroke: "stroke",
  outline: "stroke",
  "stroke-w": "strokeWidth",
  "stroke-width": "strokeWidth",
  grad: "grad",
  "grad-to": "grad",
  to: "grad",
  angle: "gradAngle",
  "grad-angle": "gradAngle",
};

function applySingleOpt(k: string, v: string): void {
  switch (k) {
    case "bg":
    case "fg": {
      const hex = /^#?[0-9a-fA-F]{3,8}$/.test(v)
        ? v.startsWith("#") ? v : "#" + v
        : v;
      $input(k).value = hex;
      $input(k + "Hex").value = hex;
      return;
    }
    case "w":
    case "h":
    case "padding":
    case "radius":
    case "lh":
    case "ls": {
      const n = Number(v);
      if (!isFinite(n)) return;
      $input(k).value = String(n);
      const rng = document.getElementById(k + "Range") as HTMLInputElement | null;
      if (rng) rng.value = String(n);
      return;
    }
    case "size": {
      const n = Number(v);
      if (!isFinite(n)) return;
      $input("sizeAuto").checked = false;
      $input("size").disabled = false;
      $input("sizeRange").disabled = false;
      $input("size").value = String(n);
      $input("sizeRange").value = String(n);
      return;
    }
    case "weight":
      $select("weight").value = v;
      return;
    case "align":
      $select("align").value = v;
      return;
    case "rotate": {
      const n = ((Number(v) % 360) + 360) % 360;
      if (n === 0 || n === 90 || n === 180 || n === 270) {
        $input("rotate").value = String(n);
      }
      return;
    }
    case "shadow": {
      const lower = v.toLowerCase();
      const off = !lower || lower === "off" || lower === "none" || lower === "0";
      $input("shadow").checked = !off;
      const hex = /^#?[0-9a-fA-F]{3,8}$/.test(v)
        ? v.startsWith("#") ? v : "#" + v
        : "";
      if (hex) $input("shadowColor").value = hex;
      return;
    }
    case "shadowBlur": {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) $input("shadowBlur").value = String(n);
      return;
    }
    case "stroke": {
      const lower = v.toLowerCase();
      const off = !lower || lower === "off" || lower === "none" || lower === "0";
      $input("stroke").checked = !off;
      const hex = /^#?[0-9a-fA-F]{3,8}$/.test(v)
        ? v.startsWith("#") ? v : "#" + v
        : "";
      if (hex) $input("strokeColor").value = hex;
      return;
    }
    case "strokeWidth": {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) $input("strokeWidth").value = String(n);
      return;
    }
    case "grad": {
      const lower = v.toLowerCase();
      const off = !lower || lower === "off" || lower === "none" || lower === "0";
      $input("grad").checked = !off;
      const hex = /^#?[0-9a-fA-F]{3,8}$/.test(v)
        ? v.startsWith("#") ? v : "#" + v
        : "";
      if (hex) {
        $input("gradColor").value = hex;
        const ghx = document.getElementById("gradColorHex") as HTMLInputElement | null;
        if (ghx) ghx.value = hex;
      }
      return;
    }
    case "gradAngle": {
      const n = Number(v);
      if (Number.isFinite(n)) $input("gradAngle").value = String(n);
      return;
    }
    case "font": {
      const low = v.toLowerCase();
      if ((BUILTIN_FONTS as readonly string[]).includes(low)) {
        $select("font").value = low;
        $("customFontWrap").classList.remove("show");
      } else if (isGoogleFont(v)) {
        $select("font").value = v;
        $("customFontWrap").classList.remove("show");
      } else {
        $select("font").value = "custom";
        $input("fontCustom").value = v;
        $("customFontWrap").classList.add("show");
      }
      if (window._updateFontPickerBtn) window._updateFontPickerBtn();
      return;
    }
  }
}

export function applyPathname(pathname: string): void {
  const trimmed = pathname.replace(/^\/+/, "");
  if (!trimmed) return;
  const segs = trimmed
    .split("/")
    .map(s => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    })
    .filter(s => s.length);
  if (segs.length === 0) return;

  const last = segs[segs.length - 1]!;
  const textRaw = last.replace(/\.svg$/i, "");
  if (textRaw) $textarea("text").value = textRaw.replace(/\\n/g, "\n");

  // /math/ または /tex/ セグメントの有無で数式モードを切替
  let math = false;
  segs.slice(0, -1).forEach(seg => {
    const segLower = seg.toLowerCase();
    if (segLower === "math" || segLower === "tex") {
      math = true;
      return;
    }
    if (segLower === "random") return; // 既存処理は別 (random はサーバ判定だけで OK)
    seg.split(",").forEach(tok => {
      const m = tok.match(/^([^-=:]+)[-=:](.*)$/);
      if (!m) return;
      const k = m[1]!.toLowerCase();
      const val = m[2]!;
      const key = KEY_ALIASES[k];
      if (!key) return;
      applySingleOpt(key, val);
    });
  });
  const mathInp = document.getElementById("math") as HTMLInputElement | null;
  if (mathInp) mathInp.checked = math;
  const mathBtn = document.getElementById("mathBtn");
  if (mathBtn) mathBtn.setAttribute("aria-pressed", String(math));
}
