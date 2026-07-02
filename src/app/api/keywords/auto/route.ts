/**
 * 自動キーワード順位チェック API
 * - GET /api/keywords/auto → サーバー設定のキーワードを自動チェックしてファイル保存
 * - node-cron (instrumentation.ts) から毎日AM9:00に呼ばれる
 */

import { NextResponse } from 'next/server'
import { getKeywordSettings, saveRankings } from '@/lib/keyword-store'
import { format } from 'date-fns'

export async function GET() {
  try {
    const settings = getKeywordSettings()

    if (!settings.locationName || settings.keywords.length === 0) {
      return NextResponse.json(
        { error: 'キーワード設定が未登録です。キーワード順位ページで「設定を保存」してください。' },
        { status: 400 },
      )
    }

    const port = process.env.PORT ?? 3000
    const url  = `http://localhost:${port}/api/keywords?location=${encodeURIComponent(settings.locationName)}&keywords=${encodeURIComponent(settings.keywords.join(','))}`

    const res  = await fetch(url)
    if (!res.ok) throw new Error(`keywords API error: ${res.status}`)
    const data = await res.json() as { rankings?: { keyword: string; currentRank: number | null }[] }

    const rankings = (data.rankings ?? []).map(r => ({
      keyword: r.keyword,
      rank:    r.currentRank,
    }))

    const today = format(new Date(), 'yyyy-MM-dd')
    saveRankings(settings.locationName, today, rankings)

    console.log(`[Auto] ${today} キーワード順位チェック完了 (${rankings.length}件)`)
    return NextResponse.json({ ok: true, date: today, count: rankings.length })
  } catch (err) {
    console.error('[Auto] キーワード順位チェックエラー:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
