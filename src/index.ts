import { parsePath } from "./parser";
import { renderSvg } from "./svg";

const INDEX_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>cosense-icon</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.6}code{background:#f4f4f4;padding:.1em .3em;border-radius:3px}</style>
</head>
<body>
<h1>cosense-icon</h1>
<p>パスから動的にSVGを生成するサービス。</p>
<h2>使い方</h2>
<p>末尾のセグメントがテキスト（<code>.svg</code> 拡張子は任意）、それ以前のセグメントがオプション。</p>
<ul>
  <li><code>/B4ゼミ.svg</code></li>
  <li><code>/bg-1e293b/fg-fff/B4ゼミ.svg</code></li>
  <li><code>/bg:red,fg:white/size:72/Hello.svg</code></li>
  <li><code>/bg-111/fg-fae/radius-24/B4\\nゼミ.svg</code>（<code>\\n</code> で改行）</li>
</ul>
<h2>キー一覧</h2>
<ul>
  <li><code>bg</code> / <code>background</code>: 背景色</li>
  <li><code>fg</code> / <code>color</code>: 文字色</li>
  <li><code>w</code> / <code>width</code>, <code>h</code> / <code>height</code>: サイズ</li>
  <li><code>size</code> / <code>font-size</code>: フォントサイズ（未指定なら自動フィット）</li>
  <li><code>weight</code> / <code>font-weight</code>: 太さ</li>
  <li><code>font</code> / <code>font-family</code>: フォント</li>
  <li><code>padding</code> / <code>p</code>: 余白</li>
  <li><code>radius</code> / <code>r</code>: 角丸</li>
  <li><code>lh</code> / <code>line-height</code>: 行高</li>
  <li><code>ls</code> / <code>letter-spacing</code>: 字間</li>
  <li><code>align</code>: left / center / right</li>
</ul>
</body>
</html>`;

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(INDEX_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      });
    }

    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    const parsed = parsePath(url.pathname);
    if (!parsed) {
      return new Response("Not Found", { status: 404 });
    }

    const svg = renderSvg(parsed.text, parsed.options);

    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  },
} satisfies ExportedHandler;
