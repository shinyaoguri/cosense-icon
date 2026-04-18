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

export const DEFAULT_TZ = "Asia/Tokyo";

export function isDynamicKeyword(text: string[]): string | null {
  if (text.length !== 1) return null;
  const t = text[0]!.toLowerCase();
  return DYNAMIC_KEYWORDS.has(t) ? t : null;
}

function tzParts(
  date: Date,
  tz: string,
): { year: string; month: string; day: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

function tzWeekdayJa(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: tz,
    weekday: "short",
  }).format(date);
}

function isoWeekNumber(date: Date, tz: string): number {
  const { year, month, day } = tzParts(date, tz);
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const dayNr = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekMs = 7 * 24 * 3600 * 1000;
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / weekMs);
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(
  explicit: string | undefined,
  autoDetected: string | undefined,
): string {
  if (explicit && isValidTimezone(explicit)) return explicit;
  if (autoDetected && isValidTimezone(autoDetected)) return autoDetected;
  return DEFAULT_TZ;
}

export function dynamicText(
  keyword: string,
  now: Date,
  tz: string = DEFAULT_TZ,
): string[] {
  switch (keyword) {
    case "today":
    case "今日": {
      const { year, month, day } = tzParts(now, tz);
      return [year, `${month}/${day}`, `(${tzWeekdayJa(now, tz)})`];
    }
    case "year":
    case "今年":
      return [tzParts(now, tz).year];
    case "month":
    case "今月": {
      const { year, month } = tzParts(now, tz);
      return [`${year}/${month}`];
    }
    case "week":
    case "今週": {
      const { year } = tzParts(now, tz);
      return [year, `W${isoWeekNumber(now, tz)}`];
    }
    default:
      return [keyword];
  }
}
