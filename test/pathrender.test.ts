import { describe, expect, it } from "vitest";
import { createPackFont, PACK_VERSION, type GlyphPack } from "../src/glyphpack";
import {
  buildSvgFromFont,
  buildVerticalSvgFromFont,
  toIconOpts,
  type IconOpts,
} from "../src/pathrender";
import type { IconOptions } from "../src/parser";
import { packTextDrawer } from "../src/textdraw";

// 全ての字が同じ四角、幅も一定の等幅パック。位置と寸法だけを見たいので字形は問わない。
function monoPack(chars: string): GlyphPack {
  const glyphs: GlyphPack["glyphs"] = {};
  let i = 1;
  for (const ch of new Set(chars)) {
    glyphs[ch] = { i: i++, adv: 1000, d: "M0 0L800 0L800 -700L0 -700Z" };
  }
  return { v: PACK_VERSION, upe: 1000, asc: 880, desc: -120, glyphs };
}

const baseOpts: IconOpts = {
  width: 600, height: 400, padding: 24, radius: 0, lh: 1.2,
  bg: "#ffffff", fg: "#000000", align: "center", size: null, rotate: 0,
};

/** defs のグリフ path から座標の最大絶対値を取る (フォントサイズに比例する) */
function glyphExtent(svg: string): number {
  const m = /<g id="[^"]+"><path d="([^"]*)"/.exec(svg);
  if (!m) return 0;
  return Math.max(...(m[1]!.match(/-?[\d.]+/g) ?? ["0"]).map(n => Math.abs(+n)));
}

function useXs(svg: string): number[] {
  return [...svg.matchAll(/<use href="#[^"]+" x="([-\d.]+)"/g)].map(m => +m[1]!);
}

describe("buildSvgFromFont (グリフパック経由)", () => {
  it("<use> と <defs> のグリフ定義で組む", () => {
    const font = createPackFont(monoPack("あと日0123456789 "));
    const svg = buildSvgFromFont(font, ["あと5日"], baseOpts);
    expect(svg).toContain("<defs>");
    expect(svg).toContain("<use href=");
    expect(useXs(svg).length).toBe(4);
    // <text> ではなくパスで描いている
    expect(svg).not.toContain("<text");
  });

  it("同じ字は defs を共有する", () => {
    const font = createPackFont(monoPack("AB"));
    const svg = buildSvgFromFont(font, ["ABABAB"], baseOpts);
    expect(useXs(svg).length).toBe(6);
    expect((svg.match(/<g id="g\d+">/g) ?? []).length).toBe(2);
  });

  it("桁数が増えると自動フィットで字が小さくなる", () => {
    const font = createPackFont(monoPack("あと日0123456789 "));
    const short = buildSvgFromFont(font, ["あと9日"], baseOpts);
    const long = buildSvgFromFont(font, ["あと999日"], baseOpts);
    expect(glyphExtent(long)).toBeLessThan(glyphExtent(short));
  });

  it("桁数が変わっても枠内に収まる", () => {
    const font = createPackFont(monoPack("あと日0123456789 "));
    for (const n of ["0", "9", "99", "365", "9999"]) {
      const svg = buildSvgFromFont(font, [`あと${n}日`], baseOpts);
      const xs = useXs(svg);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(baseOpts.padding - 1);
      expect(Math.max(...xs)).toBeLessThanOrEqual(baseOpts.width);
    }
  });

  it("同じ入力なら出力が一致する (決定的)", () => {
    const font = createPackFont(monoPack("あと日0123456789 "));
    const a = buildSvgFromFont(font, ["あと42日"], baseOpts);
    const b = buildSvgFromFont(font, ["あと42日"], baseOpts);
    expect(a).toBe(b);
  });

  it("縦書きでも <use> で組める", () => {
    const font = createPackFont(monoPack("あと日0123456789 "));
    const svg = buildVerticalSvgFromFont(font, ["あと5日"], baseOpts);
    expect(svg).toContain("<use href=");
    expect(svg).not.toContain("<text");
  });

  it("色・角丸・グラデのオプションが効く", () => {
    const font = createPackFont(monoPack("A"));
    const svg = buildSvgFromFont(font, ["A"], {
      ...baseOpts, fg: "#ff0000", bg: "#0000ff", radius: 24, gradTo: "#00ff00",
    });
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('rx="24"');
    expect(svg).toContain("<linearGradient");
  });
});

describe("toIconOpts", () => {
  it("パス由来の IconOptions を組版用へ写す", () => {
    const src: IconOptions = {
      bg: "#111", fg: "#eee", width: 300, height: 200, fontSize: 48,
      fontFamily: "X", fontWeight: "500", padding: 12, radius: 8,
      lineHeight: 1.5, letterSpacing: 3, align: "left", rotate: 90,
      shadowBlur: 6, strokeWidth: 2, stroke: "#f00", gradAngle: 45,
      gradTo: "#0f0", shadow: "on", shadowColor: "#00f",
    };
    const o = toIconOpts(src);
    expect(o).toEqual({
      width: 300, height: 200, padding: 12, radius: 8, lh: 1.5,
      bg: "#111", fg: "#eee", align: "left", size: 48, rotate: 90,
      shadow: "on", shadowBlur: 6, shadowColor: "#00f",
      stroke: "#f00", strokeWidth: 2, gradTo: "#0f0", gradAngle: 45,
    });
  });

  it("fontSize 未指定は自動フィット (null) になる", () => {
    const src = { fontSize: undefined } as unknown as IconOptions;
    expect(toIconOpts({ ...src, lineHeight: 1.2 } as IconOptions).size).toBe(null);
  });
});

describe("packTextDrawer", () => {
  const font = createPackFont(monoPack("AB"));

  it("advance の合計から中央揃えする", () => {
    const drawer = packTextDrawer(font);
    // 1000 units の字が 2 つ、fontSize 100 なので合計幅 200。cx=500 の左端は 400
    const out = drawer.draw("AB", 500, 300, { fill: "#000", fontSize: 100 });
    expect(useXs(out)).toEqual([400, 500]);
  });

  it("fill と opacity を親 <g> に載せる", () => {
    const drawer = packTextDrawer(font);
    const out = drawer.draw("A", 0, 0, {
      fill: "#abcdef", fontSize: 50, opacity: 0.65,
    });
    expect(out).toContain('fill="#abcdef"');
    expect(out).toContain('opacity="0.65"');
  });

  it("同じ字を同じサイズで描くと defs は 1 つ", () => {
    const drawer = packTextDrawer(font);
    drawer.draw("AAA", 0, 0, { fill: "#000", fontSize: 50 });
    expect((drawer.defs().match(/<g id=/g) ?? []).length).toBe(1);
  });

  it("サイズが違えば別の defs になる", () => {
    const drawer = packTextDrawer(font);
    drawer.draw("A", 0, 0, { fill: "#000", fontSize: 50 });
    drawer.draw("A", 0, 0, { fill: "#000", fontSize: 80 });
    expect((drawer.defs().match(/<g id=/g) ?? []).length).toBe(2);
  });

  it("空文字は何も描かない", () => {
    expect(packTextDrawer(font).draw("", 0, 0, { fill: "#000", fontSize: 10 }))
      .toBe("");
  });
});
