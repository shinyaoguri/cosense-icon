import { $textarea, $select } from "./dom";
import { isGoogleFont } from "./fonts";
import { buildSvgFromFont, buildVerticalSvgFromFont, ensureFont } from "./pathify";
import { buildSvgFromTex } from "./mathify";
import {
  build,
  collectIconOpts,
  currentFontValue,
  isMathMode,
  isVerticalMode,
} from "./state";
import { getTurnstileToken } from "./turnstile";

export const registeredPaths = new Set<string>();

export type ProgressCb = (msg: string) => void;

/** 登録対象 (Google Fonts または 数式モード) かどうか */
export function needsRegistration(): boolean {
  return isMathMode() || isGoogleFont(currentFontValue());
}

export async function registerCurrentPath(onProgress?: ProgressCb): Promise<void> {
  if (!needsRegistration()) return;

  const pathname = build();
  if (registeredPaths.has(pathname)) return;

  let svg: string;

  if (isMathMode()) {
    const text = $textarea("text").value;
    if (!text.trim()) throw new Error("数式が空です");
    onProgress?.("MathJax 読み込み中...");
    onProgress?.("数式を SVG パスに変換中...");
    svg = await buildSvgFromTex(text, collectIconOpts());
  } else {
    const family = currentFontValue();
    const text = $textarea("text").value || "sample";
    const lines = text.split(/\r?\n/);
    const weight = $select("weight").value;

    onProgress?.("フォント取得中...");
    const font = await ensureFont(family, weight, text);

    onProgress?.("Path 化中...");
    svg = isVerticalMode()
      ? buildVerticalSvgFromFont(font, lines, collectIconOpts())
      : buildSvgFromFont(font, lines, collectIconOpts());
  }

  onProgress?.("認証中...");
  const token = await getTurnstileToken();
  if (!token) {
    throw new Error("Turnstile 認証失敗。ページを再読み込みしてください。");
  }

  onProgress?.("登録中...");
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pathname, svg, turnstileToken: token }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("登録失敗 (" + res.status + "): " + body.slice(0, 120));
  }
  registeredPaths.add(pathname);
}
