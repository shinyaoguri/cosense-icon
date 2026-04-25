export interface OpenTypePath {
  toPathData(decimalPlaces?: number): string;
  toSVG(decimalPlaces?: number): string;
}

export interface OpenTypeFont {
  getPath(text: string, x: number, y: number, fontSize: number): OpenTypePath;
  getAdvanceWidth(text: string, fontSize: number): number;
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
