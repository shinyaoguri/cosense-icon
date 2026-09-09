import { describe, expect, it } from "vitest";
import { charsetForCount, DYNAMIC_CHARSET, normalizeCharset } from "../src/charset";
import { renderDynamicSvg } from "../src/dynamic";
import type { IconOptions } from "../src/parser";
import type { DrawAttrs, TextDrawer } from "../src/textdraw";

describe("normalizeCharset", () => {
  it("重複を落としてコードポイント昇順に並べる", () => {
    expect(normalizeCharset("cba")).toBe("abc");
    expect(normalizeCharset("aabbcc")).toBe("abc");
  });

  it("並びが違っても同じ結果になる (キーの決定性)", () => {
    expect(normalizeCharset("日あ1")).toBe(normalizeCharset("1あ日"));
  });
});

describe("charsetForCount", () => {
  it("プレースホルダを除いた文字 + 数字と空白を含む", () => {
    const cs = charsetForCount(["あと{d}日"]);
    for (const ch of "あと日0123456789 ") expect(cs).toContain(ch);
    expect(cs).not.toContain("{");
    expect(cs).not.toContain("}");
    expect(cs).not.toContain("d");
  });

  it("{} / {n} / {days} も落とす", () => {
    for (const token of ["{}", "{n}", "{days}"]) {
      const cs = charsetForCount([`X${token}Y`]);
      expect(cs).toContain("X");
      expect(cs).toContain("Y");
      expect(cs).not.toContain("{");
      expect(cs).not.toContain("}");
    }
  });

  it("複数行をまとめて 1 つの集合にする", () => {
    const cs = charsetForCount(["あと", "{d}日"]);
    expect(cs).toContain("あ");
    expect(cs).toContain("日");
  });

  it("プレースホルダ無し (日数が末尾に付く形) でも空白を含む", () => {
    // substituteCountToken はプレースホルダが無いと " 12" のように空白区切りで足す
    expect(charsetForCount(["締切"])).toContain(" ");
  });
});

// DYNAMIC_CHARSET が実際の描画を賄えているかを、レンダラに描かせて確かめる。
// ここが崩れるとパックにグリフが足りず、その字だけ空白になる。
describe("DYNAMIC_CHARSET は 4 レンダラが描く文字を網羅する", () => {
  const opts: IconOptions = {
    bg: "#ffffff", fg: "#222222", width: 600, height: 400,
    fontFamily: "sans-serif", fontWeight: "700", padding: 24, radius: 0,
    lineHeight: 1.2, align: "center", rotate: 0, shadowBlur: 4,
    strokeWidth: 0, gradAngle: 135,
  };

  function collectDrawnChars(now: Date, tz: string): Set<string> {
    const seen = new Set<string>();
    const spy: TextDrawer = {
      draw(text: string, _cx: number, _y: number, _a: DrawAttrs) {
        for (const ch of text) seen.add(ch);
        return "";
      },
      defs: () => "",
    };
    for (const kw of ["today", "week", "month", "year"]) {
      renderDynamicSvg(kw, now, tz, opts, spy);
    }
    return seen;
  }

  it("1 年ぶんの日付・複数 TZ を通しても未収録の字が出ない", () => {
    const missing = new Set<string>();
    // 閏年を含む 400 日ぶんを 1 日ずつ (月末・年跨ぎ・曜日を全て通る)
    for (let i = 0; i < 400; i++) {
      const now = new Date(Date.UTC(2027, 11, 20) + i * 86_400_000);
      for (const tz of ["Asia/Tokyo", "UTC", "America/New_York"]) {
        for (const ch of collectDrawnChars(now, tz)) {
          if (!DYNAMIC_CHARSET.includes(ch)) missing.add(ch);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
