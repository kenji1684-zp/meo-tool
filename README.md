# MEO管理ツール

GoogleビジネスプロフィールのAPIと連携した、MEO分析・管理ダッシュボードです。

## 機能一覧

| 機能 | 説明 |
|------|------|
| 📊 ダッシュボード | 月次サマリー・KPI一覧 |
| 📈 パフォーマンス分析 | 検索表示・クリック数の日別グラフ |
| 🔍 キーワード順位 | Google Maps上のキーワード別順位確認 |
| ⭐ クチコミ管理 | レビュー一覧・返信送信 |

---

## セットアップ手順

### 1. リポジトリのクローン・依存インストール

```bash
git clone <this-repo>
cd meo-tool
npm install
```

### 2. Google Cloud Console の設定

#### A. プロジェクト作成 & APIの有効化

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクトを作成（例: `meo-tool`）
3. 「APIとサービス」→「ライブラリ」から以下を **有効化**:

   | API名 | 用途 |
   |-------|------|
   | **My Business Account Management API** | アカウント・ロケーション管理 |
   | **My Business Business Information API** | 店舗情報取得 |
   | **Business Profile Performance API** | パフォーマンスデータ |
   | **My Business Reviews API** | クチコミ取得・返信 |
   | **Places API (New)** | キーワード順位確認 |

   > ⚠️ Business Profile APIは申請が必要な場合があります。
   > [申請フォーム](https://support.google.com/business/contact/business_profile_api)

#### B. OAuth 2.0 認証情報の作成

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
2. アプリの種類: **ウェブアプリケーション**
3. 承認済みリダイレクトURIに追加:
   ```
   http://localhost:3000/api/auth/callback/google
   https://yourdomain.com/api/auth/callback/google  ← 本番用
   ```
4. クライアントIDとクライアントシークレットをコピー

#### C. Places API キーの作成

1. 「認証情報を作成」→「APIキー」
2. キーを制限（推奨）: Places API のみ許可
3. APIキーをコピー

---

### 3. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集:

```env
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# openssl rand -base64 32 で生成
NEXTAUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxx

NEXTAUTH_URL=http://localhost:3000

# Places API (キーワード順位機能用)
GOOGLE_PLACES_API_KEY=AIzaXXXXXXXXXXXXXXXXXXXX

# アクセス制限（オプション）
ALLOWED_EMAILS=admin@example.com,manager@example.com

# 店舗の緯度経度（キーワード検索の基準位置）
DEFAULT_LAT=34.6937
DEFAULT_LNG=135.5023
```

---

### 4. 起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開き、Googleアカウントでログイン。

---

## 本番デプロイ（Vercel）

```bash
npm install -g vercel
vercel --prod
```

Vercelダッシュボードで Environment Variables に `.env.local` の内容を設定してください。

---

## プロジェクト構成

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth ハンドラー
│   │   ├── business/            # ロケーション一覧API
│   │   ├── performance/         # パフォーマンスデータAPI
│   │   ├── keywords/            # キーワード順位API
│   │   └── reviews/             # クチコミ・返信API
│   ├── dashboard/
│   │   ├── page.tsx             # ダッシュボード
│   │   ├── performance/         # パフォーマンスページ
│   │   ├── keywords/            # キーワード順位ページ
│   │   └── reviews/             # クチコミ管理ページ
│   └── login/                   # ログインページ
├── components/
│   └── ui/Sidebar.tsx           # サイドバーナビゲーション
├── lib/
│   └── gbp-client.ts            # Google Business Profile APIクライアント
└── types/
    └── index.ts                 # 型定義
```

---

## API制限・注意事項

- Business Profile Performance API: **90日以内**のデータのみ取得可能
- Reviews API: 1リクエストあたり最大**50件**まで
- Places API (New): キーワード検索1回ごとに課金発生（月$200の無料枠あり）
- Business Profile API は**申請承認**が必要な場合があります

---

## ライセンス

MIT
