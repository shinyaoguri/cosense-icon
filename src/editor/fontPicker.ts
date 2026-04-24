import { $, $select } from "./dom";
import {
  BUILTIN_FONTS,
  BUILTIN_LABELS,
  GOOGLE_FONTS,
  isBuiltinFont,
  isGoogleFont,
  type BuiltinFont,
} from "./fonts";

export function populateHiddenFontSelect(): void {
  const sel = $select("font");
  sel.innerHTML = "";
  const builtinGroup = document.createElement("optgroup");
  builtinGroup.label = "組み込み";
  BUILTIN_FONTS.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = BUILTIN_LABELS[v];
    builtinGroup.appendChild(opt);
  });
  sel.appendChild(builtinGroup);
  GOOGLE_FONTS.forEach(([cat, fonts]) => {
    const og = document.createElement("optgroup");
    og.label = "Google Fonts – " + cat;
    fonts.forEach(family => {
      const opt = document.createElement("option");
      opt.value = family;
      opt.textContent = family;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
}

let _fontCssLoaded = false;

export function loadAllGoogleFontsCss(): void {
  if (_fontCssLoaded) return;
  _fontCssLoaded = true;
  const all = GOOGLE_FONTS.flatMap(([, fonts]) => fonts);
  const href =
    "https://fonts.googleapis.com/css2?" +
    all.map(f => "family=" + encodeURIComponent(f)).join("&") +
    "&display=swap";
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function buildFontPicker(): void {
  const sel = $select("font");
  sel.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = "font-picker";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "font-picker-btn";
  btn.id = "fontPickerBtn";
  const nameSpan = document.createElement("span");
  nameSpan.className = "name";
  const sampleSpan = document.createElement("span");
  sampleSpan.className = "sample";
  const caretSpan = document.createElement("span");
  caretSpan.className = "caret";
  caretSpan.textContent = "▾";
  btn.appendChild(nameSpan);
  btn.appendChild(sampleSpan);
  btn.appendChild(caretSpan);

  const menu = document.createElement("div");
  menu.className = "font-picker-menu";
  menu.hidden = true;

  wrap.appendChild(btn);
  wrap.appendChild(menu);
  sel.parentNode!.insertBefore(wrap, sel);

  function addGroup(label: string): void {
    const el = document.createElement("div");
    el.className = "font-picker-group";
    el.textContent = label;
    menu.appendChild(el);
  }
  function addItem(value: string, label: string, previewFamily: string | null): void {
    const item = document.createElement("div");
    item.className = "font-picker-item";
    item.dataset["value"] = value;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = label;
    const sample = document.createElement("span");
    sample.className = "sample";
    sample.textContent = "Aa あ";
    if (previewFamily) {
      const ff = `"${previewFamily}", sans-serif`;
      name.style.fontFamily = ff;
      sample.style.fontFamily = ff;
    }
    item.appendChild(name);
    item.appendChild(sample);
    item.addEventListener("click", () => {
      sel.value = value;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      updatePickerBtn();
      close();
    });
    menu.appendChild(item);
  }

  addGroup("組み込み");
  BUILTIN_FONTS.forEach(v => addItem(v, BUILTIN_LABELS[v], null));
  GOOGLE_FONTS.forEach(([cat, fonts]) => {
    addGroup("Google Fonts – " + cat);
    fonts.forEach(family => addItem(family, family, family));
  });

  function updatePickerBtn(): void {
    const v = sel.value;
    const label = isBuiltinFont(v) ? BUILTIN_LABELS[v as BuiltinFont] || v : v;
    nameSpan.textContent = label;
    if (isGoogleFont(v)) {
      const ff = `"${v}", sans-serif`;
      nameSpan.style.fontFamily = ff;
      sampleSpan.style.fontFamily = ff;
      sampleSpan.textContent = "Aa あ";
    } else {
      nameSpan.style.fontFamily = "";
      sampleSpan.style.fontFamily = "";
      sampleSpan.textContent = "";
    }
    menu.querySelectorAll<HTMLElement>(".font-picker-item").forEach(el => {
      el.classList.toggle("active", el.dataset["value"] === v);
    });
  }

  function open(): void {
    menu.hidden = false;
    loadAllGoogleFontsCss();
    const active = menu.querySelector<HTMLElement>(".font-picker-item.active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }
  function close(): void {
    menu.hidden = true;
  }

  btn.addEventListener("click", e => {
    e.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  document.addEventListener("click", e => {
    if (!wrap.contains(e.target as Node)) close();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !menu.hidden) close();
  });

  updatePickerBtn();
  window._updateFontPickerBtn = updatePickerBtn;
}
