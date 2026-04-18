import { describe, it, expect } from "vitest";
import { renderSvg } from "../src/svg";
import { parsePath } from "../src/parser";

describe("renderSvg", () => {
  it("基本形が生成される", () => {
    const parsed = parsePath("/Hello.svg")!;
    const svg = renderSvg(parsed.text, parsed.options);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Hello");
    expect(svg).toContain('width="300"');
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
