// 長文を幅に応じて折り返すための共通ユーティリティ。
// サーバ側 (svg.ts) は文字幅推定、クライアント側 (pathify.ts) は
// opentype.js による正確な幅で利用する。

export type CharWidthFn = (ch: string) => number;

function isCJKChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x3000 && cp <= 0x303f) ||  // CJK Symbols
    (cp >= 0x3040 && cp <= 0x309f) ||  // Hiragana
    (cp >= 0x30a0 && cp <= 0x30ff) ||  // Katakana
    (cp >= 0x3400 && cp <= 0x4dbf) ||  // CJK Ext-A
    (cp >= 0x4e00 && cp <= 0x9fff) ||  // CJK Unified
    (cp >= 0xf900 && cp <= 0xfaff) ||  // CJK Compat
    (cp >= 0xff00 && cp <= 0xffef)     // Halfwidth/Fullwidth
  );
}

interface Token {
  text: string;
  width: number;
  isSpace: boolean;
}

// 1 行を: 1 CJK 文字 / 1 空白 / 連続するラテン語 (atomic) に分割
function tokenize(line: string, charWidth: CharWidthFn): Token[] {
  const tokens: Token[] = [];
  let buf = "";
  let bufW = 0;
  for (const ch of line) {
    const cw = charWidth(ch);
    const isSp = /\s/.test(ch);
    const isCjk = isCJKChar(ch);
    if (isCjk || isSp) {
      if (buf) {
        tokens.push({ text: buf, width: bufW, isSpace: false });
        buf = "";
        bufW = 0;
      }
      tokens.push({ text: ch, width: cw, isSpace: isSp });
    } else {
      buf += ch;
      bufW += cw;
    }
  }
  if (buf) tokens.push({ text: buf, width: bufW, isSpace: false });
  return tokens;
}

// 単一行を貪欲に折り返す
export function wrapLine(
  line: string,
  maxWidth: number,
  charWidth: CharWidthFn,
): string[] {
  if (!line) return [""];
  if (maxWidth <= 0) return [line];

  const tokens = tokenize(line, charWidth);
  const out: string[] = [];
  let buf = "";
  let bufW = 0;

  for (const tok of tokens) {
    // 単語自身が行幅を超える場合は文字単位で強制分割
    if (tok.width > maxWidth && !tok.isSpace) {
      if (buf) {
        out.push(buf.replace(/\s+$/, ""));
        buf = "";
        bufW = 0;
      }
      let chunkBuf = "";
      let chunkW = 0;
      for (const ch of tok.text) {
        const cw = charWidth(ch);
        if (chunkW + cw > maxWidth && chunkBuf) {
          out.push(chunkBuf);
          chunkBuf = ch;
          chunkW = cw;
        } else {
          chunkBuf += ch;
          chunkW += cw;
        }
      }
      buf = chunkBuf;
      bufW = chunkW;
      continue;
    }

    if (bufW + tok.width > maxWidth && buf) {
      out.push(buf.replace(/\s+$/, ""));
      if (tok.isSpace) {
        // 行頭の空白は捨てる
        buf = "";
        bufW = 0;
      } else {
        buf = tok.text;
        bufW = tok.width;
      }
    } else {
      // 行頭の空白は捨てる
      if (tok.isSpace && buf === "") continue;
      buf += tok.text;
      bufW += tok.width;
    }
  }
  if (buf) out.push(buf.replace(/\s+$/, ""));
  return out.length > 0 ? out : [""];
}

// 複数行 (改行済み) をフラットに wrap
export function wrapLines(
  lines: string[],
  maxWidth: number,
  charWidth: CharWidthFn,
): string[] {
  const out: string[] = [];
  for (const line of lines) {
    out.push(...wrapLine(line, maxWidth, charWidth));
  }
  return out;
}

// 縦書き向けに 1 行のセル数を概算する。
// CJK = 1 cell / 1 桁数字 = 1 (rotate) / 2 桁数字 = 1 (TCY) / 3+ 桁 = N (各 rotate)
// ラテン文字・記号 = 1 cell ずつ (rotate)、空白も 1 cell
export function countVerticalCells(line: string): number {
  let count = 0;
  const chars = Array.from(line);
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < chars.length && /[0-9]/.test(chars[j]!)) j++;
      const len = j - i;
      count += len <= 2 ? 1 : len;
      i = j;
    } else {
      count += 1;
      i++;
    }
  }
  return count;
}

interface VToken {
  text: string;
  cellCount: number;
  isSpace: boolean;
}

// 縦書き wrap 用のトークン分割。
// 切れ目: CJK 文字単位 / TCY 数字単位 / 空白 / ラテン語の前後
// ラテン語の連続は 1 トークン (atomic、行内で分割しない)
function tokenizeVertical(line: string): VToken[] {
  const tokens: VToken[] = [];
  const chars = Array.from(line);
  let buf = "";
  let bufCount = 0;

  const flushBuf = (): void => {
    if (buf) {
      tokens.push({ text: buf, cellCount: bufCount, isSpace: false });
      buf = "";
      bufCount = 0;
    }
  };

  let i = 0;
  while (i < chars.length) {
    const ch = chars[i]!;
    if (/\s/.test(ch)) {
      flushBuf();
      tokens.push({ text: ch, cellCount: 1, isSpace: true });
      i++;
    } else if (/[0-9]/.test(ch)) {
      flushBuf();
      let j = i;
      while (j < chars.length && /[0-9]/.test(chars[j]!)) j++;
      const run = chars.slice(i, j).join("");
      tokens.push({
        text: run,
        cellCount: run.length <= 2 ? 1 : run.length,
        isSpace: false,
      });
      i = j;
    } else if (isCJKChar(ch)) {
      flushBuf();
      tokens.push({ text: ch, cellCount: 1, isSpace: false });
      i++;
    } else {
      // ラテン・記号は連結して 1 単語化
      buf += ch;
      bufCount += 1;
      i++;
    }
  }
  flushBuf();
  return tokens;
}

// 1 行の文字列を「セル数 = maxCells」の制約で複数列に分割
export function wrapVerticalLine(line: string, maxCells: number): string[] {
  if (!line) return [""];
  if (maxCells <= 0) return [line];

  const tokens = tokenizeVertical(line);
  const cols: string[] = [];
  let buf = "";
  let bufCount = 0;

  for (const tok of tokens) {
    if (tok.cellCount > maxCells && !tok.isSpace) {
      if (buf) {
        cols.push(buf.replace(/\s+$/, ""));
        buf = "";
        bufCount = 0;
      }
      // 文字単位で強制分割 (TCY のような不可分塊は内部要素なので 1 文字ずつ)
      const tokChars = Array.from(tok.text);
      let chunk = "";
      let chunkCount = 0;
      for (const ch of tokChars) {
        if (chunkCount + 1 > maxCells && chunk) {
          cols.push(chunk);
          chunk = ch;
          chunkCount = 1;
        } else {
          chunk += ch;
          chunkCount += 1;
        }
      }
      buf = chunk;
      bufCount = chunkCount;
      continue;
    }

    if (bufCount + tok.cellCount > maxCells && buf) {
      cols.push(buf.replace(/\s+$/, ""));
      if (tok.isSpace) {
        buf = "";
        bufCount = 0;
      } else {
        buf = tok.text;
        bufCount = tok.cellCount;
      }
    } else {
      if (tok.isSpace && buf === "") continue;
      buf += tok.text;
      bufCount += tok.cellCount;
    }
  }
  if (buf) cols.push(buf.replace(/\s+$/, ""));
  return cols.length > 0 ? cols : [""];
}

// 複数の入力行 (\n 区切り) を、セル数で縦書き wrap してフラットな列配列に
export function wrapVerticalLines(lines: string[], maxCells: number): string[] {
  const out: string[] = [];
  for (const line of lines) {
    out.push(...wrapVerticalLine(line, maxCells));
  }
  return out;
}

// 縦書き wrap 時の fontSize 自動決定。
// 全セル数 × fontSize² × lh / innerH ≤ innerW (= 全列幅 ≤ innerW) から逆算
export function fitVerticalFontSizeWithWrap(
  lines: string[],
  innerW: number,
  innerH: number,
  lh: number,
): { fontSize: number; columns: string[] } {
  let totalCells = 0;
  for (const line of lines) totalCells += countVerticalCells(line);
  if (totalCells === 0) return { fontSize: 16, columns: lines };

  let fontSize = Math.sqrt((innerW * innerH) / (totalCells * lh));
  fontSize = Math.min(fontSize, innerH);
  fontSize = Math.max(8, fontSize);

  const wrap = (fs: number): string[] =>
    wrapVerticalLines(lines, Math.max(1, Math.floor(innerH / fs)));

  let columns = wrap(fontSize);
  for (let i = 0; i < 8; i++) {
    const totalW = columns.length * fontSize * lh;
    if (totalW <= innerW) break;
    fontSize *= 0.92;
    if (fontSize < 8) {
      fontSize = 8;
      columns = wrap(fontSize);
      break;
    }
    columns = wrap(fontSize);
  }

  return { fontSize, columns };
}

// wrap モードでの fontSize 自動決定 (反復縮小)
// 解析的な初期推定 → 実際にラップ → 高さ超過なら縮小、を最大 8 回。
export function fitFontSizeWithWrap(
  lines: string[],
  innerW: number,
  innerH: number,
  lineHeight: number,
  charWidth: CharWidthFn,
): { fontSize: number; wrappedLines: string[] } {
  let totalEm = 0;
  for (const line of lines) {
    for (const ch of line) totalEm += charWidth(ch);
  }
  if (totalEm <= 0) {
    return { fontSize: 16, wrappedLines: lines };
  }

  // 解析的: 全テキストが矩形に詰めると仮定した最大 fontSize
  let fontSize = Math.sqrt((innerW * innerH) / (totalEm * lineHeight));
  fontSize = Math.min(fontSize, innerH); // 1 行に収まる高さ上限
  fontSize = Math.max(8, fontSize);

  let wrapped = wrapLines(lines, innerW / fontSize, charWidth);
  for (let i = 0; i < 8; i++) {
    const totalH = wrapped.length * fontSize * lineHeight;
    if (totalH <= innerH) break;
    fontSize *= 0.92;
    if (fontSize < 8) {
      fontSize = 8;
      wrapped = wrapLines(lines, innerW / fontSize, charWidth);
      break;
    }
    wrapped = wrapLines(lines, innerW / fontSize, charWidth);
  }

  return { fontSize, wrappedLines: wrapped };
}
