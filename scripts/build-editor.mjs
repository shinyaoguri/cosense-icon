#!/usr/bin/env node
import esbuild from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");

const entry = resolve(root, "src/editor/main.ts");
const template = resolve(root, "src/editor/editor.template.html");
const out = resolve(root, "src/editor.html");

/**
 * エディタの main.ts を esbuild でバンドルし、テンプレート HTML に inline 展開する。
 * ファイルには書き込まず `{ js, html }` を返す (テストと CLI で共有する単一コードパス)。
 * @param {{ dev?: boolean }} [opts] dev=true で minify 無効 (sourcemap 付き相当の可読出力)
 */
export async function buildEditorHtml({ dev = false } = {}) {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    target: "es2022",
    minify: !dev,
    sourcemap: false,
    write: false,
    legalComments: "none",
    tsconfig: resolve(root, "tsconfig.editor.json"),
  });

  const outFile = result.outputFiles[0];
  if (!outFile) throw new Error("esbuild produced no output");

  // HTML に inline 展開するので、bundle 内の </script> を無害化
  const js = outFile.text.replace(/<\/script>/gi, "<\\/script>");

  const tpl = readFileSync(template, "utf-8");
  if (!tpl.includes("<!-- BUNDLE -->")) {
    throw new Error("template に <!-- BUNDLE --> プレースホルダが見つからない");
  }

  // 置換値は関数で渡す。文字列で渡すと bundle 内の `$&` `$$` `` $` `` 等が
  // String.replace の特殊置換パターンとして解釈され JS が壊れる。
  const html = tpl.replace("<!-- BUNDLE -->", () => `<script>${js}</script>`);

  // 埋め込みガード: bundle が逐語的に含まれていること (再発防止)。
  // 特殊置換パターン等で JS が改変されると inline が壊れて全体が動かなくなるため。
  if (!html.includes(`<script>${js}</script>`)) {
    throw new Error("bundle が HTML に逐語的に埋め込まれていない (置換で改変された可能性)");
  }

  return { js, html };
}

// CLI として直接実行された場合のみファイルへ書き出す (import 時は副作用なし)。
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === __filename;
if (invokedDirectly) {
  const dev = process.argv.includes("--dev");
  const { js, html } = await buildEditorHtml({ dev });
  writeFileSync(out, html);
  console.log(
    `[build-editor] ${entry} -> ${out}  (${js.length.toLocaleString()} bytes JS${dev ? ", dev" : ", minified"})`,
  );
}
