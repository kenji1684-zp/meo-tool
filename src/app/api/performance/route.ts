import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import {
  fetchDailyMetrics,
  fetchSearchKeywords,
  getMonthRange,
  METRIC_LABELS,
  METRIC_COLORS,
  MetricType,
} from '@/lib/gbp-client'
import { PerformanceData } from '@/types'

const DEFAULT_METRICS: MetricType[] = [
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'WEBSITE_CLICKS',
  'CALL_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
]

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// =============================================
// デモデータ生成
// =============================================

function generateDemoPerformance(yearmonth: string | null) {
  return {
    yearmonth: yearmonth ?? '2026/06',
    metrics: [
      { metric: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', label: '検索表示（PC）',     color: '#10b981', total: 820,  data: [] },
      { metric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',  label: '検索表示（モバイル）', color: '#06b6d4', total: 420,  data: [] },
      { metric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',   label: 'マップ表示（PC）',    color: '#f59e0b', total: 310,  data: [] },
      { metric: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',    label: 'マップ表示（モバイル）',color: '#f97316', total: 510,  data: [] },
      { metric: 'WEBSITE_CLICKS',                      label: 'Webサイトクリック',   color: '#3b82f6', total: 86,   data: [] },
      { metric: 'CALL_CLICKS',                         label: '電話クリック',        color: '#ef4444', total: 42,   data: [] },
      { metric: 'BUSINESS_DIRECTION_REQUESTS',         label: '道順リクエスト',      color: '#8b5cf6', total: 31,   data: [] },
    ],
    summary: {
      totalSearchViews:        1240,
      totalMapViews:           820,
      totalWebsiteClicks:      86,
      totalCallClicks:         42,
      totalDirectionRequests:  31,
      totalDirectQueries:      0,
      totalIndirectQueries:    0,
    },
  }
}

const DEMO_KEYWORDS = [
  { searchKeyword: 'アトラクション',    count: 474 },
  { searchKeyword: 'えにし',           count: 351 },
  { searchKeyword: '株式会社enishi',   count: 145 },
  { searchKeyword: '徳島 外構',        count: 117 },
  { searchKeyword: '徳島県 外構',      count: 64  },
  { searchKeyword: 'エニシ',           count: 55  },
  { searchKeyword: 'えにし 徳島',      count: 38  },
  { searchKeyword: '株式会社 enishi',  count: 18  },
]

// =============================================
// ヘルパー関数
// =============================================

function buildPerformanceData(rawMetrics: ReturnType<typeof Array.prototype.flatMap>): PerformanceData[] {
  return rawMetrics.map((m: { dailyMetric: string; timeSeries: { datedValues: { date: { year: number; month: number; day: number }; value?: string }[] } }) => {
    const metricType = m.dailyMetric as MetricType
    const dataPoints = m.timeSeries.datedValues.map((dv: { date: { year: number; month: number; day: number }; value?: string }) => ({
      date: `${dv.date.year}/${String(dv.date.month).padStart(2, '0')}/${String(dv.date.day).padStart(2, '0')}`,
      value: parseInt(dv.value ?? '0'),
    }))
    const total = dataPoints.reduce((sum: number, d: { value: number }) => sum + d.value, 0)
    return {
      metric:  metricType,
      label:   METRIC_LABELS[metricType] ?? metricType,
      color:   METRIC_COLORS[metricType] ?? '#888',
      total,
      data:    dataPoints,
    } as PerformanceData
  })
}

function buildSummary(performanceData: PerformanceData[]) {
  const getTotal = (metric: string) =>
    performanceData.find((d) => d.metric === metric)?.total ?? 0
  return {
    totalSearchViews:       getTotal('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH') + getTotal('BUSINESS_IMPRESSIONS_MOBILE_SEARCH'),
    totalMapViews:          getTotal('BUSINESS_IMPRESSIONS_DESKTOP_MAPS') + getTotal('BUSINESS_IMPRESSIONS_MOBILE_MAPS'),
    totalWebsiteClicks:     getTotal('WEBSITE_CLICKS'),
    totalCallClicks:        getTotal('CALL_CLICKS'),
    totalDirectionRequests: getTotal('BUSINESS_DIRECTION_REQUESTS'),
    totalDirectQueries:     0,
    totalIndirectQueries:   0,
  }
}

// =============================================
// API ハンドラ
// =============================================

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const locationName = searchParams.get('location')
  const yearmonth    = searchParams.get('yearmonth')
  // mode: 'daily' (デフォルト) | 'keywords'
  const mode         = searchParams.get('mode') ?? 'daily'

  if (!locationName) {
    return NextResponse.json({ error: 'location parameter is required' }, { status: 400 })
  }

  // ---- デモモード ----
  if (DEMO_MODE || locationName.includes('demo')) {
    if (mode === 'keywords') {
      return NextResponse.json({ keywords: DEMO_KEYWORDS })
    }
    return NextResponse.json(generateDemoPerformance(yearmonth))
  }

  // ---- 検索キーワードモード ----
  if (mode === 'keywords') {
    try {
      const keywords = await fetchSearchKeywords(session.accessToken, locationName)
      return NextResponse.json({ keywords })
    } catch (err) {
      console.error('searchKeywords error:', err)
      // エラー時はデモデータを返す（表示を途切れさせない）
      return NextResponse.json({
        keywords: DEMO_KEYWORDS,
        warning: `検索キーワードAPIエラー: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  // ---- 日別データモード（デフォルト） ----
  let year: number
  let month: number

  if (yearmonth) {
    const parts = yearmonth.split(/[\/\-]/)
    year  = parseInt(parts[0])
    month = parseInt(parts[1])
  } else {
    const now = new Date()
    year  = now.getFullYear()
    month = now.getMonth() + 1
  }

  try {
    const { startDate, endDate } = getMonthRange(year, month)

    const rawMetrics = await fetchDailyMetrics(session.accessToken, {
      locationName,
      startDate,
      endDate,
      metrics: DEFAULT_METRICS,
    })

    const performanceData = buildPerformanceData(rawMetrics)

    return NextResponse.json({
      yearmonth: `${year}/${month}`,
      metrics:   performanceData,
      summary:   buildSummary(performanceData),
    })
  } catch (err) {
    console.error('performance API error:', err)

    const message = err instanceof Error ? err.message : 'Unknown error'

    // クォータ超過時はデモデータ
    if (message.includes('429')) {
      return NextResponse.json({
        ...generateDemoPerformance(yearmonth),
        warning: 'Google Business Profile APIのQuotaが0のため、デモデータを表示しています。',
      })
    }

    // API未有効化（404）はデモデータ
    if (message.includes('404')) {
      return NextResponse.json({
        ...generateDemoPerformance(yearmonth),
        warning: 'Business Profile Performance APIが有効化されていません。Google Cloud Consoleで「Business Profile Performance API」を有効にしてください。',
      })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
