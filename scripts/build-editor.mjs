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

const isDev = process.argv.includes("--dev");

const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: !isDev,
  sourcemap: false,
  write: false,
  legalComments: "none",
  tsconfig: resolve(root, "tsconfig.editor.json"),
});

const outFile = result.outputFiles[0];
if (!outFile) throw new Error("esbuild produced no output");

// HTML に inline 展開するので、bundle 内の </script> を無害化
const js = outFile.text.replace(/<\/script>/gi, "<\\/script>");

const html = readFileSync(template, "utf-8").replace(
  "<!-- BUNDLE -->",
  `<script>${js}</script>`,
);

writeFileSync(out, html);

console.log(
  `[build-editor] ${entry} -> ${out}  (${js.length.toLocaleString()} bytes JS${isDev ? ", dev" : ", minified"})`,
);
