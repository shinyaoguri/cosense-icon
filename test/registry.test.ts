import { describe, it, expect } from "vitest";
import {
  buildRegenUrl,
  computeKey,
  markUnsupportedFont,
  r2Key,
  sanitizeSvg,
  withEditorLink,
  withErrorMarker,
} from "../src/registry";
import { parsePath } from "../src/parser";

describe("computeKey", () => {
  it("同一パラメータは同一ハッシュ", async () => {
    const a = parsePath("/font-Roboto/weight-700/Hello.svg")!;
    const b = parsePath("/font-Roboto/weight-700/Hello.svg")!;
    expect(await computeKey(a)).toBe(await computeKey(b));
  });

  it("font違いは別ハッシュ", async () => {
    const a = parsePath("/font-Roboto/Hello.svg")!;
    const b = parsePath("/font-Inter/Hello.svg")!;
    expect(await computeKey(a)).not.toBe(await computeKey(b));
  });

  it("text違いは別ハッシュ", async () => {
    const a = parsePath("/font-Roboto/Hello.svg")!;
    const b = parsePath("/font-Roboto/World.svg")!;
    expect(await computeKey(a)).not.toBe(await computeKey(b));
  });

  it("16bytes hex (32文字) を返す", async () => {
    const a = parsePath("/font-Roboto/Hello.svg")!;
    const hash = await computeKey(a);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("math フラグ違いは別ハッシュ", async () => {
    const a = parsePath("/y=x^2.svg")!;
    const b = parsePath("/math/y=x^2.svg")!;
    expect(await computeKey(a)).not.toBe(await computeKey(b));
  });

  it("vertical フラグ違いは別ハッシュ", async () => {
    const a = parsePath("/font-Roboto/Hello.svg")!;
    const b = parsePath("/font-Roboto/vertical/Hello.svg")!;
    expect(await computeKey(a)).not.toBe(await computeKey(b));
  });

  it("wrap フラグ違いは別ハッシュ", async () => {
    const a = parsePath("/font-Roboto/Hello.svg")!;
    const b = parsePath("/font-Roboto/wrap/Hello.svg")!;
    expect(await computeKey(a)).not.toBe(await computeKey(b));
  });
});

describe("r2Key", () => {
  it("v1/<hash>.svg 形式", () => {
    expect(r2Key("abc123")).toBe("v1/abc123.svg");
  });
});

describe("buildRegenUrl", () => {
  it("URL safe base64 でエンコード", () => {
    const url = buildRegenUrl("/font-Roboto/Hello.svg");
    expect(url).toMatch(/^\/\?regen=[A-Za-z0-9_-]+$/);
  });

  it("日本語パスもエンコード可能", () => {
    const url = buildRegenUrl("/font-Noto Sans JP/B4ゼミ.svg");
    expect(url.startsWith("/?regen=")).toBe(true);
  });
});

describe("withErrorMarker", () => {
  const base =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect/></svg>`;

  it("警告チップ <g> を挿入する (リンク自体は付与しない)", () => {
    const out = withErrorMarker(base, 600, 400, "/?regen=x");
    expect(out).toContain('class="ic-warn"');
    expect(out).toContain("エディタで再生成");
    // 自身は <a> ではない (クリック先は外側 withEditorLink で決まる)
    expect(out).not.toContain('<a class="ic-warn"');
    expect(out).not.toContain('href="/?regen=x"');
  });

  it("再生成URLをコメントに含める", () => {
    const out = withErrorMarker(base, 600, 400, "/?regen=abc");
    expect(out).toContain("/?regen=abc");
    expect(out).toContain("<!-- regenerate at:");
  });

  it("小さい画像ではコンパクト版マーカーを使う", () => {
    const out = withErrorMarker(base, 100, 60, "/?regen=x");
    expect(out).toContain('class="ic-warn"');
    // chip 版の "エディタで再生成" は出ない
    expect(out).not.toContain("エディタで再生成");
  });

  it("元のSVGの </svg> を保持", () => {
    const out = withErrorMarker(base, 600, 400, "/?regen=x");
    expect(out.endsWith("</svg>")).toBe(true);
  });

  it("ラベルを差し替えられ、chip 幅がラベル長に追従する", () => {
    const out = withErrorMarker(base, 600, 400, "/x", {
      label: "フォント未反映",
      tooltip: "テスト用",
    });
    expect(out).toContain("フォント未反映");
    expect(out).toContain("テスト用");
    expect(out).not.toContain("エディタで再生成");
    // 7 文字 × 12px + 58 = 142
    expect(out).toContain('width="142"');
  });

  it("ラベルが長いと chip に切り替わる下限幅も広がる", () => {
    const long = { label: "とても長い警告ラベルです", tooltip: "t" };
    // 12 文字 → chipW 202。幅 200 では chip に収まらずコンパクト版
    expect(withErrorMarker(base, 200, 400, "/x", long)).not.toContain(
      long.label,
    );
    expect(withErrorMarker(base, 400, 400, "/x", long)).toContain(long.label);
  });
});

describe("markUnsupportedFont", () => {
  const base =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect/></svg>`;

  it("Google Fonts 指定の countdown には警告チップとエディタリンクが付く", () => {
    const parsed = parsePath("/countdown/date-2026-12-31/font-Roboto/あと{d}日.svg")!;
    const out = markUnsupportedFont(base, parsed, "/countdown/x");
    expect(out).toContain("フォント未反映");
    expect(out).toContain('<a class="ic-edit" href="/countdown/x"');
  });

  it("動的キーワード + Google Fonts にも付く", () => {
    const parsed = parsePath("/font-Rampart One/today.svg")!;
    expect(markUnsupportedFont(base, parsed, "/today")).toContain(
      "フォント未反映",
    );
  });

  it("システムフォントのショートカットでは付かない", () => {
    for (const font of ["sans", "serif", "mono", "rounded", "gothic", "mincho"]) {
      const parsed = parsePath(`/countdown/font-${font}/あと{d}日.svg`)!;
      expect(markUnsupportedFont(base, parsed, "/x")).toBe(base);
    }
  });

  it("font 未指定では付かない", () => {
    const parsed = parsePath("/countdown/date-2026-12-31/あと{d}日.svg")!;
    expect(markUnsupportedFont(base, parsed, "/x")).toBe(base);
  });
});

describe("withEditorLink", () => {
  const base =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect/></svg>`;

  it("SVGコンテンツを <a> でラップする", () => {
    const out = withEditorLink(base, "https://example.com/foo");
    expect(out).toContain('<a class="ic-edit"');
    expect(out).toContain('href="https://example.com/foo"');
    expect(out).toContain('target="_top"');
    expect(out).toContain("クリックでエディタを開く");
    // <rect> がラップ内に存在
    expect(out).toMatch(/<a [^>]*ic-edit[^>]*>[\s\S]*<rect\/>[\s\S]*<\/a>/);
    expect(out.endsWith("</svg>")).toBe(true);
  });

  it("href の特殊文字をエスケープする", () => {
    const out = withEditorLink(base, "https://example.com/?a=1&b=2");
    expect(out).toContain("&amp;");
    expect(out).not.toContain("?a=1&b=2"); // 生の & は無い
  });

  it("既にラップ済みなら二重ラップしない", () => {
    const once = withEditorLink(base, "https://example.com/foo");
    const twice = withEditorLink(once, "https://example.com/bar");
    expect(twice).toBe(once);
  });

  it("withErrorMarker → withEditorLink の順で chip も外側 <a> の内側に入る", () => {
    const withChip = withErrorMarker(base, 600, 400, "/?regen=x");
    const out = withEditorLink(withChip, "https://example.com/foo");
    expect(out).toContain('class="ic-edit"');
    expect(out).toContain('class="ic-warn"');
    const aOpenIdx = out.indexOf('<a class="ic-edit"');
    const warnIdx = out.indexOf('class="ic-warn"');
    const aCloseIdx = out.lastIndexOf("</a>");
    expect(aOpenIdx).toBeGreaterThan(-1);
    expect(warnIdx).toBeGreaterThan(aOpenIdx);
    expect(aCloseIdx).toBeGreaterThan(warnIdx);
  });
});

describe("sanitizeSvg", () => {
  it("<script> を除去", () => {
    const dirty = `<svg><script>alert(1)</script><rect/></svg>`;
    expect(sanitizeSvg(dirty)).not.toContain("<script>");
  });

  it("on* 属性を除去", () => {
    const dirty = `<svg onload="alert(1)"><rect onclick='bad'/></svg>`;
    const out = sanitizeSvg(dirty);
    expect(out).not.toContain("onload");
    expect(out).not.toContain("onclick");
  });

  it("javascript: URL を除去", () => {
    const dirty = `<svg><a href="javascript:alert(1)"><rect/></a></svg>`;
    const out = sanitizeSvg(dirty);
    expect(out).not.toContain("javascript:");
  });

  it("foreignObject を除去", () => {
    const dirty = `<svg><foreignObject><div>x</div></foreignObject></svg>`;
    const out = sanitizeSvg(dirty);
    expect(out).not.toContain("<foreignObject");
  });

  it("通常の<path>は保持", () => {
    const clean = `<svg><path d="M0 0 L10 10" fill="#000"/></svg>`;
    expect(sanitizeSvg(clean)).toBe(clean);
  });
});
