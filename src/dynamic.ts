import type { IconOptions } from "./parser";
import { escapeXml, rotationWrap } from "./svg";

export const DEFAULT_TZ = "Asia/Tokyo";

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

export function isDynamicKeyword(text: string[]): string | null {
  if (text.length !== 1) return null;
  const t = text[0]!.toLowerCase();
  return DYNAMIC_KEYWORDS.has(t) ? t : null;
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

const WEEKDAYS_JA = ["月", "火", "水", "木", "金", "土", "日"];

type TzDate = {
  year: number;
  month: number;
  day: number;
  weekdayMon0: number;
};

function tzParts(now: Date, tz: string): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
  };
}

function weekdayMon0(year: number, month1: number, day: number): number {
  const utc = new Date(Date.UTC(year, month1 - 1, day));
  return (utc.getUTCDay() + 6) % 7;
}

function getTzDate(now: Date, tz: string): TzDate {
  const { y, m, d } = tzParts(now, tz);
  return { year: y, month: m, day: d, weekdayMon0: weekdayMon0(y, m, d) };
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function dayOfYear(year: number, month1: number, day: number): number {
  const target = Date.UTC(year, month1 - 1, day);
  const start = Date.UTC(year, 0, 1);
  return Math.round((target - start) / 86_400_000) + 1;
}

// 動的キーワード SVG: bgRect を含む内側 body を rotate でラップして外殻 svg を作る
function wrapDynamicSvg(
  innerBody: string,
  w: number,
  h: number,
  bg: string,
  radius: number,
  rotate: number,
  opts?: { gradTo?: string; gradAngle?: number },
): string {
  let gradDef = "";
  let bgFillVal = escapeXml(bg);
  if (opts?.gradTo) {
    const angle = ((opts.gradAngle ?? 135) * Math.PI) / 180;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const x1 = (0.5 - dx / 2) * 100;
    const y1 = (0.5 - dy / 2) * 100;
    const x2 = (0.5 + dx / 2) * 100;
    const y2 = (0.5 + dy / 2) * 100;
    gradDef = `<defs><linearGradient id="bgGrad" x1="${x1.toFixed(2)}%" y1="${y1.toFixed(2)}%" x2="${x2.toFixed(2)}%" y2="${y2.toFixed(2)}%"><stop offset="0%" stop-color="${escapeXml(bg)}"/><stop offset="100%" stop-color="${escapeXml(opts.gradTo)}"/></linearGradient></defs>`;
    bgFillVal = "url(#bgGrad)";
  }
  const bgRect =
    radius > 0
      ? `<rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="${bgFillVal}"/>`
      : `<rect width="${w}" height="${h}" fill="${bgFillVal}"/>`;
  const inner = `${gradDef}${bgRect}\n${innerBody}`;
  const { outerW, outerH, transform } = rotationWrap(w, h, rotate);
  const body = transform ? `<g transform="${transform}">\n${inner}\n</g>` : inner;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerW}" height="${outerH}" viewBox="0 0 ${outerW} ${outerH}">
${body}
</svg>`;
}

export function renderTodaySvg(
  now: Date,
  tz: string,
  opts: IconOptions,
): string {
  const t = getTzDate(now, tz);
  const mmdd = `${String(t.month).padStart(2, "0")}/${String(t.day).padStart(2, "0")}`;
  const wd = `(${WEEKDAYS_JA[t.weekdayMon0]})`;

  const innerW = Math.max(1, opts.width - opts.padding * 2);
  const innerH = Math.max(1, opts.height - opts.padding * 2);

  // "MM/DD" は 5 ラテン文字 ≒ 幅 0.55×5 = 2.75 em
  const mainWidthEm = 2.75;
  const subRatio = 0.3;
  const gapRatio = 0.2;
  const mainByH = innerH / (1 + gapRatio + subRatio);
  const mainByW = innerW / mainWidthEm;
  const mainSize = Math.min(mainByH, mainByW) * 0.95;
  const subSize = mainSize * subRatio;

  const totalH = mainSize + mainSize * gapRatio + subSize;
  const topY = opts.padding + (innerH - totalH) / 2;
  const mainBaseline = topY + mainSize * 0.85;
  const subBaseline = mainBaseline + mainSize * gapRatio + subSize;
  const x = opts.width / 2;

  const font = escapeXml(opts.fontFamily);
  const weight = escapeXml(opts.fontWeight);
  const fg = escapeXml(opts.fg);

  const body = [
    `<text x="${x}" y="${mainBaseline}" fill="${fg}" font-family="${font}" font-weight="${weight}" font-size="${mainSize}" text-anchor="middle">${escapeXml(mmdd)}</text>`,
    `<text x="${x}" y="${subBaseline}" fill="${fg}" font-family="${font}" font-size="${subSize}" text-anchor="middle" opacity="0.65">${escapeXml(wd)}</text>`,
  ].join("\n");

  return wrapDynamicSvg(body, opts.width, opts.height, opts.bg, opts.radius, opts.rotate ?? 0, { gradTo: opts.gradTo, gradAngle: opts.gradAngle });
}

export function renderWeekSvg(
  now: Date,
  tz: string,
  opts: IconOptions,
): string {
  const t = getTzDate(now, tz);
  const todayUtc = Date.UTC(t.year, t.month - 1, t.day);
  const mondayUtc = todayUtc - t.weekdayMon0 * 86_400_000;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mondayUtc + i * 86_400_000);
    return { day: d.getUTCDate(), isToday: i === t.weekdayMon0 };
  });

  const innerW = Math.max(1, opts.width - opts.padding * 2);
  const innerH = Math.max(1, opts.height - opts.padding * 2);
  const gap = 4;
  const cellW = (innerW - gap * 6) / 7;
  const baseX = opts.padding;
  const baseY = opts.padding;

  const titleH = innerH * 0.2;
  const titleSize = titleH * 0.55;
  const titleText = `${t.year}年 ${t.month}月`;
  const titleY = baseY + titleSize * 0.95;

  const gridTop = baseY + titleH;
  const cellH = innerH - titleH;
  const unit = Math.min(cellW, cellH);
  const labelSize = unit * 0.22;
  const dateSize = unit * 0.55;
  const gapInCell = unit * 0.08;
  const groupH = labelSize + gapInCell + dateSize;
  const groupTop = gridTop + (cellH - groupH) / 2;
  const labelY = groupTop + labelSize * 0.85;
  const dateY = labelY + labelSize * 0.15 + gapInCell + dateSize * 0.85;
  const cellRadius = unit * 0.1;

  const font = escapeXml(opts.fontFamily);
  const weight = escapeXml(opts.fontWeight);
  const fg = escapeXml(opts.fg);
  const bg = escapeXml(opts.bg);

  const body: string[] = [];
  body.push(
    `<text x="${opts.width / 2}" y="${titleY}" fill="${fg}" font-family="${font}" font-size="${titleSize}" font-weight="500" text-anchor="middle" opacity="0.65">${escapeXml(titleText)}</text>`,
  );

  days.forEach((d, i) => {
    const x = baseX + i * (cellW + gap);
    const cx = x + cellW / 2;
    const textColor = d.isToday ? bg : fg;
    const labelOpacity = d.isToday ? 1 : 0.55;

    if (d.isToday) {
      body.push(
        `<rect x="${x}" y="${gridTop}" width="${cellW}" height="${cellH}" rx="${cellRadius}" ry="${cellRadius}" fill="${fg}"/>`,
      );
    }
    body.push(
      `<text x="${cx}" y="${labelY}" fill="${textColor}" font-family="${font}" font-size="${labelSize}" font-weight="500" text-anchor="middle" opacity="${labelOpacity}">${WEEKDAYS_JA[i]}</text>`,
    );
    body.push(
      `<text x="${cx}" y="${dateY}" fill="${textColor}" font-family="${font}" font-weight="${weight}" font-size="${dateSize}" text-anchor="middle">${d.day}</text>`,
    );
  });

  return wrapDynamicSvg(body.join("\n"), opts.width, opts.height, opts.bg, opts.radius, opts.rotate ?? 0, { gradTo: opts.gradTo, gradAngle: opts.gradAngle });
}

export function renderMonthSvg(
  now: Date,
  tz: string,
  opts: IconOptions,
): string {
  const t = getTzDate(now, tz);
  const firstWd = weekdayMon0(t.year, t.month, 1);
  const curDays = daysInMonth(t.year, t.month);
  const prevDays = daysInMonth(t.year, t.month - 1);

  type Cell = { day: number; scope: "prev" | "cur" | "next"; isToday: boolean };
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - firstWd;
    let day: number;
    let scope: Cell["scope"];
    if (offset < 0) {
      day = prevDays + offset + 1;
      scope = "prev";
    } else if (offset < curDays) {
      day = offset + 1;
      scope = "cur";
    } else {
      day = offset - curDays + 1;
      scope = "next";
    }
    cells.push({ day, scope, isToday: scope === "cur" && day === t.day });
  }

  const innerW = Math.max(1, opts.width - opts.padding * 2);
  const innerH = Math.max(1, opts.height - opts.padding * 2);
  const baseX = opts.padding;
  const baseY = opts.padding;

  const titleH = innerH * 0.16;
  const titleSize = titleH * 0.6;
  const titleText = `${t.year}年 ${t.month}月`;
  const titleY = baseY + titleSize * 0.95;

  const gridTop = baseY + titleH;
  const gridH = innerH - titleH;
  const rowH = gridH / 7;
  const colW = innerW / 7;
  const unit = Math.min(rowH, colW);
  const headerSize = unit * 0.32;
  const dateSize = unit * 0.44;
  const cellInset = unit * 0.1;
  const cellRadius = unit * 0.15;

  const font = escapeXml(opts.fontFamily);
  const weight = escapeXml(opts.fontWeight);
  const fg = escapeXml(opts.fg);
  const bg = escapeXml(opts.bg);

  const body: string[] = [];
  body.push(
    `<text x="${opts.width / 2}" y="${titleY}" fill="${fg}" font-family="${font}" font-size="${titleSize}" font-weight="500" text-anchor="middle" opacity="0.65">${escapeXml(titleText)}</text>`,
  );

  WEEKDAYS_JA.forEach((w, i) => {
    const cx = baseX + i * colW + colW / 2;
    const cy = gridTop + rowH / 2 + headerSize * 0.35;
    body.push(
      `<text x="${cx}" y="${cy}" fill="${fg}" font-family="${font}" font-size="${headerSize}" font-weight="500" text-anchor="middle" opacity="0.55">${w}</text>`,
    );
  });
  cells.forEach((c, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7) + 1;
    const cellX = baseX + col * colW + cellInset;
    const cellY = gridTop + row * rowH + cellInset;
    const cellW2 = colW - cellInset * 2;
    const cellH2 = rowH - cellInset * 2;
    const cx = baseX + col * colW + colW / 2;
    const cy = gridTop + row * rowH + rowH / 2 + dateSize * 0.35;

    if (c.isToday) {
      body.push(
        `<rect x="${cellX}" y="${cellY}" width="${cellW2}" height="${cellH2}" rx="${cellRadius}" ry="${cellRadius}" fill="${fg}"/>`,
      );
    }
    const textColor = c.isToday ? bg : fg;
    const opacity = c.isToday ? 1 : c.scope === "cur" ? 1 : 0.3;
    body.push(
      `<text x="${cx}" y="${cy}" fill="${textColor}" font-family="${font}" font-weight="${weight}" font-size="${dateSize}" text-anchor="middle" opacity="${opacity}">${c.day}</text>`,
    );
  });

  return wrapDynamicSvg(body.join("\n"), opts.width, opts.height, opts.bg, opts.radius, opts.rotate ?? 0, { gradTo: opts.gradTo, gradAngle: opts.gradAngle });
}

export function renderYearSvg(
  now: Date,
  tz: string,
  opts: IconOptions,
): string {
  const t = getTzDate(now, tz);
  const total = daysInYear(t.year);
  const doy = dayOfYear(t.year, t.month, t.day);
  const firstWd = weekdayMon0(t.year, 1, 1);

  const innerW = Math.max(1, opts.width - opts.padding * 2);
  const innerH = Math.max(1, opts.height - opts.padding * 2);

  const titleH = innerH * 0.28;
  const titleSize = titleH * 0.9;
  const titleText = String(t.year);
  const titleY = opts.padding + titleSize * 0.9;

  const gridInnerH = innerH - titleH;
  const gap = 2;
  const totalCells = firstWd + total;
  const cols = Math.ceil(totalCells / 7);
  const cellSize = Math.min(
    (innerW - gap * (cols - 1)) / cols,
    (gridInnerH - gap * 6) / 7,
  );
  const gridW = cols * cellSize + (cols - 1) * gap;
  const gridH = 7 * cellSize + 6 * gap;
  const baseX = opts.padding + (innerW - gridW) / 2;
  const baseY = opts.padding + titleH + (gridInnerH - gridH) / 2;
  const cellRadius = cellSize * 0.2;
  const fg = escapeXml(opts.fg);
  const bg = escapeXml(opts.bg);
  const font = escapeXml(opts.fontFamily);
  const weight = escapeXml(opts.fontWeight);

  const body: string[] = [];
  body.push(
    `<text x="${opts.width / 2}" y="${titleY}" fill="${fg}" font-family="${font}" font-size="${titleSize}" font-weight="${weight}" text-anchor="middle" opacity="0.85">${escapeXml(titleText)}</text>`,
  );
  for (let d = 1; d <= total; d++) {
    const slot = firstWd + d - 1;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const x = baseX + col * (cellSize + gap);
    const y = baseY + row * (cellSize + gap);

    if (d === doy) {
      const sw = Math.max(1, cellSize * 0.2);
      body.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${fg}" stroke="${bg}" stroke-width="${sw}"/>`,
      );
    } else {
      const op = d < doy ? 1 : 0.15;
      body.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="${cellRadius}" ry="${cellRadius}" fill="${fg}" opacity="${op}"/>`,
      );
    }
  }

  return wrapDynamicSvg(body.join("\n"), opts.width, opts.height, opts.bg, opts.radius, opts.rotate ?? 0, { gradTo: opts.gradTo, gradAngle: opts.gradAngle });
}

export function renderDynamicSvg(
  keyword: string,
  now: Date,
  tz: string,
  opts: IconOptions,
): string {
  switch (keyword) {
    case "today":
    case "今日":
      return renderTodaySvg(now, tz, opts);
    case "week":
    case "今週":
      return renderWeekSvg(now, tz, opts);
    case "month":
    case "今月":
      return renderMonthSvg(now, tz, opts);
    case "year":
    case "今年":
      return renderYearSvg(now, tz, opts);
    default:
      return renderTodaySvg(now, tz, opts);
  }
}
