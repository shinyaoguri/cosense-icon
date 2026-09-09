// 組版が使うフォントのインターフェースは Worker 側とも共有するため src/fonttypes.ts が正本。
// エディタ側のモジュールは従来どおりここから import できるよう re-export する。
export type {
  OpenTypeFont,
  OpenTypeGlobal,
  OpenTypeGlyph,
  OpenTypePath,
  OpenTypeSubstitution,
} from "../fonttypes";

import type { OpenTypeGlobal } from "../fonttypes";

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
