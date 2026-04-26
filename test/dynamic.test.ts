import { describe, expect, it } from "vitest";
import type { IconOptions } from "../src/parser";
import {
  isDynamicKeyword,
  renderMonthSvg,
  renderTodaySvg,
  renderWeekSvg,
  renderYearSvg,
  resolveTimezone,
} from "../src/dynamic";

const baseOpts: IconOptions = {
  bg: "#ffffff",
  fg: "#222222",
  width: 600,
  height: 400,
  fontFamily: "sans-serif",
  fontWeight: "700",
  padding: 24,
  radius: 0,
  lineHeight: 1.2,
  align: "center",
  rotate: 0,
  shadowBlur: 4,
  strokeWidth: 0,
  gradAngle: 135,
};

// 2026-04-19 JST 12:00 = UTC 2026-04-19 03:00
// 2026年4月19日は日曜(Mon0=6)、day-of-year=109、平年
const BASE = new Date("2026-04-19T03:00:00Z");
const TZ = "Asia/Tokyo";

describe("isDynamicKeyword", () => {
  it("英語/日本語キーワードを検出", () => {
    expect(isDynamicKeyword(["today"])).toBe("today");
    expect(isDynamicKeyword(["week"])).toBe("week");
    expect(isDynamicKeyword(["month"])).toBe("month");
    expect(isDynamicKeyword(["year"])).toBe("year");
    expect(isDynamicKeyword(["今日"])).toBe("今日");
  });
  it("大文字小文字を無視", () => {
    expect(isDynamicKeyword(["TODAY"])).toBe("today");
  });
  it("該当しない場合はnull", () => {
    expect(isDynamicKeyword(["foo"])).toBeNull();
    expect(isDynamicKeyword(["today", "extra"])).toBeNull();
  });
});

describe("resolveTimezone", () => {
  it("明示指定が最優先", () => {
    expect(resolveTimezone("America/New_York", "Asia/Tokyo")).toBe(
      "America/New_York",
    );
  });
  it("明示なしは自動判定", () => {
    expect(resolveTimezone(undefined, "Europe/Berlin")).toBe("Europe/Berlin");
  });
  it("両方なし or 不正はデフォルト", () => {
    expect(resolveTimezone(undefined, undefined)).toBe("Asia/Tokyo");
    expect(resolveTimezone("Not/Real", "Bad/Zone")).toBe("Asia/Tokyo");
  });
});

describe("renderTodaySvg", () => {
  it("MM/DD と (曜日) を表示", () => {
    const svg = renderTodaySvg(BASE, TZ, baseOpts);
    expect(svg).toContain(">04/19<");
    expect(svg).toContain(">(日)<");
  });

  it("bg/fg が反映される", () => {
    const svg = renderTodaySvg(BASE, TZ, {
      ...baseOpts,
      bg: "#123456",
      fg: "#abcdef",
    });
    expect(svg).toContain('fill="#123456"');
    expect(svg).toContain('fill="#abcdef"');
  });

  it("タイムゾーンで日付が変わる", () => {
    const t = new Date("2026-04-19T15:30:00Z"); // JST翌日 00:30 / NY 11:30
    expect(renderTodaySvg(t, "Asia/Tokyo", baseOpts)).toContain(">04/20<");
    expect(renderTodaySvg(t, "America/New_York", baseOpts)).toContain(">04/19<");
  });
});

describe("renderWeekSvg", () => {
  it("月タイトル「YYYY年 M月」を含む", () => {
    const svg = renderWeekSvg(BASE, TZ, baseOpts);
    expect(svg).toContain(">2026年 4月<");
  });

  it("今週の月曜〜日曜を表示 (2026-04-19基準: 13〜19)", () => {
    const svg = renderWeekSvg(BASE, TZ, baseOpts);
    for (const d of ["13", "14", "15", "16", "17", "18", "19"]) {
      expect(svg).toContain(`>${d}<`);
    }
    for (const w of ["月", "火", "水", "木", "金", "土", "日"]) {
      expect(svg).toContain(`>${w}<`);
    }
  });

  it("今日セルだけ fg で塗りつぶされる", () => {
    const svg = renderWeekSvg(BASE, TZ, baseOpts);
    const highlightRects =
      svg.match(/<rect[^/]*?fill="#222222"[^/]*?\/>/g) ?? [];
    expect(highlightRects.length).toBe(1);
  });
});

describe("renderMonthSvg", () => {
  it("月タイトル「YYYY年 M月」を含む", () => {
    const svg = renderMonthSvg(BASE, TZ, baseOpts);
    expect(svg).toContain(">2026年 4月<");
  });

  it("曜日ヘッダと当月の日付1〜30を表示", () => {
    const svg = renderMonthSvg(BASE, TZ, baseOpts);
    for (const w of ["月", "火", "水", "木", "金", "土", "日"]) {
      expect(svg).toContain(`>${w}<`);
    }
    for (let d = 1; d <= 30; d++) {
      expect(svg).toContain(`>${d}<`);
    }
  });

  it("隣接月セルは opacity 0.3", () => {
    const svg = renderMonthSvg(BASE, TZ, baseOpts);
    expect(svg).toContain('opacity="0.3"');
  });

  it("今日(19)はハイライト塗り", () => {
    const svg = renderMonthSvg(BASE, TZ, baseOpts);
    // highlight rect + 19 が bg色で描画
    const highlightRects =
      svg.match(/<rect[^/]*?fill="#222222"[^/]*?\/>/g) ?? [];
    expect(highlightRects.length).toBe(1);
  });
});

describe("renderYearSvg", () => {
  it("年タイトルを表示", () => {
    const svg = renderYearSvg(BASE, TZ, baseOpts);
    expect(svg).toContain(">2026<");
  });

  it("1(背景) + 365 日 = 366個の rect (平年)", () => {
    const svg = renderYearSvg(BASE, TZ, baseOpts);
    const rects = svg.match(/<rect\b/g) ?? [];
    expect(rects.length).toBe(1 + 365);
  });

  it("経過日 opacity=1 が 108個、未来 opacity=0.15 が 256個", () => {
    const svg = renderYearSvg(BASE, TZ, baseOpts);
    // day-of-year = 109, 過去 = 108, 未来 = 365 - 109 = 256
    const past = (svg.match(/opacity="1"/g) ?? []).length;
    const future = (svg.match(/opacity="0\.15"/g) ?? []).length;
    expect(past).toBe(108);
    expect(future).toBe(256);
  });

  it("今日セルは stroke で縁取られる", () => {
    const svg = renderYearSvg(BASE, TZ, baseOpts);
    expect(svg).toMatch(/<rect[^/]*?stroke=/);
  });

  it("閏年 2028 は 366セル", () => {
    const leap = new Date("2028-06-15T03:00:00Z");
    const svg = renderYearSvg(leap, TZ, baseOpts);
    const rects = svg.match(/<rect\b/g) ?? [];
    expect(rects.length).toBe(1 + 366);
  });
});
