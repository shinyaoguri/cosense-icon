import { describe, it, expect } from "vitest";
import {
  buildRegenUrl,
  computeKey,
  MATH_UNSUPPORTED_MARKER,
  packKey,
  packR2Key,
  r2Key,
  sanitizeSvg,
  withEditorLink,
  withErrorMarker,
  withMarker,
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

describe("withMarker", () => {
  const base =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect/></svg>`;

  it("チップとリンクを対で付ける", () => {
    const out = withMarker(base, 600, 400, "/?regen=x");
    expect(out).toContain('class="ic-warn"');
    expect(out).toContain('<a class="ic-edit" href="/?regen=x"');
    expect(out).toContain("エディタで再生成");
  });

  it("数式未対応マーカーを渡せる", () => {
    const out = withMarker(base, 600, 400, "/edit", MATH_UNSUPPORTED_MARKER);
    expect(out).toContain("数式未対応");
    expect(out).not.toContain("エディタで再生成");
  });
});

describe("packKey / packR2Key", () => {
  it("文字集合が違えば別キー", async () => {
    const a = await packKey("Roboto", "700", "0123456789");
    const b = await packKey("Roboto", "700", "0123456789日");
    expect(a).not.toBe(b);
  });

  it("ファミリ・ウェイトが違えば別キー", async () => {
    const a = await packKey("Roboto", "700", "abc");
    expect(await packKey("Inter", "700", "abc")).not.toBe(a);
    expect(await packKey("Roboto", "400", "abc")).not.toBe(a);
  });

  it("同じ入力なら同じキー", async () => {
    expect(await packKey("Roboto", "700", "abc")).toBe(
      await packKey("Roboto", "700", "abc"),
    );
  });

  it("完成 SVG とは別の名前空間に入る", async () => {
    const hash = await packKey("Roboto", "700", "abc");
    expect(packR2Key(hash)).toBe(`pk1/${hash}.json`);
    expect(r2Key(hash)).toBe(`v1/${hash}.svg`);
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
