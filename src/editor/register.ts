import { charsetForCount, DYNAMIC_CHARSET } from "../charset";
import { $textarea, $select } from "./dom";
import { isGoogleFont } from "./fonts";
import { buildPack } from "./packbuild";
import { buildSvgFromFont, buildVerticalSvgFromFont, ensureFont } from "./pathify";
import { buildSvgFromTex } from "./mathify";
import {
  build,
  collectIconOpts,
  currentDynamicKeyword,
  currentFontValue,
  effectiveTextLines,
  isLiveContent,
  isMathMode,
  isVerticalMode,
  isWrapMode,
} from "./state";
import { getTurnstileToken } from "./turnstile";

export const registeredPaths = new Set<string>();
/** 登録済みグリフパックのキー (family|weight|charset)。パスとは別の粒度 */
export const registeredPacks = new Set<string>();

export type ProgressCb = (msg: string) => void;

/**
 * 何を登録すべきか。
 *   - "svg":  完成した SVG を 1 URL 1 枚で R2 へ (通常の Google Fonts / 数式モード)
 *   - "pack": グリフ集合を R2 へ (countdown / 動的キーワード。内容が毎回変わるため)
 *   - null:   登録不要、または登録しても引かれない組み合わせ
 */
export function registrationKind(): "svg" | "pack" | null {
  const live = isLiveContent();
  // 数式モードは MathJax の出力を丸ごと保存する仕組みなので、内容が毎回変わる
  // パスには載せられない (登録しても引かれない)。
  if (isMathMode()) return live ? null : "svg";
  if (!isGoogleFont(currentFontValue())) return null;
  return live ? "pack" : "svg";
}

export function needsRegistration(): boolean {
  return registrationKind() !== null;
}

/** 今のフォームの状態に対応する登録が済んでいるか */
export function isCurrentRegistered(): boolean {
  const kind = registrationKind();
  if (kind === "pack") return registeredPacks.has(currentPackKey());
  if (kind === "svg") return registeredPaths.has(build());
  return false;
}

/**
 * パックに含める文字集合。**Worker 側と同じ関数を使うことが前提**で、
 * ずれるとキーがずれて永久に未登録扱いになる (src/charset.ts のコメント参照)。
 */
function currentCharset(): string {
  return currentDynamicKeyword() !== null
    ? DYNAMIC_CHARSET
    : charsetForCount(effectiveTextLines());
}

function currentPackKey(): string {
  return [currentFontValue(), $select("weight").value, currentCharset()].join(
    "|",
  );
}

export async function registerCurrentPath(onProgress?: ProgressCb): Promise<void> {
  const kind = registrationKind();
  if (kind === null) return;
  if (kind === "pack") return registerCurrentPack(onProgress);

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
      ? buildVerticalSvgFromFont(font, lines, collectIconOpts(), isWrapMode())
      : buildSvgFromFont(font, lines, collectIconOpts(), isWrapMode());
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

/**
 * グリフパックを登録する。
 *
 * 登録するのは色やサイズを含まない「そのフォント・ウェイトで、この文字集合ぶんの
 * グリフ」だけなので、配色や余白をいじっても登録し直す必要はない。
 */
async function registerCurrentPack(onProgress?: ProgressCb): Promise<void> {
  const packKey = currentPackKey();
  if (registeredPacks.has(packKey)) return;

  const family = currentFontValue();
  const weight = $select("weight").value;
  const charset = currentCharset();

  onProgress?.("フォント取得中...");
  // charset を text として渡すことで、Google Fonts 側で必要な字だけに絞られる
  const font = await ensureFont(family, weight, charset);

  onProgress?.("Path 化中...");
  const pack = buildPack(font, charset);

  onProgress?.("認証中...");
  const token = await getTurnstileToken();
  if (!token) {
    throw new Error("Turnstile 認証失敗。ページを再読み込みしてください。");
  }

  onProgress?.("登録中...");
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind: "pack",
      family,
      weight,
      charset,
      pack,
      turnstileToken: token,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("登録失敗 (" + res.status + "): " + body.slice(0, 120));
  }
  registeredPacks.add(packKey);
}
