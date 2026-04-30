import { $, $input, $select, $textarea } from "./dom";
import { updateContrast, randomPalette } from "./colors";
import { isGoogleFont, randomFont } from "./fonts";
import { buildFontPicker, populateHiddenFontSelect } from "./fontPicker";
import { applyPathname } from "./pathname";
import {
  cancelScheduledPreview,
  revokePreviewUrl,
  schedulePathifyPreview,
  setPreviewToUrl,
} from "./preview";
import {
  applyPreviewPadding,
  applyPreviewRadius,
  applyPreviewSize,
  setupPreviewResize,
} from "./previewResize";
import { applyColors, applyFont } from "./presets";
import { downloadPng, downloadSvg } from "./download";
import { buildSvgFromFont, buildVerticalSvgFromFont, ensureFont } from "./pathify";
import { initHistory, redo, scheduleSnapshot, snapshotNow, undo } from "./history";
import { setupEmojiPicker } from "./emoji";
import {
  addFav,
  isFav,
  loadFavs,
  loadPaneOpen,
  removeFavById,
  removeFavByPath,
  savePaneOpen,
} from "./favorites";
import { showToast } from "./toast";
import { registerCurrentPath, registeredPaths } from "./register";
import {
  build,
  collectIconOpts,
  currentFontValue,
  isMathMode,
  isVerticalMode,
} from "./state";
import { setupTurnstileWidget } from "./turnstile";

function updateRegisterUI(): void {
  const useGF = isGoogleFont(currentFontValue());
  const useMath = isMathMode();
  const needsReg = useGF || useMath;
  const registered = needsReg && registeredPaths.has(build());
  const pending = needsReg && !registered;

  $("fontInfoTip").classList.toggle("show", useGF);

  // URL 表示はまだ生成されていない状態であることを視覚的に伝える
  document
    .querySelectorAll<HTMLInputElement>(".url-row input")
    .forEach(inp => inp.classList.toggle("pending", pending));

  document
    .querySelectorAll<HTMLButtonElement>("button[data-copy]")
    .forEach(btn => {
      // コピー直後の "コピー済" 表示中は触らない
      if (btn.classList.contains("copied")) return;
      btn.disabled = false;
      // シェアメニュー項目はラベルが固定なので textContent を書き換えない
      if (btn.classList.contains("share-item")) {
        btn.classList.toggle("needs-register", pending);
        return;
      }
      if (pending) {
        btn.classList.add("needs-register");
        btn.textContent = "URL生成・コピー";
      } else {
        btn.classList.remove("needs-register");
        btn.textContent = "コピー";
      }
    });
}

// ---- init ----
setupTurnstileWidget();
populateHiddenFontSelect();
buildFontPicker();
setupPreviewResize(() => update());

function update(): void {
  const path = build();
  const full = location.origin + path;
  $input("url").value = full;
  $input("cosense").value = "[" + full + "]";
  $input("markdown").value = "![icon](" + full + ")";
  // ブラウザ URL を .svg 無しのエディタ URL に書き換え (履歴汚染なし)
  const editorPath = path.replace(/\.svg$/i, "");
  history.replaceState(null, "", editorPath);
  scheduleSnapshot();
  try {
    localStorage.setItem(STORAGE_KEY, editorPath);
  } catch {
    // ignore
  }
  const w = +$input("w").value;
  const h = +$input("h").value;
  const rot = (Number($input("rotate").value) || 0) % 360;
  applyPreviewSize(w, h, rot);
  applyPreviewPadding(+$input("padding").value);
  applyPreviewRadius(+$input("radius").value);
  const readout = document.getElementById("sizeReadout");
  if (readout) {
    const swap = rot === 90 || rot === 270;
    const ow = swap ? h : w;
    const oh = swap ? w : h;
    readout.textContent = `${ow} × ${oh} px`;
  }
  const rotLabel = document.getElementById("rotateLabel");
  if (rotLabel) rotLabel.textContent = `${rot}°`;
  syncAlignSegmented();
  syncWeightSegmented();
  syncFillMode();
  syncGradAngleVisuals();
  syncFavSaveBtn();
  syncFavCurrentCard();
  updateContrast();
  updateRegisterUI();

  if (isMathMode() || isGoogleFont(currentFontValue())) {
    schedulePathifyPreview();
  } else {
    cancelScheduledPreview();
    revokePreviewUrl();
    setPreviewToUrl(path);
  }
}

function linkSliderNumber(sliderId: string, numberId: string): void {
  const s = $input(sliderId);
  const n = $input(numberId);
  s.addEventListener("input", () => {
    n.value = s.value;
    update();
  });
  n.addEventListener("input", () => {
    if (n.value !== "") s.value = n.value;
    update();
  });
}
// sizeRange は hidden だが値の保持用に残してあるため同期させる
linkSliderNumber("sizeRange", "size");

function syncColorPair(colorId: string, hexId: string): void {
  const c = $input(colorId);
  const t = $input(hexId);
  c.addEventListener("input", () => {
    t.value = c.value;
    update();
  });
  t.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{3,8}$/.test(t.value)) {
      c.value = t.value;
      update();
    }
  });
}
syncColorPair("bg", "bgHex");
syncColorPair("fg", "fgHex");
syncColorPair("gradColor", "gradColorHex");

// グラデ角度ダイヤル (Keynote 風ジョイスティック)
function syncGradAngleVisuals(): void {
  const a = ((Number($input("gradAngle").value) || 0) % 360 + 360) % 360;
  const needle = document.getElementById("gradAngleNeedle");
  if (needle) needle.setAttribute("transform", `rotate(${a})`);
  const dial = document.getElementById("gradAngleDial");
  if (dial) dial.setAttribute("aria-valuenow", String(a));
}

(function setupGradAngleDial() {
  const dial = document.getElementById("gradAngleDial") as HTMLButtonElement | null;
  if (!dial) return;
  const numInp = $input("gradAngle");

  function applyAngle(deg: number): void {
    let norm = ((Math.round(deg) % 360) + 360) % 360;
    numInp.value = String(norm);
    syncGradAngleVisuals();
    update();
  }

  function angleFromPoint(clientX: number, clientY: number, snap: boolean): number {
    const rect = dial!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // 北 (上向き) = 0°, 時計回り (CSS gradient 角度と一致)
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (snap) deg = Math.round(deg / 15) * 15;
    else deg = Math.round(deg);
    return deg % 360;
  }

  let dragging = false;
  dial.addEventListener("pointerdown", e => {
    dragging = true;
    dial.setPointerCapture(e.pointerId);
    dial.classList.add("dragging");
    applyAngle(angleFromPoint(e.clientX, e.clientY, !e.shiftKey));
    e.preventDefault();
  });
  dial.addEventListener("pointermove", e => {
    if (!dragging) return;
    applyAngle(angleFromPoint(e.clientX, e.clientY, !e.shiftKey));
  });
  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    dial!.classList.remove("dragging");
    try { dial!.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  }
  dial.addEventListener("pointerup", endDrag);
  dial.addEventListener("pointercancel", endDrag);

  dial.addEventListener("keydown", e => {
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = e.shiftKey ? 1 : 15;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = e.shiftKey ? -1 : -15;
    else if (e.key === "Home") {
      e.preventDefault();
      applyAngle(0);
      return;
    } else if (e.key === "End") {
      e.preventDefault();
      applyAngle(180);
      return;
    }
    if (delta !== 0) {
      e.preventDefault();
      const cur = Number(numInp.value) || 0;
      applyAngle(cur + delta);
    }
  });

  // number 入力 → 針の同期
  numInp.addEventListener("input", () => syncGradAngleVisuals());
})();

// 塗り種類 (単色/グラデ) - hidden の #grad checkbox をトグル
function syncFillMode(): void {
  const isGrad = $input("grad").checked;
  document
    .querySelectorAll<HTMLButtonElement>("#fillModeSeg .fill-mode-seg")
    .forEach(btn => {
      const want = btn.dataset["value"] === "gradient" ? isGrad : !isGrad;
      btn.classList.toggle("active", want);
      btn.setAttribute("aria-checked", String(want));
    });
  const fs = document.getElementById("fillSection");
  if (fs) fs.dataset["fill"] = isGrad ? "gradient" : "solid";
  // グラデON時は「背景」を「開始」に
  const bgLabel = document.getElementById("bgColorLabel");
  if (bgLabel) bgLabel.textContent = isGrad ? "開始" : "背景";
}
document
  .querySelectorAll<HTMLButtonElement>("#fillModeSeg .fill-mode-seg")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset["value"];
      if (!v) return;
      $input("grad").checked = v === "gradient";
      syncFillMode();
      update();
    });
  });
syncFillMode();

$input("sizeAuto").addEventListener("change", () => {
  const auto = $input("sizeAuto").checked;
  $input("size").disabled = auto;
  $input("sizeRange").disabled = auto;
  update();
});

// 字サイズ A-/A+ ボタン: ±4px ステップで自動を解除しつつ調整
const SIZE_STEP = 4;
function stepSize(delta: number): void {
  const sizeInp = $input("size");
  const cur = +sizeInp.value || 16;
  const next = Math.max(4, Math.min(800, cur + delta));
  sizeInp.value = String(next);
  $input("sizeRange").value = String(next);
  $input("sizeAuto").checked = false;
  sizeInp.disabled = false;
  $input("sizeRange").disabled = false;
  update();
}
$("sizeDown").addEventListener("click", () => stepSize(-SIZE_STEP));
$("sizeUp").addEventListener("click", () => stepSize(SIZE_STEP));

// 太さ segmented control
function syncWeightSegmented(): void {
  const v = $select("weight").value;
  document
    .querySelectorAll<HTMLButtonElement>("#weightSeg .weight-seg")
    .forEach(btn => {
      const active = btn.dataset["value"] === v;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", String(active));
    });
}
document
  .querySelectorAll<HTMLButtonElement>("#weightSeg .weight-seg")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset["value"];
      if (!v) return;
      $select("weight").value = v;
      syncWeightSegmented();
      update();
    });
  });
syncWeightSegmented();

// 揃え segmented control
function syncAlignSegmented(): void {
  const v = $select("align").value;
  document
    .querySelectorAll<HTMLButtonElement>("#alignSeg .align-seg")
    .forEach(btn => {
      const active = btn.dataset["value"] === v;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-checked", String(active));
    });
}
document
  .querySelectorAll<HTMLButtonElement>("#alignSeg .align-seg")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset["value"];
      if (!v) return;
      $select("align").value = v;
      syncAlignSegmented();
      update();
    });
  });
syncAlignSegmented();

$select("font").addEventListener("change", () => {
  $("customFontWrap").classList.toggle(
    "show",
    $select("font").value === "custom",
  );
  update();
});

function spinDice(btnId: string): void {
  const icon = document.querySelector<HTMLElement>(`#${btnId} .dice-icon`);
  if (!icon) return;
  // 進行中のアニメをキャンセルしてクラスを外し、次フレームで再付与
  icon.getAnimations().forEach(a => a.cancel());
  icon.classList.remove("spinning");
  requestAnimationFrame(() => icon.classList.add("spinning"));
}

$("random").addEventListener("click", () => {
  spinDice("random");
  const p = randomPalette();
  applyColors(p.bg, p.fg, update);
});
$("randomFont").addEventListener("click", () => {
  spinDice("randomFont");
  const f = randomFont($textarea("text").value, currentFontValue());
  applyFont(f, update);
});

$("rotateBtn").addEventListener("click", () => {
  const inp = $input("rotate");
  const cur = (Number(inp.value) || 0) % 360;
  const next = (cur + 90) % 360;
  inp.value = String(next);
  update();
});

// 全フォームを最もシンプルな初期状態に戻す
function resetForm(): void {
  // 現状を確実に履歴に積んでから初期化 (Cmd+Z で戻せるように)
  snapshotNow();
  $textarea("text").value = "";
  $input("bg").value = "#ffffff";
  $input("bgHex").value = "#ffffff";
  $input("fg").value = "#000000";
  $input("fgHex").value = "#000000";
  $input("w").value = "600";
  $input("h").value = "400";
  $input("padding").value = "24";
  $input("radius").value = "0";
  $input("sizeAuto").checked = true;
  $input("size").value = "160";
  $input("size").disabled = true;
  $input("sizeRange").value = "160";
  $input("sizeRange").disabled = true;
  $select("weight").value = "700";
  $select("align").value = "center";
  $input("lh").value = "1.2";
  $input("ls").value = "0";
  $select("font").value = "sans";
  $input("fontCustom").value = "";
  $("customFontWrap").classList.remove("show");
  $input("rotate").value = "0";
  $input("grad").checked = false;
  $input("math").checked = false;
  const mathBtn = document.getElementById("mathBtn");
  if (mathBtn) mathBtn.setAttribute("aria-pressed", "false");
  $input("vertical").checked = false;
  const verticalBtn = document.getElementById("verticalBtn");
  if (verticalBtn) verticalBtn.setAttribute("aria-pressed", "false");
  $input("gradColor").value = "#7c3aed";
  ($input("gradColorHex") as HTMLInputElement).value = "#7c3aed";
  $input("gradAngle").value = "135";
  $input("shadow").checked = false;
  $input("shadowColor").value = "#000000";
  $input("shadowBlur").value = "4";
  $input("stroke").checked = false;
  $input("strokeColor").value = "#000000";
  $input("strokeWidth").value = "2";
  if (window._updateFontPickerBtn) window._updateFontPickerBtn();
  update();
  snapshotNow();
}

$("resetBtn").addEventListener("click", () => {
  const btn = $("resetBtn");
  resetForm();
  btn.classList.add("flash");
  showToast("初期状態に戻しました (⌘Z で取り消し)", "info");
  setTimeout(() => btn.classList.remove("flash"), 1500);
});

// ------- お気に入り (右ペイン) -------
function setFavPaneOpen(open: boolean): void {
  document.querySelector("main")?.classList.toggle("fav-open", open);
  const pane = $("favPane");
  pane.hidden = !open;
  const btn = $("favBtn");
  btn.setAttribute("aria-expanded", String(open));
  savePaneOpen(open);
}

function syncFavSaveBtn(): void {
  const path = build();
  const saved = isFav(path);
  const btn = $("favSaveBtn");
  btn.classList.toggle("saved", saved);
  const label = document.getElementById("favSaveLabel");
  if (label) label.textContent = saved ? "保存済み (もう一度で削除)" : "現在の状態を保存";
  btn.setAttribute("title", saved ? "お気に入りから削除" : "現在の状態をお気に入りに追加");
}

function syncFavCount(): void {
  const n = loadFavs().length;
  const badge = $("favCount");
  badge.hidden = n === 0;
  badge.textContent = String(n);
}

function syncFavCurrentCard(): void {
  const path = build();
  const cards = document.querySelectorAll<HTMLButtonElement>("#favList .fav-card");
  const list = loadFavs();
  cards.forEach((card, i) => {
    const fav = list[i];
    card.classList.toggle("current", !!fav && fav.path === path);
  });
}

function renderFavList(): void {
  const list = loadFavs();
  const container = $("favList");
  container.replaceChildren();
  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "fav-empty";
    empty.textContent = "お気に入りはまだありません。\n上の ★ ボタンで現在の状態を保存できます。";
    empty.style.whiteSpace = "pre-line";
    container.appendChild(empty);
    syncFavCount();
    syncFavSaveBtn();
    return;
  }
  const currentPath = build();
  for (const fav of list) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "fav-card";
    if (fav.path === currentPath) card.classList.add("current");
    card.title = `${fav.text || "(無題)"}\n復元するにはクリック`;

    const thumb = document.createElement("span");
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = fav.path;
    img.alt = "";
    img.loading = "lazy";
    thumb.appendChild(img);
    card.appendChild(thumb);

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = fav.text || "(無題)";
    card.appendChild(label);

    const del = document.createElement("span");
    del.className = "del";
    del.setAttribute("role", "button");
    del.setAttribute("tabindex", "0");
    del.setAttribute("aria-label", "このお気に入りを削除");
    del.title = "削除";
    del.textContent = "×";
    const handleDelete = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      removeFavById(fav.id);
      renderFavList();
    };
    del.addEventListener("click", handleDelete);
    del.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") handleDelete(e);
    });
    card.appendChild(del);

    card.addEventListener("click", e => {
      if (e.target instanceof Element && e.target.closest(".del")) return;
      snapshotNow();
      applyPathname(fav.path);
      update();
      snapshotNow();
    });
    container.appendChild(card);
  }
  syncFavCount();
  syncFavSaveBtn();
}

$("favBtn").addEventListener("click", () => {
  const main = document.querySelector("main");
  setFavPaneOpen(!main?.classList.contains("fav-open"));
});

// シェアドロップダウン
function setShareMenuOpen(open: boolean): void {
  $("shareMenu").hidden = !open;
  $("shareBtn").setAttribute("aria-expanded", String(open));
}
$("shareBtn").addEventListener("click", e => {
  e.stopPropagation();
  setShareMenuOpen($("shareMenu").hidden);
});
document.addEventListener("click", e => {
  if ($("shareMenu").hidden) return;
  const t = e.target as Node;
  if ($("shareDropdown").contains(t)) return;
  setShareMenuOpen(false);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !$("shareMenu").hidden) {
    setShareMenuOpen(false);
    $("shareBtn").focus();
  }
});
// メニュー項目を押したらメニュー閉じる (実処理は data-copy / data-download の既存ハンドラ)
document
  .querySelectorAll<HTMLElement>("#shareMenu .share-item")
  .forEach(item => {
    item.addEventListener("click", () => {
      setTimeout(() => setShareMenuOpen(false), 0);
    });
  });

$("favPaneClose").addEventListener("click", () => setFavPaneOpen(false));

$("favSaveBtn").addEventListener("click", () => {
  const path = build();
  const text = $textarea("text").value.replace(/\r?\n/g, " ").slice(0, 80) || "(無題)";
  if (isFav(path)) {
    removeFavByPath(path);
  } else {
    addFav(path, text);
  }
  renderFavList();
});

// 起動時: 保存済みの開閉状態を復元 + 一覧描画
setFavPaneOpen(loadPaneOpen());
renderFavList();

setupEmojiPicker(update);

// 数式モードトグル
$("mathBtn").addEventListener("click", () => {
  const inp = $input("math");
  inp.checked = !inp.checked;
  $("mathBtn").setAttribute("aria-pressed", String(inp.checked));
  if (inp.checked) {
    showToast("MathJax を読み込み中...", "progress");
    void import("./mathify")
      .then(m => m.ensureMathJax())
      .then(() => {
        showToast("数式モード ON: TeX/LaTeX 記法で入力できます", "success", 2000);
        // 読み込み完了後、明示的にプレビュー再描画 (debounce 待ちを短縮)
        update();
      })
      .catch(e => {
        console.error("MathJax load failed:", e);
        showToast(
          "MathJax の読み込みに失敗しました: " +
            (e instanceof Error ? e.message : String(e)),
          "error",
        );
      });
  } else {
    showToast("数式モード OFF", "info", 1200);
  }
  update();
});

// 縦書きモードトグル
$("verticalBtn").addEventListener("click", () => {
  const inp = $input("vertical");
  inp.checked = !inp.checked;
  $("verticalBtn").setAttribute("aria-pressed", String(inp.checked));
  if (inp.checked) {
    showToast("縦書きモード ON", "success", 1500);
  } else {
    showToast("縦書きモード OFF", "info", 1200);
  }
  update();
});

// キーボードショートカット
document.addEventListener("keydown", e => {
  // テキスト入力中はショートカットを無視 (テキスト編集を妨げない)
  const tgt = e.target as HTMLElement | null;
  const editingText =
    tgt &&
    (tgt.tagName === "INPUT" ||
      tgt.tagName === "TEXTAREA" ||
      tgt.tagName === "SELECT" ||
      tgt.isContentEditable);
  const mod = e.metaKey || e.ctrlKey;

  // Cmd/Ctrl 系は editing 中でも有効
  if (mod && (e.key === "z" || e.key === "Z") && e.shiftKey) {
    e.preventDefault();
    redo(update);
    return;
  }
  if (mod && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    undo(update);
    return;
  }
  if (mod && (e.key === "+" || e.key === "=")) {
    e.preventDefault();
    stepSize(SIZE_STEP);
    return;
  }
  if (mod && (e.key === "-" || e.key === "_")) {
    e.preventDefault();
    stepSize(-SIZE_STEP);
    return;
  }

  if (editingText) return;

  // 単独キー
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    spinDice("random");
    const p = randomPalette();
    applyColors(p.bg, p.fg, update);
    return;
  }
  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    spinDice("randomFont");
    const f = randomFont($textarea("text").value, currentFontValue());
    applyFont(f, update);
    return;
  }
  if (e.key === "[") {
    e.preventDefault();
    const inp = $input("rotate");
    inp.value = String(((Number(inp.value) || 0) - 90 + 360) % 360);
    update();
    return;
  }
  if (e.key === "]") {
    e.preventDefault();
    const inp = $input("rotate");
    inp.value = String(((Number(inp.value) || 0) + 90) % 360);
    update();
    return;
  }
  if (e.key === "?") {
    e.preventDefault();
    showShortcutHelp();
    return;
  }
});

function showShortcutHelp(): void {
  showToast(
    "R: 配色 / F: フォント / [ ]: 回転 / ⌘± : 字サイズ / ⌘Z ⌘⇧Z: Undo / Redo",
    "info",
    5000,
  );
}

document
  .querySelectorAll<HTMLElement>("input, select, textarea")
  .forEach(el => el.addEventListener("input", update));

// 現在のフォーム状態に対応する SVG テキストを取得
async function getCurrentSvgText(): Promise<string> {
  const family = currentFontValue();
  const text = $textarea("text").value || "sample";
  if (isMathMode()) {
    const { buildSvgFromTex } = await import("./mathify");
    return buildSvgFromTex(text, collectIconOpts());
  }
  if (isGoogleFont(family)) {
    // Google Fonts は Path 化して生成 (登録不要、クライアント完結)
    const font = await ensureFont(family, $select("weight").value, text);
    const lines = text.split(/\r?\n/);
    return isVerticalMode()
      ? buildVerticalSvgFromFont(font, lines, collectIconOpts())
      : buildSvgFromFont(font, lines, collectIconOpts());
  }
  // それ以外は Worker から取得
  const res = await fetch(build());
  if (!res.ok) throw new Error("SVG 取得失敗: " + res.status);
  return res.text();
}

document
  .querySelectorAll<HTMLButtonElement>("button[data-download]")
  .forEach(btn => {
    btn.addEventListener("click", async () => {
      const kind = btn.dataset["download"];
      if (!kind) return;
      const isShareItem = btn.classList.contains("share-item");
      const original = btn.textContent ?? "";
      const scale = Number(btn.dataset["scale"] ?? "1") || 1;
      const kindLabel =
        kind === "svg"
          ? "SVG"
          : "PNG" + (scale > 1 ? ` @${scale}x` : "");
      btn.disabled = true;
      if (!isShareItem) btn.textContent = "生成中...";
      showToast(`${kindLabel} を生成中...`, "progress");
      try {
        const svgText = await getCurrentSvgText();
        const baseName = $textarea("text").value.replace(/\r?\n/g, " ") || "icon";
        if (kind === "svg") {
          await downloadSvg(svgText, baseName);
        } else if (kind === "png") {
          const w = +$input("w").value;
          const h = +$input("h").value;
          const rot = (Number($input("rotate").value) || 0) % 360;
          const swap = rot === 90 || rot === 270;
          const ow = swap ? h : w;
          const oh = swap ? w : h;
          await downloadPng(svgText, ow, oh, scale, baseName);
        }
        showToast(`${kindLabel} をダウンロードしました`, "success");
      } catch (e) {
        console.error(e);
        showToast(
          "ダウンロードに失敗しました: " +
            (e instanceof Error ? e.message : String(e)),
          "error",
        );
      } finally {
        btn.disabled = false;
        if (!isShareItem) btn.textContent = original;
      }
    });
  });

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

document
  .querySelectorAll<HTMLButtonElement>("button[data-copy]")
  .forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const targetId = btn.dataset["copy"];
      if (!targetId) return;
      const target = document.getElementById(targetId) as HTMLInputElement;
      const needsRegister =
        (isMathMode() || isGoogleFont(currentFontValue())) &&
        !registeredPaths.has(build());

      const isShareItem = btn.classList.contains("share-item");
      const itemLabels: Record<string, string> = {
        url: "画像 URL",
        cosense: "Cosense 記法",
        markdown: "Markdown",
      };
      const itemLabel = itemLabels[targetId] ?? "テキスト";

      if (needsRegister) {
        btn.classList.remove("needs-register");
        btn.disabled = true;
        if (!isShareItem) btn.textContent = "登録中...";
        const initialMsg = isMathMode()
          ? "数式を SVG として登録しています..."
          : "Google Fonts を登録しています...";
        showToast(initialMsg, "progress");
        try {
          await registerCurrentPath(msg => {
            // 進捗段階に応じてより具体的な文言にする
            const detail =
              msg.startsWith("MathJax") ? "MathJax を読み込み中..."
              : msg.startsWith("数式") ? "数式を SVG パスに変換中..."
              : msg.startsWith("フォント") ? "Google Fonts のフォントを取得中..."
              : msg.startsWith("Path") ? "テキストを SVG パスに変換中..."
              : msg.startsWith("認証") ? "Turnstile で認証中..."
              : msg.startsWith("登録") ? "サーバーに登録中 (R2 アップロード)..."
              : msg;
            showToast(detail, "progress");
          });
          showToast("登録が完了しました", "success", 1200);
          setPreviewToUrl(build() + "?_=" + Date.now());
        } catch (e) {
          console.error(e);
          showToast(
            "登録に失敗しました: " +
              (e instanceof Error ? e.message : String(e)),
            "error",
          );
          if (!isShareItem) btn.textContent = "コピー";
          btn.disabled = false;
          updateRegisterUI();
          return;
        }
      }

      const ok = await copyToClipboard(target.value);
      if (!ok) {
        target.select();
        document.execCommand("copy");
      }
      btn.classList.remove("needs-register");
      btn.classList.add("copied");
      btn.disabled = false;
      if (!isShareItem) btn.textContent = "コピー済";
      // 登録直後は短く間を空けて成功 toast を上書き
      const delay = needsRegister ? 700 : 0;
      setTimeout(() => {
        showToast(`${itemLabel} をクリップボードにコピーしました`, "success");
      }, delay);
      setTimeout(() => {
        btn.classList.remove("copied");
        updateRegisterUI();
      }, 1500);
    });
  });

// 起動時: 拡張子なしの URL ならその状態でエディタを復元
// URL が "/" のときは localStorage に予備保存があれば復元
// (regen クエリがある場合は handleRegen 側に任せる)
const STORAGE_KEY = "cosense-icon:lastPath";
(function restoreFromPathname() {
  const params = new URLSearchParams(location.search);
  if (params.has("regen")) return;
  const p = location.pathname;
  if (p && p !== "/" && !/\.svg$/i.test(p)) {
    applyPathname(p);
    return;
  }
  // フォールバック: localStorage の最終状態
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) applyPathname(saved);
  } catch {
    // localStorage アクセス不可 (private mode 等) は無視
  }
})();

(function handleRegen() {
  const params = new URLSearchParams(location.search);
  const regen = params.get("regen");
  if (!regen) return;
  try {
    const b64 = regen.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pathname = new TextDecoder().decode(bytes);
    applyPathname(pathname);
    update();
    setTimeout(() => {
      if (isMathMode() || isGoogleFont(currentFontValue())) {
        const initial = isMathMode()
          ? "数式を SVG として登録しています..."
          : "Google Fonts を登録しています...";
        showToast(initial, "progress");
        registerCurrentPath(msg => {
          const detail =
            msg.startsWith("MathJax") ? "MathJax を読み込み中..."
            : msg.startsWith("数式") ? "数式を SVG パスに変換中..."
            : msg.startsWith("フォント") ? "Google Fonts のフォントを取得中..."
            : msg.startsWith("Path") ? "テキストを SVG パスに変換中..."
            : msg.startsWith("認証") ? "Turnstile で認証中..."
            : msg.startsWith("登録") ? "サーバーに登録中 (R2 アップロード)..."
            : msg;
          showToast(detail, "progress");
        })
          .then(() => {
            showToast("登録が完了しました", "success");
            setPreviewToUrl(build() + "?_=" + Date.now());
            updateRegisterUI();
          })
          .catch(e => {
            showToast(
              "登録に失敗しました: " +
                (e instanceof Error ? e.message : String(e)),
              "error",
            );
            updateRegisterUI();
          });
      }
    }, 800);
  } catch (e) {
    console.error("regen decode failed", e);
  }
})();

update();
initHistory();

// PWA: Service Worker を登録 (オフライン + ホーム画面追加対応)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(err => console.warn("SW register failed:", err));
  });
}
