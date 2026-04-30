import { describe, it, expect } from "vitest";
import { isGoogleFontCandidate, parsePath, parseText } from "../src/parser";

describe("parseText", () => {
  it("\\n を改行として扱う", () => {
    expect(parseText("B4\\nゼミ")).toEqual(["B4", "ゼミ"]);
  });
  it("改行なしはそのまま", () => {
    expect(parseText("Hello")).toEqual(["Hello"]);
  });
});

describe("parsePath", () => {
  it("テキストのみ", () => {
    const r = parsePath("/B4ゼミ.svg")!;
    expect(r.text).toEqual(["B4ゼミ"]);
    expect(r.options.bg).toBe("#ffffff");
  });

  it(".svg 拡張子はオプション", () => {
    const r = parsePath("/Hello")!;
    expect(r.text).toEqual(["Hello"]);
  });

  it("オプションをセグメントで指定", () => {
    const r = parsePath("/bg-red/fg-white/Hello.svg")!;
    expect(r.options.bg).toBe("red");
    expect(r.options.fg).toBe("white");
  });

  it("1セグメントにカンマ区切りで複数オプション", () => {
    const r = parsePath("/bg:red,fg:white/Hello.svg")!;
    expect(r.options.bg).toBe("red");
    expect(r.options.fg).toBe("white");
  });

  it("区切りは - = : のどれでもOK", () => {
    const r = parsePath("/bg=red,fg:white/size-72/Hi.svg")!;
    expect(r.options.bg).toBe("red");
    expect(r.options.fg).toBe("white");
    expect(r.options.fontSize).toBe(72);
  });

  it("hex色は#を自動補完", () => {
    const r = parsePath("/bg-1e293b/fg-fff/A.svg")!;
    expect(r.options.bg).toBe("#1e293b");
    expect(r.options.fg).toBe("#fff");
  });

  it("日本語キーエイリアス", () => {
    const r = parsePath("/背景-red/文字色-white/A.svg")!;
    expect(r.options.bg).toBe("red");
    expect(r.options.fg).toBe("white");
  });

  it("未知のキーは無視", () => {
    const r = parsePath("/unknown-foo/bg-red/A.svg")!;
    expect(r.options.bg).toBe("red");
  });

  it("改行込みテキスト", () => {
    const r = parsePath("/bg-111/B4\\nゼミ.svg")!;
    expect(r.text).toEqual(["B4", "ゼミ"]);
    expect(r.options.bg).toBe("#111");
  });

  it("不正な色は無視してデフォルト", () => {
    const r = parsePath("/bg-@@@/A.svg")!;
    expect(r.options.bg).toBe("#ffffff");
  });

  it("空パスはnull", () => {
    expect(parsePath("/")).toBeNull();
  });

  it("URLエンコードされた日本語をデコード", () => {
    const r = parsePath("/" + encodeURIComponent("B4ゼミ") + ".svg")!;
    expect(r.text).toEqual(["B4ゼミ"]);
  });

  it("align の指定", () => {
    const r = parsePath("/align-left/Hi.svg")!;
    expect(r.options.align).toBe("left");
  });

  it("font-serif はショートカットで展開される", () => {
    const r = parsePath("/font-serif/Hi.svg")!;
    expect(r.options.fontFamily).toMatch(/Mincho|serif/);
  });

  it("font-mono はショートカットで展開される", () => {
    const r = parsePath("/font-mono/Hi.svg")!;
    expect(r.options.fontFamily).toMatch(/monospace/);
  });

  it("未知のフォント名はそのまま使われる", () => {
    const r = parsePath("/font-Impact/Hi.svg")!;
    expect(r.options.fontFamily).toBe("Impact");
  });

  it("tz オプションは%2Fエンコードで /を表現", () => {
    const r = parsePath("/tz-Asia%2FTokyo/today.svg")!;
    expect(r.options.timezone).toBe("Asia/Tokyo");
  });

  it("tz ショートカット jst → Asia/Tokyo", () => {
    const r = parsePath("/tz-jst/today.svg")!;
    expect(r.options.timezone).toBe("Asia/Tokyo");
  });

  it("tz ショートカット et → America/New_York", () => {
    const r = parsePath("/tz-et/today.svg")!;
    expect(r.options.timezone).toBe("America/New_York");
  });

  it("rawFontValue: Google Fonts 候補名を保持", () => {
    const r = parsePath("/font-Roboto/Hi.svg")!;
    expect(r.rawFontValue).toBe("Roboto");
  });

  it("rawFontValue: ショートカットも生値を保持（候補判定は別関数）", () => {
    const r = parsePath("/font-sans/Hi.svg")!;
    expect(r.rawFontValue).toBe("sans");
  });

  it("rawFontValue: font指定なしは undefined", () => {
    const r = parsePath("/Hi.svg")!;
    expect(r.rawFontValue).toBeUndefined();
  });

  it("math セグメントを検出する", () => {
    const r = parsePath("/math/y=x^2.svg")!;
    expect(r.math).toBe(true);
    expect(r.text.join("")).toBe("y=x^2");
  });

  it("tex は math のエイリアス", () => {
    const r = parsePath("/tex/y=x^2.svg")!;
    expect(r.math).toBe(true);
  });

  it("math は他オプションと並列に並べられる", () => {
    const r = parsePath("/bg-fff/math/fg-000/E=mc^2.svg")!;
    expect(r.math).toBe(true);
    expect(r.options.bg).toBe("#fff");
    expect(r.options.fg).toBe("#000");
  });

  it("math 指定がなければ math=false", () => {
    const r = parsePath("/Hello.svg")!;
    expect(r.math).toBe(false);
  });

  it("math セグメントは大文字小文字を区別しない", () => {
    const r = parsePath("/MATH/x.svg")!;
    expect(r.math).toBe(true);
  });
});

describe("isGoogleFontCandidate", () => {
  it("ショートカット名はfalse", () => {
    expect(isGoogleFontCandidate("sans")).toBe(false);
    expect(isGoogleFontCandidate("serif")).toBe(false);
    expect(isGoogleFontCandidate("rounded")).toBe(false);
    expect(isGoogleFontCandidate("mono")).toBe(false);
    expect(isGoogleFontCandidate("gothic")).toBe(false);
    expect(isGoogleFontCandidate("mincho")).toBe(false);
  });

  it("ショートカット以外はtrue", () => {
    expect(isGoogleFontCandidate("Roboto")).toBe(true);
    expect(isGoogleFontCandidate("Noto Sans JP")).toBe(true);
    expect(isGoogleFontCandidate("Impact")).toBe(true);
  });

  it("undefined/空文字はfalse", () => {
    expect(isGoogleFontCandidate(undefined)).toBe(false);
    expect(isGoogleFontCandidate("")).toBe(false);
  });

  it("大文字小文字を無視してショートカット判定", () => {
    expect(isGoogleFontCandidate("SANS")).toBe(false);
    expect(isGoogleFontCandidate("Sans")).toBe(false);
  });
});
