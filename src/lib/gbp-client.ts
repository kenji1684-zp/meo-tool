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

export interface SearchKeywordsResult {
  keywords: SearchKeywordCount[]
  /** 実際にデータを取得できた年月（例: "2026/06"） */
  yearmonth: string
}

/** 0件だった場合に遡る回数（先月を含む試行回数） */
const KEYWORD_MONTH_ATTEMPTS = 3

/** 指定1ヶ月分の検索キーワードを取得 */
async function fetchKeywordsForMonth(
  accessToken: string,
  locId: string,
  year: number,
  month: number
): Promise<SearchKeywordCount[]> {
  const qs = new URLSearchParams({
    'monthlyRange.start_month.year':  String(year),
    'monthlyRange.start_month.month': String(month),
    'monthlyRange.end_month.year':    String(year),
    'monthlyRange.end_month.month':   String(month),
    pageSize: '100',
  })

  const results: SearchKeywordCount[] = []
  let pageToken: string | undefined

  do {
    const url =
      `${GBP_PERF_URL}/${locId}/searchkeywords/impressions/monthly?${qs.toString()}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`searchKeywords API error: ${res.status} - ${err}`)
    }
    const data = await res.json()

    for (const item of (data.searchKeywordsCounts ?? []) as {
      searchKeyword: string
      insightsValue?: { threshold?: string; value?: string }
    }[]) {
      results.push({
        searchKeyword: item.searchKeyword,
        // value が無い場合は threshold（「15未満」等の下限値）を採用
        count: parseInt(item.insightsValue?.value ?? item.insightsValue?.threshold ?? '0'),
      })
    }

    pageToken = data.nextPageToken
  } while (pageToken)

  return results.sort((a, b) => b.count - a.count)
}

/**
 * 検索されたキーワード一覧を取得
 * GET https://businessprofileperformance.googleapis.com/v1/locations/{id}/searchkeywords/impressions/monthly
 * ※ locationName は "locations/{id}" 形式に正規化してから使用
 * ※ Googleは月次データの公開が2〜3週間遅れるため、0件なら前月へ自動で遡る
 */
export async function fetchSearchKeywords(
  accessToken: string,
  locationName: string,
  year?: number,
  month?: number
): Promise<SearchKeywordsResult> {
  // "accounts/x/locations/y" → "locations/y" に正規化
  const li = locationName.indexOf('locations/')
  const locId = li >= 0 ? locationName.slice(li) : locationName

  let y: number
  let m: number
  if (year && month) {
    y = year
    m = month
  } else {
    // 未指定なら先月（当月分はGoogleが未公開）
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    y = d.getFullYear()
    m = d.getMonth() + 1
  }

  for (let i = 0; i < KEYWORD_MONTH_ATTEMPTS; i++) {
    const keywords = await fetchKeywordsForMonth(accessToken, locId, y, m)
    if (keywords.length > 0 || i === KEYWORD_MONTH_ATTEMPTS - 1) {
      return { keywords, yearmonth: `${y}/${String(m).padStart(2, '0')}` }
    }
    // 0件だったので前月へ
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }

  return { keywords: [], yearmonth: `${y}/${String(m).padStart(2, '0')}` }
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
// 写真（メディア）※旧API v4 のみ対応
// =============================================

const MEDIA_UPLOAD_URL = 'https://mybusiness.googleapis.com/upload/v1/media'

export type MediaCategory =
  | 'COVER' | 'PROFILE' | 'LOGO'
  | 'EXTERIOR' | 'INTERIOR' | 'PRODUCT' | 'AT_WORK'
  | 'FOOD_AND_DRINK' | 'MENU' | 'COMMON_AREA' | 'ROOMS' | 'TEAMS'
  | 'ADDITIONAL'

export interface MediaItem {
  name: string
  mediaFormat?: string
  googleUrl?: string
  thumbnailUrl?: string
  createTime?: string
  description?: string
  locationAssociation?: { category?: MediaCategory }
  dimensions?: { widthPixels?: number; heightPixels?: number }
}

// v4 のメディアAPIは "accounts/{aid}/locations/{lid}" 形式が必須。
// 画面側は "locations/{lid}" しか持っていないため、アカウントを補って解決する。
export async function resolveLocationParent(
  accessToken: string,
  locationName: string
): Promise<string> {
  if (locationName.startsWith('accounts/')) return locationName

  const li = locationName.indexOf('locations/')
  const locId = li >= 0 ? locationName.slice(li) : `locations/${locationName}`

  const accounts = await listAccounts(accessToken)
  if (!accounts.length) throw new Error('Googleビジネスプロフィールのアカウントが取得できませんでした')
  return `${accounts[0].name}/${locId}`
}

/** 写真一覧を取得 */
export async function listMedia(
  accessToken: string,
  parent: string,
  pageSize = 100
): Promise<MediaItem[]> {
  const res = await fetch(`${REVIEWS_URL}/${parent}/media?pageSize=${pageSize}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`media list API error: ${res.status} - ${await res.text()}`)
  }
  const data = await res.json()
  return (data.mediaItems ?? []) as MediaItem[]
}

/** アップロード用の dataRef を発行 */
async function startMediaUpload(accessToken: string, parent: string): Promise<string> {
  const res = await fetch(`${REVIEWS_URL}/${parent}/media:startUpload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  if (!res.ok) {
    throw new Error(`media startUpload API error: ${res.status} - ${await res.text()}`)
  }
  const data = await res.json()
  if (!data.resourceName) throw new Error('startUpload が resourceName を返しませんでした')
  return data.resourceName as string
}

/** 画像バイト列を送信 */
async function uploadMediaBytes(
  accessToken: string,
  resourceName: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<void> {
  const res = await fetch(`${MEDIA_UPLOAD_URL}/${resourceName}?upload_type=media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: bytes,
  })
  if (!res.ok) {
    throw new Error(`media upload API error: ${res.status} - ${await res.text()}`)
  }
}

/**
 * 写真を追加
 * startUpload → バイト送信 → media 作成 の3段階
 * ※ 作成した時点でGoogleマップ上に公開される（下書き状態は無い）
 */
export async function uploadLocationPhoto(
  accessToken: string,
  parent: string,
  bytes: ArrayBuffer,
  contentType: string,
  category: MediaCategory = 'ADDITIONAL',
  description?: string
): Promise<MediaItem> {
  const resourceName = await startMediaUpload(accessToken, parent)
  await uploadMediaBytes(accessToken, resourceName, bytes, contentType)

  const res = await fetch(`${REVIEWS_URL}/${parent}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mediaFormat: 'PHOTO',
      locationAssociation: { category },
      dataRef: { resourceName },
      ...(description ? { description } : {}),
    }),
  })
  if (!res.ok) {
    throw new Error(`media create API error: ${res.status} - ${await res.text()}`)
  }
  return res.json() as Promise<MediaItem>
}

/** 写真を削除（mediaName は accounts/.../locations/.../media/... 形式） */
export async function deleteMedia(accessToken: string, mediaName: string): Promise<void> {
  const res = await fetch(`${REVIEWS_URL}/${mediaName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    throw new Error(`media delete API error: ${res.status} - ${await res.text()}`)
  }
}

/** 写真カテゴリの日本語ラベル */
export const MEDIA_CATEGORY_LABELS: Record<MediaCategory, string> = {
  ADDITIONAL:     'その他の写真',
  EXTERIOR:       '外観',
  INTERIOR:       '内観',
  PRODUCT:        '商品',
  AT_WORK:        '作業中',
  FOOD_AND_DRINK: '料理・ドリンク',
  MENU:           'メニュー',
  COMMON_AREA:    '共用エリア',
  ROOMS:          '客室',
  TEAMS:          'チーム',
  COVER:          'カバー写真',
  PROFILE:        'プロフィール写真',
  LOGO:           'ロゴ',
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
