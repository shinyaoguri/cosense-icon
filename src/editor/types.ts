export interface OpenTypePath {
  toPathData(decimalPlaces?: number): string;
  toSVG(decimalPlaces?: number): string;
}

export interface OpenTypeGlyph {
  index: number;
  advanceWidth?: number;
  getPath(x: number, y: number, fontSize: number): OpenTypePath;
}

export interface OpenTypeSubstitution {
  // 単一置換 (Single Substitution, GSUB Lookup Type 1) を取得
  // フォントが該当 feature を持たない場合は null/undefined または空配列
  getSingle(
    feature: string,
    script?: string,
    language?: string,
  ): { sub: number; by: number }[] | null | undefined;
}

export interface OpenTypeFont {
  getPath(text: string, x: number, y: number, fontSize: number): OpenTypePath;
  getAdvanceWidth(text: string, fontSize: number): number;
  unitsPerEm?: number;
  ascender?: number;
  descender?: number;
  charToGlyph?(ch: string): OpenTypeGlyph;
  glyphs?: { get(index: number): OpenTypeGlyph };
  substitution?: OpenTypeSubstitution;
  tables?: {
    vmtx?: { advanceHeights?: number[]; topSideBearings?: number[] };
    vhea?: { ascent?: number; descent?: number };
    [key: string]: unknown;
  };
}

export interface OpenTypeGlobal {
  parse(buffer: ArrayBuffer): OpenTypeFont;
}

export interface TurnstileGlobal {
  render(selector: string | HTMLElement, options: Record<string, unknown>): string;
  remove(widgetId?: string): void;
  reset(widgetId?: string): void;
  execute(widgetId?: string, options?: Record<string, unknown>): void;
  getResponse(widgetId?: string): string | null;
}

declare global {
  // CDN 経由でグローバルに公開される
  const opentype: OpenTypeGlobal;

  interface Window {
    opentype: OpenTypeGlobal;
    turnstile?: TurnstileGlobal;
    Module?: { decompress: (data: Uint8Array) => Uint8Array };
    onloadTurnstileCallback?: () => void;
    _updateFontPickerBtn?: () => void;
  }
}

export {};
