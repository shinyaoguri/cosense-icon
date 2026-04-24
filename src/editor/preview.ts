import { $, $textarea, $select, $input } from "./dom";
import { isGoogleFont } from "./fonts";
import { buildSvgFromFont, ensureFont } from "./pathify";
import { build, collectIconOpts, currentFontValue } from "./state";

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
  if (!isGoogleFont(family)) return;
  const text = $textarea("text").value || "sample";
  const weight = $select("weight").value;
  const reqId = ++_previewReqId;
  const preview = $input("preview") as unknown as HTMLImageElement;
  try {
    const font = await ensureFont(family, weight, text);
    if (reqId !== _previewReqId) return;
    const lines = text.split(/\r?\n/);
    const svg = buildSvgFromFont(font, lines, collectIconOpts());
    if (reqId !== _previewReqId) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    revokePreviewUrl();
    _previewObjectUrl = url;
    preview.src = url;
  } catch (e) {
    if (reqId !== _previewReqId) return;
    console.warn("pathify preview failed", e);
    revokePreviewUrl();
    preview.src = build();
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
