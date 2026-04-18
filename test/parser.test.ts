import { describe, it, expect } from "vitest";
import { parsePath, parseText } from "../src/parser";

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
});
