# cosense-icon

Cosense 用のページアイコンを URL のパスから動的に生成する Cloudflare Worker。

本番URL: https://icon.soui.dev/

## 使い方

末尾セグメントがテキスト（`.svg` 拡張子は任意）、それ以前のセグメントがオプション。

```
https://icon.soui.dev/B4ゼミ.svg
https://icon.soui.dev/bg-1e293b/fg-fff/B4ゼミ.svg
https://icon.soui.dev/bg:red,fg:white/size:72/Hello.svg
https://icon.soui.dev/bg-111/fg-fae/radius-24/B4\nゼミ.svg
```

- オプションは `/` でも `,` でも区切れる
- key-value の区切りは `-` / `=` / `:` のどれでもOK
- 未知のキーは無視される
- テキスト中の `\n`（バックスラッシュ＋n）は改行

## サポートキー

| キー | エイリアス | 説明 |
| --- | --- | --- |
| `bg` | `background`, `背景` | 背景色 |
| `fg` | `color`, `text`, `文字色` | 文字色 |
| `w` | `width`, `幅` | 幅 |
| `h` | `height`, `高さ` | 高さ |
| `size` | `font-size`, `文字サイズ` | フォントサイズ（未指定なら自動） |
| `weight` | `font-weight`, `bold` | フォントの太さ |
| `font` | `font-family`, `family` | フォントファミリー |
| `padding` | `p` | 余白 |
| `radius` | `r`, `rounded` | 角丸半径 |
| `lh` | `line-height` | 行高倍率 |
| `ls` | `letter-spacing` | 字間 |
| `align` | `text-align` | `left` / `center` / `right` |

色は `#` 付き/なしの 3/4/6/8 桁 hex、CSS 色名、`rgb()` / `hsl()` に対応。

## 開発

```bash
npm install
npm run dev       # ローカルで http://localhost:8787
npm test          # パーサー + SVG のユニットテスト
npm run typecheck
npm run deploy    # 手動デプロイ（通常はGitHub Actionsが走る）
```

## 自動デプロイ

`main` ブランチへの push で `.github/workflows/deploy.yml` が走り、テスト後に Cloudflare にデプロイする。

### 事前設定

1. Cloudflare に `soui.dev` ゾーンを登録して DNS を Cloudflare 経由にする
2. Cloudflare ダッシュボードで API トークンを発行（`Edit Cloudflare Workers` テンプレート）
3. GitHub リポジトリの Secrets に以下を設定
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. 初回デプロイ後、`wrangler.toml` の `routes` で `icon.soui.dev/*` が紐付く
