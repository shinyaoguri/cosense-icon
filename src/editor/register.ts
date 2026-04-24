import { $textarea, $select } from "./dom";
import { isGoogleFont } from "./fonts";
import { buildSvgFromFont, ensureFont } from "./pathify";
import { build, collectIconOpts, currentFontValue } from "./state";
import { getTurnstileToken } from "./turnstile";

export const registeredPaths = new Set<string>();

export type ProgressCb = (msg: string) => void;

export async function registerCurrentPath(onProgress?: ProgressCb): Promise<void> {
  const family = currentFontValue();
  if (!isGoogleFont(family)) return;

  const pathname = build();
  if (registeredPaths.has(pathname)) return;

  const text = $textarea("text").value || "sample";
  const lines = text.split(/\r?\n/);
  const weight = $select("weight").value;

  onProgress?.("フォント取得中...");
  const font = await ensureFont(family, weight, text);

  onProgress?.("Path 化中...");
  const svg = buildSvgFromFont(font, lines, collectIconOpts());

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
