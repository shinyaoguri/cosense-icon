import { $input } from "./dom";

const W_MIN = 1;
const W_MAX = 4000;
const H_MIN = 1;
const H_MAX = 4000;

export function applyPreviewSize(w: number, h: number): void {
  const frame = document.getElementById("previewFrame");
  if (!frame) return;
  frame.style.width = w + "px";
  frame.style.height = h + "px";
  frame.style.aspectRatio = `${w} / ${h}`;
}

// サイズハンドル(角)と十分離して常に押せるようにする最小オフセット
const MIN_HANDLE_OFFSET = 14;

export function applyPreviewPadding(p: number): void {
  const pf = document.getElementById("paddingFrame");
  if (pf) {
    pf.style.top = p + "px";
    pf.style.left = p + "px";
    pf.style.right = p + "px";
    pf.style.bottom = p + "px";
  }
  const handle = document.getElementById("paddingHandle");
  if (handle) {
    const off = Math.max(p, MIN_HANDLE_OFFSET);
    handle.style.bottom = off + "px";
    handle.style.right = off + "px";
  }
}

export function applyPreviewRadius(r: number): void {
  const handle = document.getElementById("radiusHandle");
  if (!handle) return;
  const off = Math.max(r, MIN_HANDLE_OFFSET);
  handle.style.top = off + "px";
  handle.style.left = off + "px";
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function setNum(id: string, v: number): void {
  $input(id).value = String(v);
  const range = document.getElementById(id + "Range") as HTMLInputElement | null;
  if (range) range.value = String(v);
}

function setReadout(text: string): void {
  const el = document.getElementById("sizeReadout");
  if (el) el.textContent = text;
}

type Direction = { x?: 1 | -1; y?: 1 | -1 };

function setupHandle(id: string, dir: Direction, onUpdate: () => void): void {
  const handle = document.getElementById(id);
  if (!handle) return;

  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    const frame = document.getElementById("previewFrame");
    frame?.classList.add("dragging");

    const rect = frame!.getBoundingClientRect();
    const startW = +$input("w").value;
    const startH = +$input("h").value;
    // ドラッグ開始時のスケールで以後の dx/dy を論理 px に換算
    const scaleX = startW > 0 ? rect.width / startW : 1;
    const scaleY = startH > 0 ? rect.height / startH : 1;
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent): void => {
      if (dir.x !== undefined) {
        const dx = ((ev.clientX - startX) / scaleX) * dir.x;
        setNum("w", clamp(Math.round(startW + dx), W_MIN, W_MAX));
      }
      if (dir.y !== undefined) {
        const dy = ((ev.clientY - startY) / scaleY) * dir.y;
        setNum("h", clamp(Math.round(startH + dy), H_MIN, H_MAX));
      }
      onUpdate();
    };
    const onUp = (): void => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      handle.classList.remove("dragging");
      frame?.classList.remove("dragging");
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

function setupPaddingHandle(id: string, onUpdate: () => void): void {
  const handle = document.getElementById(id);
  if (!handle) return;

  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    const frame = document.getElementById("previewFrame");
    frame?.classList.add("dragging");

    const rect = frame!.getBoundingClientRect();
    const startPad = +$input("padding").value;
    const startW = +$input("w").value;
    const startH = +$input("h").value;
    const scaleX = startW > 0 ? rect.width / startW : 1;
    const scaleY = startH > 0 ? rect.height / startH : 1;
    const startX = e.clientX;
    const startY = e.clientY;
    // 余白を増やしすぎて画像領域が消えないよう、min(w,h)/2 - 1 を上限
    const maxPad = Math.max(0, Math.floor(Math.min(startW, startH) / 2) - 1);

    const onMove = (ev: PointerEvent): void => {
      // 右下ハンドル: 左上方向へドラッグ (-dx, -dy) で padding 増
      const dx = (ev.clientX - startX) / scaleX;
      const dy = (ev.clientY - startY) / scaleY;
      const delta = -(dx + dy) / 2;
      const newPad = clamp(Math.round(startPad + delta), 0, maxPad);
      setNum("padding", newPad);
      onUpdate();
      setReadout(`余白 ${newPad} px`);
    };
    const onUp = (): void => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      handle.classList.remove("dragging");
      frame?.classList.remove("dragging");
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

function setupRadiusHandle(id: string, onUpdate: () => void): void {
  const handle = document.getElementById(id);
  if (!handle) return;

  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add("dragging");
    const frame = document.getElementById("previewFrame");
    frame?.classList.add("dragging");

    const rect = frame!.getBoundingClientRect();
    const startR = +$input("radius").value;
    const startW = +$input("w").value;
    const startH = +$input("h").value;
    const scaleX = startW > 0 ? rect.width / startW : 1;
    const scaleY = startH > 0 ? rect.height / startH : 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const maxR = Math.floor(Math.min(startW, startH) / 2);

    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - startX) / scaleX;
      const dy = (ev.clientY - startY) / scaleY;
      // 右下方向にドラッグで radius 増、左上方向で減
      const delta = (dx + dy) / 2;
      const newR = clamp(Math.round(startR + delta), 0, maxR);
      setNum("radius", newR);
      onUpdate();
      setReadout(`角丸 ${newR} px`);
    };
    const onUp = (): void => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      handle.classList.remove("dragging");
      frame?.classList.remove("dragging");
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });
}

export function setupPreviewResize(onUpdate: () => void): void {
  // 四隅
  setupHandle("resizeTL", { x: -1, y: -1 }, onUpdate);
  setupHandle("resizeTR", { x: 1, y: -1 }, onUpdate);
  setupHandle("resizeBL", { x: -1, y: 1 }, onUpdate);
  setupHandle("resizeBR", { x: 1, y: 1 }, onUpdate);
  // 各辺中点
  setupHandle("resizeT", { y: -1 }, onUpdate);
  setupHandle("resizeB", { y: 1 }, onUpdate);
  setupHandle("resizeL", { x: -1 }, onUpdate);
  setupHandle("resizeR", { x: 1 }, onUpdate);
  // 余白 (右下に1つ)
  setupPaddingHandle("paddingHandle", onUpdate);
  // 角丸 (左上に1つ)
  setupRadiusHandle("radiusHandle", onUpdate);
}
