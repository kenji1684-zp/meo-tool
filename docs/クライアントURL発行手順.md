# クライアント用 閲覧専用URL 発行手順

## しくみ

- URL: `https://meo-tool-nine.vercel.app/c/<トークン>`
- ログイン不要。トークンに紐づく **1社分だけ** を表示（他社データはサーバー側で除外）
- 表示内容: 表示回数・行動（前月比つき）／日別グラフ／対策キーワードのマップ順位／検索キーワード
- 閲覧のみ（キーワード編集・写真・クチコミ返信・全社比較は出ない）
- 検索エンジンには載らない（noindex）
- URLが無効・停止済みの場合は 404

## 初回だけ：今回の改修を本番に反映（PowerShell）

```powershell
cd C:\Projects\meo-tool-new
git pull                       # GitHubの最新（毎日の順位データ）を取り込む
git add src scripts docs .env.local.example
git commit -m "feat: クライアント向け閲覧専用URL (/c/[token])"
git push                       # Vercel が自動で本番デプロイ
```

## 1社ごとのURL発行（例：エコリース）

### ① トークンを発行
```powershell
cd C:\Projects\meo-tool-new
node scripts/issue-client-url.mjs            # 会社ID一覧を表示
node scripts/issue-client-url.mjs ecolease   # エコリース用を発行
```
「クライアントに送るURL」と「CLIENT_ACCESS に追加する値」（`ecolease:xxxxxxxx`）が表示されます。

### ② Vercel に登録
1. https://vercel.com → プロジェクト **meo-tool** → **Settings** → **Environment Variables**
2. Key: `CLIENT_ACCESS`
   - 初回: Value に `ecolease:xxxxxxxx` を貼り付け、Environment は **Production** にチェック → Save
   - 2社目以降: 既存の `CLIENT_ACCESS` を Edit し、末尾に `,asteru:yyyyyyyy` のようにカンマ区切りで追記
3. **Deployments** → 最新のデプロイの「…」→ **Redeploy**（環境変数は再デプロイで反映）

### ③ 動作確認 → 送付
- 発行したURLをシークレットウィンドウで開き、会社名と数値を確認してから送付

## 新しいクライアントを追加するとき

1. `data/keyword-settings.json` の `companies` に会社を追加（`id` は英数字とハイフン）
2. `businessTitle` は **Googleビジネスプロフィールの店舗名と同じ表記** にする
   - 確実にするなら `locationName`（例: `"locations/1234567890"`）も入れる。入れておけば店舗名の照合に頼らず確実に紐づく
3. commit & push → 上の ①〜③

## URL を止める・作り直す

- 解約: `CLIENT_ACCESS` から該当の `会社ID:トークン` を削除 → Redeploy
- URLが漏れた: `node scripts/issue-client-url.mjs <会社ID>` で新トークンを発行し、古い値と差し替え → Redeploy（古いURLは即無効）

## 注意

- 「最新」の数字は直近2〜3日分がGoogle側の集計待ちで少なめに出ます（画面下に注記あり）
- 検索キーワードはGoogleの公開が2〜3週間遅れるため、今月を選ぶと前月分を表示します
- GBP APIの呼び出しは会社×月ごとに1時間キャッシュ（クォータ節約）
