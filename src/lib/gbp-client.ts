/**
 * Google Business Profile API クライアント
 *
 * 使用する主要API:
 * - My Business Account Management API v1
 * - My Business Business Information API v1
 * - My Business Performance API v1
 */

import { GBPLocation, DailyMetricTimeSeries, Review } from '@/types'

// Business Profile Performance API v1 のメトリクス名（旧APIとは異なる）
export type MetricType =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'WEBSITE_CLICKS'
  | 'CALL_CLICKS'
  | 'BUSINESS_DIRECTION_REQUESTS'
  | 'BUSINESS_CONVERSATIONS'
  | 'BUSINESS_BOOKINGS'
  | 'BUSINESS_FOOD_ORDERS'
  | 'BUSINESS_FOOD_MENU_CLICKS'

const GBP_BASE_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1'
const GBP_INFO_URL = 'https://mybusinessbusinessinformation.googleapis.com/v1'
const GBP_PERF_URL = 'https://businessprofileperformance.googleapis.com/v1'
const REVIEWS_URL  = 'https://mybusiness.googleapis.com/v4'

// =============================================
// アカウント管理
// =============================================

/** アカウント一覧を取得 */
export async function listAccounts(accessToken: string) {
  const res = await fetch(`${GBP_BASE_URL}/accounts?pageSize=20`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('GBP ACCOUNTS RESPONSE:', text)
    throw new Error(`accounts API error: ${res.status} - ${text}`)
  }

  const data = await res.json() as {
    accounts: { name: string; accountName: string; type: string }[]
  }

  return data.accounts ?? []
}

// =============================================
// ロケーション情報
// =============================================

/** ロケーション一覧を取得 */
export async function listLocations(accessToken: string, accountName: string): Promise<GBPLocation[]> {
  const readMask = [
    'name',
    'title',
    'storefrontAddress',
    'websiteUri',
    'metadata',
  ].join(',')

  const res = await fetch(
    `${GBP_INFO_URL}/${accountName}/locations?readMask=${readMask}&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`locations API error: ${res.status}`)
  const data = await res.json()
  return data.locations ?? []
}

/** ロケーション詳細を取得 */
export async function getLocation(accessToken: string, locationName: string): Promise<GBPLocation> {
  const readMask = 'name,title,storefrontAddress,websiteUri,metadata'
  const res = await fetch(
    `${GBP_INFO_URL}/${locationName}?readMask=${readMask}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`location API error: ${res.status}`)
  return res.json()
}

// =============================================
// パフォーマンスデータ
// =============================================

export interface PerformanceQueryParams {
  locationName: string   // "locations/{locationId}"
  startDate: { year: number; month: number; day: number }
  endDate:   { year: number; month: number; day: number }
  metrics: MetricType[]
}

/** 日別パフォーマンスデータを取得 */
export async function fetchDailyMetrics(
  accessToken: string,
  params: PerformanceQueryParams
): Promise<DailyMetricTimeSeries[]> {
  // fetchMultiDailyMetricsTimeSeries は GET + クエリパラメータ
  const qs = new URLSearchParams()
  for (const metric of params.metrics) {
    qs.append('dailyMetrics', metric)
  }
  qs.set('dailyRange.startDate.year',  String(params.startDate.year))
  qs.set('dailyRange.startDate.month', String(params.startDate.month))
  qs.set('dailyRange.startDate.day',   String(params.startDate.day))
  qs.set('dailyRange.endDate.year',    String(params.endDate.year))
  qs.set('dailyRange.endDate.month',   String(params.endDate.month))
  qs.set('dailyRange.endDate.day',     String(params.endDate.day))

  const url = `${GBP_PERF_URL}/${params.locationName}:fetchMultiDailyMetricsTimeSeries?${qs.toString()}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`performance API error: ${res.status} - ${err}`)
  }
  const data = await res.json()
  // 実際のレスポンス構造:
  // { multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [{ dailyMetric, timeSeries }] }] }
  type DatedValue = { date: { year: number; month: number; day: number }; value?: string }
  type InnerItem = { dailyMetric: string; timeSeries: { datedValues: DatedValue[] } }
  type OuterItem = { dailyMetricTimeSeries: InnerItem[] }
  return (data.multiDailyMetricTimeSeries ?? [] as OuterItem[]).flatMap(
    (wrapper: OuterItem) =>
      (wrapper.dailyMetricTimeSeries ?? []).map((m: InnerItem) => ({
        dailyMetric: m.dailyMetric,
        timeSeries:  m.timeSeries ?? { datedValues: [] },
      }))
  )
}

// =============================================
// 検索されたキーワード
// =============================================

export interface SearchKeywordCount {
  searchKeyword: string
  count: number
}

/** 検索されたキーワード一覧を取得 */
export async function fetchSearchKeywords(
  accessToken: string,
  locationName: string
): Promise<SearchKeywordCount[]> {
  const res = await fetch(
    `${GBP_PERF_URL}/${locationName}:searchKeywords`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`searchKeywords API error: ${res.status} - ${err}`)
  }
  const data = await res.json()
  return (data.searchKeywordsCounts ?? [])
    .map((item: { searchKeyword: string; insightsValue?: { threshold?: boolean; value?: string } }) => ({
      searchKeyword: item.searchKeyword,
      count: parseInt(item.insightsValue?.value ?? '0'),
    }))
    .sort((a: SearchKeywordCount, b: SearchKeywordCount) => b.count - a.count)
}

// =============================================
// クチコミ
// =============================================

/** クチコミ一覧を取得（旧API v4 使用） */
export async function listReviews(
  accessToken: string,
  locationName: string,
  pageSize = 10
): Promise<{ reviews: Review[]; averageRating: number; totalReviewCount: number }> {
  // locationName format: "accounts/{id}/locations/{id}"
  const res = await fetch(
    `${REVIEWS_URL}/${locationName}/reviews?pageSize=${pageSize}&orderBy=updateTime+desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) throw new Error(`reviews API error: ${res.status}`)
  return res.json()
}

/** クチコミに返信 */
export async function replyToReview(
  accessToken: string,
  reviewName: string,
  comment: string
): Promise<void> {
  const res = await fetch(`${REVIEWS_URL}/${reviewName}/reply`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment }),
  })
  if (!res.ok) throw new Error(`review reply API error: ${res.status}`)
}

// =============================================
// ユーティリティ
// =============================================

/** 日付範囲を生成（月次） */
export function getMonthRange(year: number, month: number) {
  const lastDay = new Date(year, month, 0).getDate()
  return {
    startDate: { year, month, day: 1 },
    endDate:   { year, month, day: lastDay },
  }
}

/** メトリクス名を日本語ラベルに変換 */
export const METRIC_LABELS: Record<MetricType, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: '検索表示（PC）',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH:  '検索表示（モバイル）',
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS:   'マップ表示（PC）',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS:    'マップ表示（モバイル）',
  WEBSITE_CLICKS:                      'Webサイトクリック',
  CALL_CLICKS:                         '電話クリック',
  BUSINESS_DIRECTION_REQUESTS:         '道順リクエスト',
  BUSINESS_CONVERSATIONS:              'メッセージ',
  BUSINESS_BOOKINGS:                   '予約',
  BUSINESS_FOOD_ORDERS:                '料理注文',
  BUSINESS_FOOD_MENU_CLICKS:           'メニュークリック',
}

export const METRIC_COLORS: Record<MetricType, string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: '#10b981',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH:  '#06b6d4',
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS:   '#f59e0b',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS:    '#f97316',
  WEBSITE_CLICKS:                      '#3b82f6',
  CALL_CLICKS:                         '#ef4444',
  BUSINESS_DIRECTION_REQUESTS:         '#8b5cf6',
  BUSINESS_CONVERSATIONS:              '#0ea5e9',
  BUSINESS_BOOKINGS:                   '#ec4899',
  BUSINESS_FOOD_ORDERS:                '#6366f1',
  BUSINESS_FOOD_MENU_CLICKS:           '#84cc16',
}

/** 星評価を数値に変換 */
export function starRatingToNumber(rating: string): number {
  const map: Record<string, number> = {
    ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
  }
  return map[rating] ?? 0
}
