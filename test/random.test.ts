import { describe, it, expect } from "vitest";
import { contrastRatio, deterministicPalette, hexToRgb } from "../src/random";
import { parsePath } from "../src/parser";

describe("deterministicPalette", () => {
  it("同じ入力なら同じ結果を返す", () => {
    const a = deterministicPalette("hoge");
    const b = deterministicPalette("hoge");
    expect(a).toEqual(b);
  });

  it("異なる入力は（ほぼ常に）異なる結果を返す", () => {
    const a = deterministicPalette("hoge");
    const b = deterministicPalette("fuga");
    expect(a).not.toEqual(b);
  });

  it("WCAG AA (>= 4.5:1) を満たす", () => {
    const samples = [
      "hoge",
      "fuga",
      "piyo",
      "B4ゼミ",
      "a",
      "",
      "Hello World",
      "日本語テスト",
      "🎉絵文字",
    ];
    for (const s of samples) {
      const { bg, fg } = deterministicPalette(s);
      const ratio = contrastRatio(hexToRgb(bg), hexToRgb(fg));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("6桁 hex を返す", () => {
    const { bg, fg } = deterministicPalette("hoge");
    expect(bg).toMatch(/^#[0-9a-f]{6}$/);
    expect(fg).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("parsePath with random", () => {
  it("/random/ 単独セグメントで random フラグが立つ", () => {
    const r = parsePath("/random/hoge.svg")!;
    expect(r.random).toBe(true);
    expect(r.text).toEqual(["hoge"]);
  });

  it("random なしなら false", () => {
    const r = parsePath("/hoge.svg")!;
    expect(r.random).toBe(false);
  });

  it("random と他オプションの併用", () => {
    const r = parsePath("/random/radius-24/size-72/hoge.svg")!;
    expect(r.random).toBe(true);
    expect(r.options.radius).toBe(24);
    expect(r.options.fontSize).toBe(72);
  });

  it("random の位置は任意（後ろでもOK）", () => {
    const r = parsePath("/radius-24/random/hoge.svg")!;
    expect(r.random).toBe(true);
    expect(r.options.radius).toBe(24);
  });

  it("大文字小文字を区別しない", () => {
    const r = parsePath("/RANDOM/hoge.svg")!;
    expect(r.random).toBe(true);
  });

  it("explicit Set で明示指定を追跡", () => {
    const r = parsePath("/bg-red/random/hoge.svg")!;
    expect(r.explicit.has("bg")).toBe(true);
    expect(r.explicit.has("fg")).toBe(false);
    expect(r.random).toBe(true);
  });
});
