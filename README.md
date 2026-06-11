# 🧾 レシート家計簿

スマホでレシートを撮影するだけで、Claude AI が自動で内容を読み取り Google スプレッドシートに記録してくれる個人用 Web アプリ。

## 機能

- 📷 スマホカメラ撮影 / ギャラリーから選択（HEIC 対応）
- 🤖 Claude Haiku (Vision) でレシートを自動解析（店名・日付・カテゴリ・品目・金額）
- ✏️ 読み取り結果を確認・編集
- 📊 Google スプレッドシートへ自動記録
- 📋 記録済み履歴の一覧表示
- 🔒 Cloudflare Access で認証（自分のアカウントのみアクセス可）

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | React + Vite + Tailwind CSS |
| API / AI 読み取り | Cloudflare Pages Functions + Claude Haiku 4.5 Vision |
| データ保存 | Google スプレッドシート（Sheets API v4） |
| ホスティング | Cloudflare Pages（GitHub 連携で自動デプロイ） |
| 認証 | Cloudflare Access（Zero Trust、Google ログイン） |

## コスト目安

月 60 枚撮影した場合、Claude Haiku の Vision 料金は **約 2〜7 円**（2025 年時点）。Cloudflare Pages / Zero Trust は個人利用の範囲では無料枠内。

---

## セットアップ

### 1. Anthropic API キーの取得

1. [Anthropic Console](https://console.anthropic.com) でアカウントを作成
2. API キーを発行してメモする

### 2. Google Cloud の設定

1. [Google Cloud Console](https://console.cloud.google.com) でプロジェクトを作成
2. **Google Sheets API** を有効化
3. **サービスアカウント**を作成し、JSON キーをダウンロード
4. キーファイルから以下の値を取り出す
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`（`\n` エスケープ済みの1行文字列）

### 3. Google スプレッドシートの準備

1. 新規スプレッドシートを作成
2. A1 行にヘッダーを記入（任意）: `日付 | 店名 | カテゴリ | 品目 | 合計金額 | 消費税 | 記録日時`
3. スプレッドシートをサービスアカウントのメールアドレス（`...@...iam.gserviceaccount.com`）に **編集者**として共有
4. URL の `/d/` と `/edit` の間の文字列が `SPREADSHEET_ID`

### 4. Cloudflare Pages のデプロイ

1. [Cloudflare Pages](https://pages.cloudflare.com) でプロジェクト作成
2. GitHub リポジトリ `receipt-kakeibo` を接続
3. ビルド設定:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables**（Encrypt）に以下を登録:
   ```
   ANTHROPIC_API_KEY        = sk-ant-...
   GOOGLE_SERVICE_ACCOUNT_EMAIL = your-sa@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY       = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   SPREADSHEET_ID           = 1xxxxxxx...
   ```
5. カスタムドメイン `kakeibo.nodewalker.app`（任意）を割り当て

### 5. Cloudflare Access の設定

1. Cloudflare Zero Trust ダッシュボード → **Access** → **Applications** → **Add an application**
2. **Self-hosted** を選択
3. Application domain: `kakeibo.nodewalker.app`
4. ポリシーを追加:
   - Rule type: **Allow**
   - Selector: **Emails** → `your-email@gmail.com`
5. Identity providers に **Google** を追加

---

## ローカル開発

```bash
# 依存パッケージのインストール
npm install

# .dev.vars を作成して Secret を設定
cp .dev.vars.example .dev.vars
# .dev.vars を編集して実際の値を入力

# フロント開発（HMR あり）
npx wrangler pages dev -- npm run dev

# API + フロント結合確認
npm run build
npx wrangler pages dev dist
```

---

## ライセンス

MIT
