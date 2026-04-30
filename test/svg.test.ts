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
