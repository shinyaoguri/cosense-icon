import { $, $textarea, $select, $input } from "./dom";
import { isGoogleFont } from "./fonts";
import { buildSvgFromFont, buildVerticalSvgFromFont, ensureFont } from "./pathify";
import { buildSvgFromTex } from "./mathify";
import {
  build,
  collectIconOpts,
  currentFontValue,
  isMathMode,
  isVerticalMode,
  isWrapMode,
} from "./state";
import { showToast } from "./toast";

let _previewObjectUrl: string | null = null;
let _previewDebounceTimer: number | null = null;
let _previewReqId = 0;
const PREVIEW_DEBOUNCE_MS = 220;

export function revokePreviewUrl(): void {
  if (_previewObjectUrl) {
    URL.revokeObjectURL(_previewObjectUrl);
    _previewObjectUrl = null;
  }
}

export function cancelScheduledPreview(): void {
  if (_previewDebounceTimer !== null) {
    clearTimeout(_previewDebounceTimer);
    _previewDebounceTimer = null;
  }
  _previewReqId++;
}

export async function renderPathifyPreview(): Promise<void> {
  const family = currentFontValue();
  const mathOn = isMathMode();
  const verticalOn = isVerticalMode();
  // サーバ側で縦書きを描画できるので、システムフォント + 縦書きでも
  // ここでクライアント側プレビューに乗せる必要はない。Google Fonts のときだけ path 化が必要。
  if (!mathOn && !isGoogleFont(family)) return;
  const text = $textarea("text").value || "sample";
  const weight = $select("weight").value;
  const reqId = ++_previewReqId;
  const preview = $input("preview") as unknown as HTMLImageElement;
  try {
    let svg: string;
    if (mathOn) {
      svg = await buildSvgFromTex(text, collectIconOpts());
    } else {
      const font = await ensureFont(family, weight, text);
      if (reqId !== _previewReqId) return;
      const lines = text.split(/\r?\n/);
      svg = verticalOn
        ? buildVerticalSvgFromFont(font, lines, collectIconOpts())
        : buildSvgFromFont(font, lines, collectIconOpts(), isWrapMode());
    }
    if (reqId !== _previewReqId) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    revokePreviewUrl();
    _previewObjectUrl = url;
    preview.src = url;
  } catch (e) {
    if (reqId !== _previewReqId) return;
    console.warn("preview render failed", e);
    revokePreviewUrl();
    preview.src = build();
    if (isMathMode()) {
      const msg = e instanceof Error ? e.message : String(e);
      // TeX 構文エラー等もここに来るので簡潔に通知
      showToast("数式の描画に失敗: " + msg.slice(0, 100), "error", 4000);
    }
  }
}

export function schedulePathifyPreview(): void {
  if (_previewDebounceTimer !== null) clearTimeout(_previewDebounceTimer);
  _previewDebounceTimer = window.setTimeout(() => {
    _previewDebounceTimer = null;
    void renderPathifyPreview();
  }, PREVIEW_DEBOUNCE_MS);
}

export function setPreviewToUrl(path: string): void {
  revokePreviewUrl();
  const img = $("preview") as HTMLImageElement;
  img.src = path;
}
