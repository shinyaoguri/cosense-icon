import { describe, it, expect } from "vitest";
import { renderSvg, renderVerticalSvg } from "../src/svg";
import { parsePath } from "../src/parser";

describe("renderSvg", () => {
  it("基本形が生成される", () => {
    const parsed = parsePath("/Hello.svg")!;
    const svg = renderSvg(parsed.text, parsed.options);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Hello");
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="400"');
  });

  it("XSS対策: <script> がエスケープされる", () => {
    const parsed = parsePath("/" + encodeURIComponent("<script>") + ".svg")!;
    const svg = renderSvg(parsed.text, parsed.options);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("複数行は tspan で描画", () => {
    const parsed = parsePath("/B4\\nゼミ.svg")!;
    const svg = renderSvg(parsed.text, parsed.options);
    expect((svg.match(/<tspan /g) ?? []).length).toBe(2);
  });

  it("角丸指定で rx, ry が付く", () => {
    const parsed = parsePath("/radius-24/A.svg")!;
    const svg = renderSvg(parsed.text, parsed.options);
    expect(svg).toContain('rx="24"');
  });
});

describe("renderVerticalSvg", () => {
  it("writing-mode: vertical-rl が出力される", () => {
    const parsed = parsePath("/vertical/縦書き.svg")!;
    const svg = renderVerticalSvg(parsed.text, parsed.options);
    expect(svg).toContain("writing-mode:vertical-rl");
    expect(svg).toContain("text-orientation:mixed");
    expect(svg).toContain("縦書き");
  });

  it("複数行は列ごとに <text> を分けて配置", () => {
    const parsed = parsePath("/vertical/B4\\nゼミ.svg")!;
    const svg = renderVerticalSvg(parsed.text, parsed.options);
    expect((svg.match(/<text /g) ?? []).length).toBe(2);
  });

  it("半角数字 1〜2 桁は text-combine-upright (TCY) で組まれる", () => {
    const parsed = parsePath("/vertical/2026年.svg")!;
    const svg = renderVerticalSvg(parsed.text, parsed.options);
    // 4 桁 (2026) はそのまま (TCY 対象外) だが、後に 2 桁数字を含むケースも検証
    const parsed2 = parsePath("/vertical/" + encodeURIComponent("第3章") + ".svg")!;
    const svg2 = renderVerticalSvg(parsed2.text, parsed2.options);
    expect(svg2).toContain("text-combine-upright");
    // 2026 は 4 桁なので TCY されない
    expect(svg).not.toContain("text-combine-upright:all");
  });

  it("背景色とテキスト色が反映される", () => {
    const parsed = parsePath("/vertical/bg-1e293b/fg-fff/縦.svg")!;
    const svg = renderVerticalSvg(parsed.text, parsed.options);
    expect(svg).toContain("#1e293b");
    expect(svg).toContain("#fff");
  });
});

describe("renderSvg (wrap モード)", () => {
  it("wrap=false なら 1 行のまま (現状維持)", () => {
    const parsed = parsePath(
      "/" + encodeURIComponent("これは長い文章です。改行されません。") + ".svg",
    )!;
    const svg = renderSvg(parsed.text, parsed.options, false);
    expect((svg.match(/<tspan /g) ?? []).length).toBe(1);
  });

  it("wrap=true で長い CJK 文章は複数行に分割される", () => {
    const longText =
      "これは大変長い文章でして自動改行機能を試すためのものです。長い文章を入れた時に幅に応じて適切に改行されるかどうかを確認します。";
    const parsed = parsePath("/" + encodeURIComponent(longText) + ".svg")!;
    const svg = renderSvg(parsed.text, parsed.options, true);
    const lineCount = (svg.match(/<tspan /g) ?? []).length;
    expect(lineCount).toBeGreaterThan(1);
  });

  it("wrap=true でも短い文章は 1 行", () => {
    const parsed = parsePath("/Hello.svg")!;
    const svg = renderSvg(parsed.text, parsed.options, true);
    expect((svg.match(/<tspan /g) ?? []).length).toBe(1);
  });

  it("wrap=true ラテン語は単語境界で改行", () => {
    const longText = "This is a fairly long English sentence that should wrap nicely at word boundaries.";
    const parsed = parsePath("/" + encodeURIComponent(longText) + ".svg")!;
    const svg = renderSvg(parsed.text, parsed.options, true);
    // 単語が途中で切れていないことを確認 (\w が tspan 末尾にあるべきだが、
    // これは厳密ではないので緩く: tspan の中身が空白で始まっていない)
    const tspanContents = [...svg.matchAll(/<tspan [^>]*>([^<]*)<\/tspan>/g)].map(
      m => m[1]!,
    );
    expect(tspanContents.length).toBeGreaterThan(1);
    for (const c of tspanContents) {
      expect(c.startsWith(" ")).toBe(false);
      expect(c.endsWith(" ")).toBe(false);
    }
  });

  it("wrap=true: 明示 size 指定でも幅に応じて改行する", () => {
    const longText = "これは大変長い文章でして自動改行機能を試すためのものです。";
    const parsed = parsePath("/size-40/" + encodeURIComponent(longText) + ".svg")!;
    const svg = renderSvg(parsed.text, parsed.options, true);
    expect((svg.match(/<tspan /g) ?? []).length).toBeGreaterThan(1);
  });
});
