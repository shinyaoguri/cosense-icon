# cosense-icon

Cosense 用のページアイコンを URL のパスから動的に生成する Cloudflare Worker。

本番URL: https://icon.soui.dev/ （ビジュアルエディタ）

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

トップページ（`/`）は色・サイズ・フォント等をスライダーで調整し、コントラスト比をリアルタイム確認しながら URL を組み立てるビジュアルエディタ。ランダム配色ボタンは WCAG AA (4.5:1) を満たす配色を自動生成する。

## サポートキー

| キー | エイリアス | デフォルト | 説明 |
| --- | --- | --- | --- |
| `bg` | `background`, `背景` | `#ffffff` | 背景色 |
| `fg` | `color`, `text`, `文字色` | `#222222` | 文字色 |
| `w` | `width`, `幅` | `600` | 幅 (px) |
| `h` | `height`, `高さ` | `400` | 高さ (px) |
| `size` | `font-size`, `文字サイズ` | 自動 | フォントサイズ (未指定なら viewport にフィット) |
| `weight` | `font-weight`, `bold` | `700` | フォントの太さ |
| `font` | `font-family`, `family` | `sans` | フォントファミリー |
| `padding` | `p` | `24` | 余白 |
| `radius` | `r`, `rounded` | `0` | 角丸半径 |
| `lh` | `line-height` | `1.2` | 行高倍率 |
| `ls` | `letter-spacing` | `0` | 字間 |
| `align` | `text-align` | `center` | `left` / `center` / `right` |

色は `#` 付き/なしの 3/4/6/8 桁 hex、CSS 色名、`rgb()` / `hsl()` に対応。

### フォントショートカット

`font` には以下のキーワードでフォントスタックを展開できる。任意のフォント名も指定可能（ただしカンマは使えない）。

| キー | 内容 |
| --- | --- |
| `sans` / `gothic` | ゴシック系 (Hiragino Sans, Noto Sans JP 等) |
| `serif` / `mincho` | 明朝系 (Hiragino Mincho ProN, Noto Serif JP 等) |
| `rounded` | 丸ゴシック系 (Hiragino Maru Gothic ProN 等) |
| `mono` | 等幅 (ui-monospace, SFMono-Regular 等) |

## 動的キーワード（常に最新）

以下のパスは**アクセス時点**の情報に書き換わる。キャッシュされない（`no-store`）。

| パス | 例 (2026-04-19 JST) |
| --- | --- |
| `/today.svg` (`/今日.svg`) | `2026` / `04/19` / `(日)` の3行 |
| `/week.svg` (`/今週.svg`) | `2026` / `W16` |
| `/month.svg` (`/今月.svg`) | `2026/04` |
| `/year.svg` (`/今年.svg`) | `2026` |

通常のオプションと組み合わせられる: `/bg-1e40af/fg-fff/today.svg`

タイムゾーンは Asia/Tokyo 固定。週番号は ISO 8601 準拠。

## キャッシュ戦略

- 通常の SVG: `cache-control: public, max-age=31536000, immutable`。さらに Cloudflare の Cache API でエッジキャッシュに書き込み、2回目以降のリクエストは Worker 実行を経由せず返る。
- 動的キーワード: `cache-control: no-store`, `cdn-cache-control: no-store` でブラウザ・CDN・Cache API すべてを回避。

## 開発

```bash
npm install
npm run dev       # ローカルで http://localhost:8787
npm test          # パーサー / SVG / 動的キーワード のユニットテスト
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
4. 初回デプロイ後、`wrangler.toml` の `routes` で `icon.soui.dev` がカスタムドメインとして紐付く
