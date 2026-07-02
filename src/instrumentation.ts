/**
 * Next.js Instrumentation Hook
 * サーバー起動時に node-cron でキーワード自動チェックをスケジュール
 */

export async function register() {
  // Node.js ランタイムのみ（Edge では実行しない）
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const port = process.env.PORT ?? 3000

  // サーバー起動後、少し待ってからチェック実行
  setTimeout(async () => {
    try {
      const { getKeywordSettings, loadMonthRankings } = await import('@/lib/keyword-store')
      const settings = getKeywordSettings()

      // 設定が未登録なら何もしない
      if (!settings.locationName || settings.keywords.length === 0) {
        console.log('[Scheduler] キーワード設定未登録のためスキップ')
        return
      }

      // 今日のデータがすでにあればスキップ
      const now   = new Date()
      const year  = now.getFullYear()
      const month = now.getMonth() + 1
      const day   = now.getDate()
      const existing = loadMonthRankings(settings.locationName, year, month)

      if (existing[day]) {
        console.log(`[Scheduler] 本日(${year}/${month}/${day})のデータは取得済みのためスキップ`)
        return
      }

      // 未取得なら自動チェック実行
      console.log(`[Scheduler] 本日(${year}/${month}/${day})のキーワード順位を自動チェック中...`)
      const res  = await fetch(`http://localhost:${port}/api/keywords/auto`)
      const data = await res.json()
      console.log('[Scheduler] 自動チェック完了:', data)
    } catch (err) {
      console.error('[Scheduler] 自動チェックエラー:', err)
    }
  }, 10000) // サーバー起動10秒後に実行

  console.log('[Scheduler] 起動時キーワード自動チェックを登録しました')
}
