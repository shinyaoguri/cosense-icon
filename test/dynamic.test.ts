import { describe, it, expect } from "vitest";
import { dynamicText, isDynamicKeyword, resolveTimezone } from "../src/dynamic";

describe("isDynamicKeyword", () => {
  it("today/week/month/year を検出", () => {
    expect(isDynamicKeyword(["today"])).toBe("today");
    expect(isDynamicKeyword(["week"])).toBe("week");
    expect(isDynamicKeyword(["month"])).toBe("month");
    expect(isDynamicKeyword(["year"])).toBe("year");
  });

  it("日本語キーワードも検出", () => {
    expect(isDynamicKeyword(["今日"])).toBe("今日");
    expect(isDynamicKeyword(["今週"])).toBe("今週");
  });

  it("大文字小文字を無視", () => {
    expect(isDynamicKeyword(["TODAY"])).toBe("today");
  });

  it("複数行や別テキストはnull", () => {
    expect(isDynamicKeyword(["today", "extra"])).toBeNull();
    expect(isDynamicKeyword(["Hello"])).toBeNull();
  });
});

describe("dynamicText", () => {
  // JST 2026-04-19 日曜 12:00 = UTC 2026-04-19 03:00
  const base = new Date("2026-04-19T03:00:00Z");

  it("today: 年 / 月/日 / (曜日)", () => {
    const lines = dynamicText("today", base);
    expect(lines[0]).toBe("2026");
    expect(lines[1]).toBe("04/19");
    expect(lines[2]).toMatch(/^\(.\)$/);
  });

  it("year: 年のみ", () => {
    expect(dynamicText("year", base)).toEqual(["2026"]);
  });

  it("month: YYYY/MM", () => {
    expect(dynamicText("month", base)).toEqual(["2026/04"]);
  });

  it("week: 年 / Wxx", () => {
    const lines = dynamicText("week", base);
    expect(lines[0]).toBe("2026");
    expect(lines[1]).toBe("W16");
  });

  it("今日 も today と同じ出力", () => {
    expect(dynamicText("今日", base)).toEqual(dynamicText("today", base));
  });

  it("JSTの日跨ぎを正しく扱う (UTC 14:30 = JST翌日 23:30)", () => {
    const crossNoon = new Date("2026-04-19T14:30:00Z"); // JST 2026-04-19 23:30
    expect(dynamicText("today", crossNoon)[1]).toBe("04/19");
    const crossMidnight = new Date("2026-04-19T15:30:00Z"); // JST 2026-04-20 00:30
    expect(dynamicText("today", crossMidnight)[1]).toBe("04/20");
  });

  it("tz 指定で別のタイムゾーンの日付になる", () => {
    // UTC 15:30 → JST 翌日 00:30 / NY 11:30 / Honolulu 05:30
    const t = new Date("2026-04-19T15:30:00Z");
    expect(dynamicText("today", t, "Asia/Tokyo")[1]).toBe("04/20");
    expect(dynamicText("today", t, "America/New_York")[1]).toBe("04/19");
    expect(dynamicText("today", t, "Pacific/Honolulu")[1]).toBe("04/19");
  });
});

describe("resolveTimezone", () => {
  it("明示指定が最優先", () => {
    expect(resolveTimezone("America/New_York", "Asia/Tokyo")).toBe(
      "America/New_York",
    );
  });
  it("明示なしなら自動判定を採用", () => {
    expect(resolveTimezone(undefined, "Europe/Berlin")).toBe("Europe/Berlin");
  });
  it("両方なしならデフォルト Asia/Tokyo", () => {
    expect(resolveTimezone(undefined, undefined)).toBe("Asia/Tokyo");
  });
  it("不正な明示指定は無視して自動にフォールバック", () => {
    expect(resolveTimezone("Not/Real", "Europe/Berlin")).toBe("Europe/Berlin");
  });
  it("両方不正ならデフォルト", () => {
    expect(resolveTimezone("Not/Real", "Also/Bad")).toBe("Asia/Tokyo");
  });
});
