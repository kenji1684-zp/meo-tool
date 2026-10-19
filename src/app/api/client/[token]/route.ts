/**
 * クライアント向け閲覧専用 API
 * GET /api/client/<token>?type=performance|keywords|rankings&yearmonth=YYYY/MM
 *
 * - トークンに紐づく 1 社分のデータだけを返す（location はサーバー側で決定し、外から指定させない）
 * - 読み取り専用。デモデータへのフォールバックはしない（偽データを本物として見せない）
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAccessToken } from '@/lib/admin-token'
import { resolveClientByToken, resolveClientLocation } from '@/lib/client-access'
import { loadMonthRankingsById } from '@/lib/keyword-store'
import {
  fetchDailyMetrics,
  fetchSearchKeywords,
  getMonthRange,
  METRIC_LABELS,
  MetricType,
} from '@/lib/gbp-client'

export const dynamic = 'force-dynamic'

const METRICS: MetricType[] = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'WEBSITE_CLICKS',
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
]

// GBP API のクォータ節約用キャッシュ（同じ会社・同じ月は 1 時間使い回す）
const cache = new Map<string, { data: unknown; expiresAt: number }>()
const TTL = 60 * 60_000

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.data as T
  const data = await fn()
  cache.set(key, { data, expiresAt: Date.now() + TTL })
  return data
}

function parseYearMonth(ym: string | null): { year: number; month: number } {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (ym) {
    const [y, m] = ym.split(/[/-]/).map(Number)
    if (y >= 2020 && y <= 2100 && m >= 1 && m <= 12) {
      year = y
      month = m
    }
  }
  return { year, month }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const company = resolveClientByToken(params.token)
  if (!company) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'performance'
  const { year, month } = parseYearMonth(searchParams.get('yearmonth'))
  const ymKey = `${year}-${month}`

  // ---- キーワード順位（GitHub Actions が保存した JSON） ----
  if (type === 'rankings') {
    return NextResponse.json({
      keywords: company.keywords,
      rankings: loadMonthRankingsById(company.id, year, month),
    })
  }

  try {
    const adminToken = await getAdminAccessToken()
    const location = await resolveClientLocation(company, adminToken)
    if (!location) {
      return NextResponse.json(
        { error: 'Googleビジネスプロフィールの店舗が見つかりません。担当者にお問い合わせください。' },
        { status: 404 },
      )
    }

    // ---- 検索キーワード（月次） ----
    if (type === 'keywords') {
      const kw = await cached(`kw:${company.id}:${ymKey}`, () =>
        fetchSearchKeywords(adminToken, location.name, year, month),
      )
      return NextResponse.json({ keywords: kw.keywords.slice(0, 30), keywordsMonth: kw.yearmonth })
    }

    // ---- パフォーマンス（日別） ----
    const data = await cached(`perf:${company.id}:${ymKey}`, async () => {
      const { startDate, endDate } = getMonthRange(year, month)
      const raw = await fetchDailyMetrics(adminToken, {
        locationName: location.name,
        startDate,
        endDate,
        metrics: METRICS,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return raw.map((m: any) => {
        const metric = m.dailyMetric as MetricType
        const points = (m.timeSeries?.datedValues ?? []).map(
          (dv: { date: { year: number; month: number; day: number }; value?: string }) => ({
            day: dv.date.day,
            value: parseInt(dv.value ?? '0'),
          }),
        )
        return {
          metric,
          label: METRIC_LABELS[metric] ?? metric,
          total: points.reduce((s: number, p: { value: number }) => s + p.value, 0),
          data: points,
        }
      })
    })

    return NextResponse.json({ yearmonth: `${year}/${String(month).padStart(2, '0')}`, metrics: data })
  } catch (err) {
    console.error('client API error:', company.id, err)
    const message = err instanceof Error ? err.message : ''
    const friendly = message.includes('429')
      ? 'Googleのデータ取得が混み合っています。しばらくしてから再読み込みしてください。'
      : 'データを取得できませんでした。時間をおいて再度お試しください。'
    return NextResponse.json({ error: friendly }, { status: 502 })
  }
}
