/**
 * サーバーサイドで管理者の Google アクセストークンを取得する
 * スタッフアカウントでログインしても、GBP API は管理者権限で呼び出す
 */

interface CachedToken {
  accessToken: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

export async function getAdminAccessToken(): Promise<string> {
  // キャッシュが有効なら再利用（期限60秒前まで）
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken
  }

  const refreshToken  = process.env.GOOGLE_ADMIN_REFRESH_TOKEN
  const clientId      = process.env.GOOGLE_CLIENT_ID
  const clientSecret  = process.env.GOOGLE_CLIENT_SECRET

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('GOOGLE_ADMIN_REFRESH_TOKEN / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です')
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })

  const data = await res.json()
  if (!data.access_token) {
    throw new Error(`トークン更新失敗: ${JSON.stringify(data)}`)
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt:   Date.now() + (data.expires_in ?? 3600) * 1000,
  }

  return cachedToken.accessToken
}
