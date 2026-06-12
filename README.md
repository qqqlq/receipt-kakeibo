# レシート家計簿

スマホでレシートを撮影するだけで、Claude AI が自動で内容を読み取り Google スプレッドシートに記録してくれる個人用 Web アプリ。

## 機能

- スマホカメラ撮影 / ギャラリーから選択（HEIC 対応）
- Claude Sonnet 4.6（Vision）でレシートを自動解析（店名・日付・カテゴリ・品目・金額）
- 読み取り結果を確認・編集（カテゴリ・支払方法も選択可）
- レシートがない支出も手動入力で記録可
- Google スプレッドシートへ自動記録
- 記録済み履歴の一覧表示
- サブスク管理：毎月・毎年の課金日に自動で家計簿へ記録（Cron）
- Cloudflare Access による認証（自分のアカウントのみアクセス可）

## 技術スタック

| 役割 | 技術 |
|------|------|
| フロントエンド | React + Vite + Tailwind CSS + react-icons |
| API / AI 読み取り | Cloudflare Workers + Claude Sonnet 4.6 Vision |
| データ保存 | Google スプレッドシート（Sheets API v4） |
| ホスティング | Cloudflare Workers + Assets（GitHub 連携で自動デプロイ） |
| 認証 | Cloudflare Access（Zero Trust、Google ログイン） |

## コスト目安

月 60 枚撮影した場合、Claude Sonnet 4.6 の Vision 料金は **約 30 円**（2026 年時点）。Cloudflare Workers / Zero Trust は個人利用の範囲では無料枠内。

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

新規スプレッドシートを作成し、スプレッドシートをサービスアカウントのメールアドレスに **編集者** として共有する。

**Sheet1（家計簿）** — 1行目のヘッダー:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 日付 | 店名 | カテゴリ | 品目 | 合計金額 | 消費税 | 記録日時 | 支払方法 |

**subscriptions タブ** — 別タブを `subscriptions` という名前で作成し、1行目のヘッダー:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| サービス名 | 金額 | カテゴリ | 課金日 | 有効 | 課金タイプ | 課金月 | 支払方法 |

URL の `/d/` と `/edit` の間の文字列が `SPREADSHEET_ID`。

### 4. Cloudflare Workers のデプロイ

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com) → **Workers & Pages** → **Create application**
2. GitHub リポジトリ `receipt-kakeibo` を接続
3. ビルド設定:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables**（Encrypt）に以下を登録:
   ```
   ANTHROPIC_API_KEY            = sk-ant-...
   GOOGLE_SERVICE_ACCOUNT_EMAIL = your-sa@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY           = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   SPREADSHEET_ID               = 1xxxxxxx...
   ```
5. カスタムドメイン（例: `kakeibo.yourdomain.app`）を割り当て

### 5. Cloudflare Access の設定

1. Cloudflare Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. Application domain: デプロイしたドメインを入力
3. ポリシー: **Emails** → 自分のメールアドレスのみ Allow
4. Identity providers に **Google** を追加
5. Session Duration を **30 days** に設定すると利便性が上がる

---

## ローカル開発

```bash
# 依存パッケージのインストール
npm install

# .dev.vars を作成して Secret を設定
cp .dev.vars.example .dev.vars
# .dev.vars を編集して実際の値を入力

# ビルド + ローカルサーバー起動（API + フロント）
npm run build
npx wrangler dev

# 外部デバイス（スマホ等）からアクセスする場合
npx wrangler dev --ip 0.0.0.0
```

---

## ライセンス

MIT
