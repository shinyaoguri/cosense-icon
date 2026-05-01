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
