import { describe, expect, it } from "vitest";
// @ts-expect-error — .mjs ビルドスクリプトを型なしで取り込む
import { buildEditorHtml } from "../scripts/build-editor.mjs";

// エディタ HTML のビルド健全性を検証する。
// 過去に build-editor.mjs が String.replace の特殊置換パターン ($&/$$ 等) で
// minify 後の bundle を破壊し、本番エディタ JS 全体が SyntaxError で動かなくなる
// 事故があった。dev では顕在化せず、ブラウザで minify 版を動かすまで気付けなかった。
// このテストは dev/prod 両方のビルド出力を毎回検証してその再発を防ぐ。
describe("editor build (dev/prod 両方)", () => {
  for (const dev of [true, false]) {
    const label = dev ? "dev" : "prod(minified)";

    it(`埋め込み後の inline script が JS として構文的に有効: ${label}`, async () => {
      const { js, html } = await buildEditorHtml({ dev });
      // HTML に実際に埋め込まれた (= ブラウザが実行する) inline を取り出して検証。
      const open = `<script>${js.slice(0, 40)}`;
      const start = html.indexOf(open);
      expect(start).toBeGreaterThanOrEqual(0);
      const bodyStart = start + "<script>".length;
      const bodyEnd = html.indexOf("</script>", bodyStart);
      const inline = html.slice(bodyStart, bodyEnd);
      // new Function は parse のみ (実行しない) ため、ブラウザ API 無しで
      // 構文エラー・切断だけを検出できる。壊れていれば SyntaxError で throw。
      expect(() => new Function(inline)).not.toThrow();
    });

    it(`bundle が HTML に逐語的に埋め込まれている (改変されていない): ${label}`, async () => {
      const { js, html } = await buildEditorHtml({ dev });
      // $ 特殊置換などで 1 文字でも変わればここで落ちる (今回の事故の直撃点)。
      expect(html).toContain(`<script>${js}</script>`);
    });

    it(`主要シンボルが残存している: ${label}`, async () => {
      const { html } = await buildEditorHtml({ dev });
      // Turnstile コールバックはグローバル登録される想定。init が丸ごと
      // 落ちる/tree-shake され過ぎる回帰の簡易検知。
      expect(html).toContain("onloadTurnstileCallback");
    });
  }
});
