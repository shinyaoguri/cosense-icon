# cosense-icon

Cosense 用のページアイコンを URL のパスから動的に生成する Cloudflare Worker。

本番URL: https://icon.soui.dev/ (ビジュアルエディタ)

## 使い方

末尾セグメントがテキスト (`.svg` 拡張子は任意)、それ以前のセグメントがオプション。

```
https://icon.soui.dev/B4ゼミ.svg
https://icon.soui.dev/bg-1e293b/fg-fff/B4ゼミ.svg
https://icon.soui.dev/bg:red,fg:white/size:72/Hello.svg
https://icon.soui.dev/bg-111/fg-fae/radius-24/B4\nゼミ.svg
```

- オプションは `/` でも `,` でも区切れる
- key-value の区切りは `-` / `=` / `:` のどれでもOK
- 未知のキーは無視される
- テキスト中の `\n` (バックスラッシュ + n) は改行
- `.svg` を外すと、その状態をフォームに復元したエディタが開く (URL = ステート)

トップページ (`/`) は色・サイズ・フォント等を編集してコントラスト比をリアルタイム確認しながら URL を組み立てるビジュアルエディタ。プレビューは PowerPoint/Keynote 風のハンドル UI で幅・高さ・余白・角丸を直接操作でき、ランダム配色は WCAG AA (4.5:1) を満たす配色を自動生成する。

## サポートキー

| キー | エイリアス | デフォルト | 説明 |
| --- | --- | --- | --- |
| `bg` | `background`, `背景` | `#ffffff` | 背景色 |
| `fg` | `color`, `text`, `文字色` | `#000000` | 文字色 |
| `w` | `width`, `幅` | `600` | 幅 (px) |
| `h` | `height`, `高さ` | `400` | 高さ (px) |
| `size` | `font-size`, `文字サイズ` | 自動 | フォントサイズ (未指定なら viewport にフィット) |
| `weight` | `font-weight`, `bold` | `700` | フォントの太さ |
| `font` | `font-family`, `family` | `sans` | フォントファミリー |
| `padding` | `p` | `24` | 余白 |
| `radius` | `r`, `rounded`, `border-radius` | `0` | 角丸半径 |
| `lh` | `line-height` | `1.2` | 行高倍率 |
| `ls` | `letter-spacing` | `0` | 字間 |
| `align` | `text-align` | `center` | `left` / `center` / `right` / `justify` |
| `rotate` | `rot` | `0` | 90° 単位の回転 (`0` / `90` / `180` / `270`) |
| `shadow` | `shadow-color` | (off) | 影色を指定すると有効化 (例: `shadow-000`) |
| `blur` | `shadow-blur` | `4` | 影のぼかし半径 |
| `stroke` | `outline` | (off) | 縁取り色 |
| `stroke-w` | `stroke-width` | `0` | 縁取り幅 (px) |
| `grad` | `grad-to`, `to` | (off) | グラデーション終点色 (`bg` を始点に) |
| `angle` | `grad-angle` | `135` | グラデーションの角度 (deg) |
| `tz` | `timezone`, `タイムゾーン` | 自動判定 | 動的キーワードの基準TZ |

色は `#` 付き/なしの 3/4/6/8 桁 hex、CSS 色名、`rgb()` / `hsl()` に対応。

### フォントショートカット

`font` には以下のキーワードでフォントスタックを展開できる。任意のフォント名も指定可能 (ただしカンマは使えない)。

| キー | 内容 |
| --- | --- |
| `sans` / `gothic` | ゴシック系 (Hiragino Sans, Noto Sans JP 等) |
| `serif` / `mincho` | 明朝系 (Hiragino Mincho ProN, Noto Serif JP 等) |
| `rounded` | 丸ゴシック系 (Hiragino Maru Gothic ProN 等) |
| `mono` | 等幅 (ui-monospace, SFMono-Regular 等) |

## ランダム配色

パスに `/random/` セグメントを含めると、**テキストから決定的に生成したランダム配色** (WCAG AA 4.5:1 準拠) で bg/fg が埋まる。

```
/random/hoge.svg
/random/radius-24/size-72/hoge.svg   # 他オプションと併用可
/bg-red/random/hoge.svg              # 明示指定した bg/fg は尊重される
```

- 同じテキストなら常に同じ色になる (ハッシュベース)。同じ URL を再訪すれば必ず同じ色に戻る
- 位置は任意 (先頭でも途中でも可)、大文字小文字を区別しない
- 明示された `bg` / `fg` はランダムで上書きされない

## 動的キーワード (常に最新)

以下のパスは**アクセス時点**の情報に書き換わる。キャッシュされない (`no-store`)。

| パス | ビジュアル |
| --- | --- |
| `/today.svg` (`/今日.svg`) | `MM/DD` を大きく、下に小さく `(曜日)` |
| `/week.svg` (`/今週.svg`) | 月曜〜日曜の7セル表、今日のセルを反転塗り |
| `/month.svg` (`/今月.svg`) | 6週×7日のカレンダーグリッド、今日ハイライト、隣接月は薄色 |
| `/year.svg` (`/今年.svg`) | 53週×7日のヒートマップ。経過日は濃色、本日は縁取り、未来は薄色 |

通常のオプションと組み合わせられる: `/bg-1e40af/fg-fff/radius-24/today.svg`

週は ISO 8601 準拠 (月曜始まり)。

### タイムゾーン

優先度は **明示指定 > 自動判定 > `Asia/Tokyo` デフォルト**。

- **明示指定**: `/tz-<tz>/today.svg`。`/` は `%2F` でエンコード (例: `/tz-Asia%2FTokyo/today.svg`)、またはショートカットを使う
- **自動判定**: Cloudflare がアクセス元IPから推定したタイムゾーン (`request.cf.timezone`)
- **デフォルト**: `Asia/Tokyo`

ショートカット: `jst` / `utc` / `et`(`est`/`edt`) / `pt`(`pst`/`pdt`) / `ct` / `mt` / `cet` / `gmt` / `bst` / `ist` / `kst`

例: `/tz-et/today.svg`, `/tz-utc/month.svg`

## Google Fonts 対応

`font` にエディタの Google Fonts リストから選んだファミリ名を指定すると、**エディタでブラウザ側 Path 化した SVG** が R2 に登録され、URL 経由でどこからでも同じ見た目で配信される。

- エディタで対象フォントを選び「コピー」を押す → Turnstile 認証 → R2 登録 → クリップボードに URL
- 以降、同じ URL は R2 から配信される (Cache API でエッジキャッシュも作る)
- R2 miss 時は `<text>` フォールバックで描画し、右下に**「エディタで再生成」のチップマーカー**を付与 (短 TTL)。クリックでエディタが開いて自動で登録フローが起動する (`/?regen=base64(pathname)` 形式)
- 対応ファミリは [src/editor/fonts.ts](src/editor/fonts.ts) の `GOOGLE_FONTS` 定数で管理

動的キーワード (`today` / `week` / `month` / `year`) は対象外。

フォントは [Google Fonts](https://fonts.google.com/) から CSS2 API 経由で取得し、ブラウザ上で [opentype.js](https://github.com/opentypejs/opentype.js) と [wawoff2](https://github.com/fontello/wawoff2) を使って Path に変換する。ライセンスは配信元の OFL / Apache 2.0。

## ビジュアルエディタの機能

`/` または `.svg` 拡張子なしの任意のパスでアクセスするとエディタ HTML が返る。主な機能:

- **URL ↔ ステートの双方向同期**: 編集中はブラウザ URL が `history.replaceState` で更新され、URL を共有すれば誰でも同じ状態を再現できる
- **Keynote 風塗りインスペクタ**: 単色 / グラデーションをセグメントコントロールで切替。グラデは「開始 / 終了」を縦並び + ジョイスティック式の角度ダイヤルで直感操作 (Shift で 1° 刻み、デフォルトは 15° スナップ、矢印キー対応)
- **プレビュー直接操作**: PowerPoint 風の 8 ハンドル + 余白ハンドル + 角丸ハンドルで幅・高さ・余白・角丸をドラッグ。回転状態にも追従
- **影・縁取り**: SVG `feDropShadow` + `paint-order: stroke fill` でリッチな表現
- **シェアドロップダウン**: ヘッダーから URL / Cosense 記法 / Markdown のコピー、SVG / PNG / PNG @2x / PNG @3x のダウンロードを 1 つのメニューに統合
- **お気に入り (右ペイン)**: 現在の状態を `localStorage` に保存して再利用。サムネ + ラベル + 削除ボタン付きで、ペインの開閉状態も保存される
- **絵文字ピッカー**: ~1000 絵文字をカテゴリタブ + キーワード検索付きでテキスト中に挿入
- **Undo / Redo**: デバウンス付きスナップショットで `⌘Z` / `⌘⇧Z`
- **キーボードショートカット**: `R` 配色ランダム / `F` フォントランダム / `[` `]` 回転 / `⌘±` 字サイズ / `?` ヘルプ
- **ランダム配色 / フォント**: WCAG AA を満たすペアの自動生成 + ダイス UI
- **トースト通知**: 画面上部中央。Google Fonts 登録の各段階 (フォント取得 → Path 化 → Turnstile → R2 登録) を逐次表示
- **localStorage 保存**: 最後の編集状態と開閉ペイン状態を `cosense-icon:lastPath` / `cosense-icon:favorites` / `cosense-icon:favPaneOpen` に保持
- **OGP メタ動的化**: アクセスされた URL に対応する SVG を `og:image` として埋め込む (Cosense / Discord 等の SNS 用)
- **PWA**: `/manifest.webmanifest` + `/sw.js` を Worker が配信、ホーム画面追加とオフラインキャッシュに対応 (詳細は後述)

エディタのテンプレートは [src/editor/editor.template.html](src/editor/editor.template.html)、ロジックは [src/editor/](src/editor/) 配下の TypeScript モジュール群。`scripts/build-editor.mjs` が `main.ts` を esbuild で IIFE バンドルし、`<!-- BUNDLE -->` プレースホルダに差し込んで `src/editor.html` を生成する。`src/editor.html` は Worker 起動時に文字列としてインポートされる。

## キャッシュ戦略

- 通常の SVG: `cache-control: public, max-age=31536000, immutable`。さらに Cloudflare の Cache API でエッジキャッシュに書き込み、2 回目以降のリクエストは Worker 実行を経由せず返る
- R2 登録済みの Google Fonts SVG: 同じく immutable + Cache API
- R2 未登録時のフォールバック: `public, max-age=15, stale-while-revalidate=45`。Cache API には書き込まない (再登録後すぐ切り替わるように)
- 動的キーワード: `cache-control: no-store`, `cdn-cache-control: no-store` でブラウザ・CDN・Cache API すべてを回避
- エディタ HTML: `public, max-age=300`
- マニフェスト: `public, max-age=3600`
- Service Worker (`/sw.js`): `no-cache, max-age=0, must-revalidate`

### Google Fonts 登録の伝播ウインドウ

未登録 URL を Cosense 等で先に共有 → その後エディタで登録した場合、登録版に切り替わるまでのおおよその所要時間:

| 視聴環境 | 切り替えタイミング |
| --- | --- |
| エディタ本人 (登録直後) | 即時 (`?_=timestamp` でキャッシュバスト) |
| 一般ブラウザ (Cosense / Slack 等の埋め込み) | 最大 60 秒 (`max-age=15` + `SWR=45`) |
| エディタを PWA 化したクライアント | 即時 (アイコン SVG は SW で network-first) |
| Discord 等の独自画像プロキシ | 不定 (相手側の TTL に依存。日単位のことも) |

未登録時は `<text>` フォールバック SVG の右下に「エディタで再生成」のチップマーカーが付き、クリックするとエディタが開いて自動で登録フローが起動する ([buildRegenUrl](src/registry.ts) の `/?regen=base64(pathname)`)。

### KEY_VERSION の運用

[src/registry.ts](src/registry.ts) の `KEY_VERSION` は R2 キーと Cache API キーの prefix。SVG レンダリング仕様 ([src/svg.ts](src/svg.ts) / [src/dynamic.ts](src/dynamic.ts)) を変更して「同じオプション集合でも見た目が変わる」非互換変更を入れる場合は必ず bump (`v1` → `v2`)。新オプションを追加するだけならハッシュに含まれるため bump 不要。

## PWA

Worker が以下を配信する。

- `/manifest.webmanifest` — `name` / `short_name` / `icons` / `theme_color` 等
- `/sw.js` — Service Worker (シェル + フォント CDN を cache-first、HTML を network-first → cache fallback)
- `/cosense-icon.svg` — favicon / icon (`purpose: any`)
- `/cosense-icon-maskable.svg` — Android 用 maskable アイコン

`main.ts` 末尾で `navigator.serviceWorker.register("/sw.js")` を呼び出し、初回訪問でシェルがキャッシュされる。以後はオフラインでもエディタが起動し、過去に取得した SVG プレビューも復元できる。

## 開発

```bash
npm install
npm run dev               # ローカル http://localhost:8787 (build:editor:dev も同時実行)
npm test                  # parser / svg / dynamic / registry テスト
npm run typecheck         # ルート + tsconfig.editor.json の両方
npm run build:editor      # 本番用 (minify) で src/editor.html を生成
npm run build:editor:dev  # dev 用 (sourcemap, no minify)
npm run deploy            # Cloudflare に手動デプロイ (通常は GitHub Actions)
```

## 自動デプロイ

`main` ブランチへの push で `.github/workflows/deploy.yml` が走り、テスト後に Cloudflare へデプロイする。

### 事前設定

1. Cloudflare に `soui.dev` ゾーンを登録して DNS を Cloudflare 経由にする
2. Cloudflare ダッシュボードで API トークンを発行 (`Edit Cloudflare Workers` テンプレート)
3. GitHub リポジトリの Secrets に以下を設定
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. 初回デプロイ後、`wrangler.toml` の `routes` で `icon.soui.dev` がカスタムドメインとして紐付く
5. **R2 バケット**: Cloudflare ダッシュボードで `cosense-icon-paths` を作成 ([wrangler.toml](wrangler.toml) の `bucket_name` と一致させる)
6. **Turnstile**: ダッシュボードの Turnstile で widget を追加 (ドメインに `icon.soui.dev` を登録)。site key を [src/editor/turnstile.ts](src/editor/turnstile.ts) の `TURNSTILE_SITE_KEY_PROD` 定数に、secret key を `wrangler secret put TURNSTILE_SECRET` で登録する
7. **ローカル開発用 secret**: `.dev.vars` に `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` (Cloudflare 公式の test secret) を書く。エディタは `localhost` アクセス時に自動で test site key へ切り替わる

## ディレクトリ構成

```
src/
├─ index.ts            Worker エントリ。ルーティング (SVG / エディタ / API / マニフェスト / SW)
├─ parser.ts           URL パスから IconOptions へ
├─ svg.ts              IconOptions から SVG 文字列を生成 (回転 / 影 / 縁取り / グラデ)
├─ dynamic.ts          today / week / month / year のレンダラ
├─ random.ts           テキスト → ハッシュ → WCAG AA 配色
├─ registry.ts         R2 キー / 警告マーカー / sanitize / Turnstile 検証
├─ editor.html         build スクリプトで生成される HTML (Git 管理対象)
└─ editor/             エディタの TypeScript モジュール群
   ├─ editor.template.html  HTML テンプレート (CSS 含む)
   ├─ main.ts          エントリ。各モジュールの配線と update() ループ
   ├─ state.ts         フォーム値の読み取り / URL 生成
   ├─ pathname.ts      URL → フォーム復元
   ├─ preview.ts       プレビュー画像更新
   ├─ previewResize.ts ハンドル・余白・角丸の操作
   ├─ pathify.ts       Google Fonts → SVG パス
   ├─ register.ts      R2 登録 (フォント取得 → Path 化 → Turnstile → POST)
   ├─ turnstile.ts     Turnstile widget の管理 (modal 表示)
   ├─ favorites.ts     お気に入り (localStorage)
   ├─ history.ts       Undo / Redo
   ├─ emoji.ts         絵文字ピッカー
   ├─ toast.ts         トースト通知
   ├─ download.ts      SVG / PNG ダウンロード (Canvas 経由)
   ├─ fontPicker.ts    フォントピッカー UI
   ├─ fonts.ts         GOOGLE_FONTS リスト + フォントスタック展開
   ├─ colors.ts        コントラスト比計算 / ランダム配色
   ├─ presets.ts       色 / フォント適用
   └─ dom.ts           DOM ヘルパ ($, $input, $select, $textarea)

scripts/
└─ build-editor.mjs   esbuild で main.ts をバンドル → editor.html

test/
└─ *.test.ts          parser / svg / dynamic / registry / random
```

## ライセンス

[MIT License](LICENSE) — Copyright (c) 2026 Shinya Oguri

このプロジェクトが利用している主な OSS:

- [opentype.js](https://github.com/opentypejs/opentype.js) (MIT)
- [wawoff2](https://github.com/fontello/wawoff2) (MIT)
- [Google Fonts](https://fonts.google.com/) ファミリ各種 (OFL / Apache 2.0)
