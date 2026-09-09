import { describe, expect, it } from "vitest";
import {
  createPackFont,
  PACK_VERSION,
  PackValidationError,
  scaleGlyphPath,
  validatePack,
  VERT_KEY_PREFIX,
  type GlyphPack,
} from "../src/glyphpack";

// upe = 1000 の小さな手書きパック。数値が読める大きさにしてある。
function samplePack(over: Partial<GlyphPack> = {}): GlyphPack {
  return {
    v: PACK_VERSION,
    upe: 1000,
    asc: 880,
    desc: -120,
    glyphs: {
      A: { i: 1, adv: 600, d: "M0 0L500 0L500 -700L0 -700Z" },
      B: { i: 2, adv: 400, d: "M0 0L300 -700Z" },
      // liga クラスタ (2 文字で 1 グリフ)
      AB: { i: 3, adv: 800, d: "M0 0L700 -700Z" },
      // 縦書きの置換先 (本文の shaping には出てこない)
      [`${VERT_KEY_PREFIX}9`]: { i: 9, adv: 600, d: "M0 0L100 -100Z" },
    },
    vert: { "1": 9 },
    kern: { AB: -50 },
    ...over,
  };
}

describe("scaleGlyphPath", () => {
  it("一様拡大と平行移動を座標へ反映する", () => {
    expect(scaleGlyphPath("M0 0L100 -200Z", 0.5, 10, 20)).toBe(
      "M10 20L60 -80Z",
    );
  });

  it("scale=1 / 移動なしなら座標は変わらない", () => {
    expect(scaleGlyphPath("M0 0L100 -200Z", 1, 0, 0)).toBe("M0 0L100 -200Z");
  });

  it("Q / C の制御点もまとめて変換する", () => {
    expect(scaleGlyphPath("M0 0Q10 10 20 20C1 2 3 4 5 6", 2, 0, 0)).toBe(
      "M0 0Q20 20 40 40C2 4 6 8 10 12",
    );
  });

  // opentype.js は負数の前の区切りを省く。空白で分割すると "79-37" が
  // 1 トークンになり、座標が全部 NaN になる (実際に描画が空になった)。
  it("負数の前の区切りが無い形を読める", () => {
    expect(scaleGlyphPath("M79-37L79-97Z", 1, 0, 0)).toBe("M79 -37L79 -97Z");
    expect(scaleGlyphPath("Q79-37 79-97", 1, 0, 0)).toBe("Q79 -37 79 -97");
    expect(scaleGlyphPath("M639 98L539-48", 0.5, 0, 0)).toBe(
      "M319.5 49L269.5 -24",
    );
  });

  it("NaN を出さない (実フォント由来の並びで確認)", () => {
    const real =
      "M639 98L539 48Q539 48 537 42Q534 35 534 34L534 34L428 70L392 53" +
      "Q331 80 266 80L266 80Q216 80 173 61Q130 41 105 2Q79-37 79-97Z";
    expect(scaleGlyphPath(real, 0.1, 5, 5)).not.toContain("NaN");
  });

  it("小数・指数表記も読める", () => {
    expect(scaleGlyphPath("M.5-.5Z", 2, 0, 0)).toBe("M1 -1Z");
    expect(scaleGlyphPath("M1e2 -1e1Z", 1, 0, 0)).toBe("M100 -10Z");
  });

  it("空の d は空文字", () => {
    expect(scaleGlyphPath("", 2, 1, 1)).toBe("");
  });

  it("-0 を生まない", () => {
    expect(scaleGlyphPath("M0 0Z", 0.5, -0, -0)).toBe("M0 0Z");
  });
});

describe("createPackFont", () => {
  const font = createPackFont(samplePack());

  it("OpenTypeFont のメトリクスを返す", () => {
    expect(font.unitsPerEm).toBe(1000);
    expect(font.ascender).toBe(880);
    expect(font.descender).toBe(-120);
  });

  it("liga クラスタを最長一致で 1 グリフにする", () => {
    const glyphs = font.stringToGlyphs!("AB");
    expect(glyphs.length).toBe(1);
    expect(glyphs[0]!.index).toBe(3);
  });

  it("クラスタにならない並びは 1 文字ずつ", () => {
    const glyphs = font.stringToGlyphs!("BA");
    expect(glyphs.map(g => g.index)).toEqual([2, 1]);
  });

  it("advance にカーニングが乗る", () => {
    // "BA" は kern に載っていないので 400 + 600 = 1000 units = 1em
    expect(font.getAdvanceWidth("BA", 1000)).toBe(1000);
    // "A" 単体は 600
    expect(font.getAdvanceWidth("A", 1000)).toBe(600);
  });

  it("カーニングは左右のキーで引かれる", () => {
    const [a, b] = [font.charToGlyph!("A"), font.charToGlyph!("B")];
    expect(font.getKerningValue!(a, b)).toBe(-50);
    expect(font.getKerningValue!(b, a)).toBe(0);
  });

  it("glyph.getPath がサイズに応じて拡大される", () => {
    const d = font.charToGlyph!("A").getPath(0, 0, 500).toPathData(1);
    // upe=1000 の半分なので座標も半分
    expect(d).toBe("M0 0L250 0L250 -350L0 -350Z");
  });

  it("getPath は原点を平行移動できる", () => {
    const d = font.charToGlyph!("B").getPath(100, 50, 1000).toPathData(1);
    expect(d).toBe("M100 50L400 -650Z");
  });

  it("vert 置換先は index から引けるが shaping には出てこない", () => {
    expect(font.glyphs!.get(9).index).toBe(9);
    const subs = font.substitution!.getSingle("vert")!;
    expect(subs).toEqual([{ sub: 1, by: 9 }]);
    // 置換先のキーは本文としては解釈されない
    const glyphs = font.stringToGlyphs!(`${VERT_KEY_PREFIX}9`);
    expect(glyphs.every(g => g.index !== 9)).toBe(true);
  });

  it("vert 以外の feature には何も返さない", () => {
    expect(font.substitution!.getSingle("liga")).toEqual([]);
  });

  it("未収録の文字は幅ゼロの空グリフになる (豆腐を出さない)", () => {
    const g = font.charToGlyph!("Z");
    expect(g.advanceWidth).toBe(0);
    expect(g.getPath(0, 0, 100).toPathData(1)).toBe("");
  });
});

describe("validatePack", () => {
  const ok = (over: Partial<GlyphPack>) => validatePack(samplePack(over));
  const ng = (input: unknown) => () => validatePack(input);

  it("正しいパックはそのまま通る", () => {
    const p = validatePack(samplePack());
    expect(p.upe).toBe(1000);
    expect(Object.keys(p.glyphs).length).toBe(4);
  });

  it("path データに SVG を仕込めない", () => {
    for (const evil of [
      '"/><script>alert(1)</script><path d="',
      "M0 0L1 1Z\"/><rect onload=\"x",
      "url(#x)",
      "M0 0<",
    ]) {
      expect(
        ng(samplePack({ glyphs: { A: { i: 1, adv: 600, d: evil } } })),
      ).toThrow(PackValidationError);
    }
  });

  it("正当な path データは弾かない", () => {
    expect(() =>
      ok({ glyphs: { A: { i: 1, adv: 6, d: "M-1.5 2e3L4,5Q1 2 3 4C1 2 3 4 5 6Z" } } }),
    ).not.toThrow();
  });

  it("バージョン違いを弾く", () => {
    expect(ng({ ...samplePack(), v: 99 })).toThrow(/version/);
  });

  it("グリフが空なら弾く", () => {
    expect(ng({ ...samplePack(), glyphs: {} })).toThrow(/empty/);
  });

  it("グリフ数の上限を超えたら弾く", () => {
    const glyphs: Record<string, { i: number; adv: number; d: string }> = {};
    for (let i = 0; i < 513; i++) glyphs[`c${i}`] = { i, adv: 1, d: "M0 0Z" };
    expect(ng({ ...samplePack(), glyphs })).toThrow(/too many/);
  });

  it("index が整数でなければ弾く", () => {
    expect(ng(samplePack({ glyphs: { A: { i: 1.5, adv: 1, d: "" } } }))).toThrow(
      /integer/,
    );
  });

  it("upe が 0 以下なら弾く", () => {
    expect(ng({ ...samplePack(), upe: 0 })).toThrow(/positive/);
  });

  it("数値であるべき所が文字列なら弾く", () => {
    expect(ng({ ...samplePack(), asc: "880" })).toThrow(/finite/);
    expect(
      ng(samplePack({ glyphs: { A: { i: 1, adv: "600", d: "" } } as never })),
    ).toThrow(/finite/);
  });

  it("オブジェクトでない入力を弾く", () => {
    for (const bad of [null, 42, "pack", []]) {
      expect(ng(bad)).toThrow(PackValidationError);
    }
  });

  it("vert / kern が無くても通る", () => {
    const p = validatePack({
      v: PACK_VERSION,
      upe: 1000,
      asc: 880,
      desc: -120,
      glyphs: { A: { i: 1, adv: 600, d: "M0 0Z" } },
    });
    expect(p.vert).toBeUndefined();
    expect(p.kern).toBeUndefined();
  });

  it("知らないフィールドは落とす", () => {
    const p = validatePack({ ...samplePack(), evil: "x" } as never);
    expect("evil" in p).toBe(false);
  });
});
