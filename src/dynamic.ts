const DYNAMIC_KEYWORDS = new Set([
  "today",
  "week",
  "month",
  "year",
  "今日",
  "今週",
  "今月",
  "今年",
]);

const TZ = "Asia/Tokyo";

export function isDynamicKeyword(text: string[]): string | null {
  if (text.length !== 1) return null;
  const t = text[0]!.toLowerCase();
  return DYNAMIC_KEYWORDS.has(t) ? t : null;
}

function jstParts(date: Date): { year: string; month: string; day: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

function jstWeekdayJa(date: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    weekday: "short",
  }).format(date);
}

function isoWeekNumber(date: Date): number {
  const { year, month, day } = jstParts(date);
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dayNr = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekMs = 7 * 24 * 3600 * 1000;
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / weekMs);
}

export function dynamicText(keyword: string, now: Date): string[] {
  switch (keyword) {
    case "today":
    case "今日": {
      const { year, month, day } = jstParts(now);
      return [year, `${month}/${day}`, `(${jstWeekdayJa(now)})`];
    }
    case "year":
    case "今年":
      return [jstParts(now).year];
    case "month":
    case "今月": {
      const { year, month } = jstParts(now);
      return [`${year}/${month}`];
    }
    case "week":
    case "今週": {
      const { year } = jstParts(now);
      return [year, `W${isoWeekNumber(now)}`];
    }
    default:
      return [keyword];
  }
}
