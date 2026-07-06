import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
// 繝・Δ繝・・繧ｿ逕滓・
// =============================================

function generateDemoPerformance(yearmonth: string | null) {
  return {
    yearmonth: yearmonth ?? '2026/06',
    metrics: [
      { metric: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', label: '讀懃ｴ｢陦ｨ遉ｺ・・C・・,     color: '#10b981', total: 820,  data: [] },
      { metric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',  label: '讀懃ｴ｢陦ｨ遉ｺ・医Δ繝舌う繝ｫ・・, color: '#06b6d4', total: 420,  data: [] },
      { metric: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',   label: '繝槭ャ繝苓｡ｨ遉ｺ・・C・・,    color: '#f59e0b', total: 310,  data: [] },
      { metric: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',    label: '繝槭ャ繝苓｡ｨ遉ｺ・医Δ繝舌う繝ｫ・・,color: '#f97316', total: 510,  data: [] },
      { metric: 'WEBSITE_CLICKS',                      label: 'Web繧ｵ繧､繝医け繝ｪ繝・け',   color: '#3b82f6', total: 86,   data: [] },
      { metric: 'CALL_CLICKS',                         label: '髮ｻ隧ｱ繧ｯ繝ｪ繝・け',        color: '#ef4444', total: 42,   data: [] },
      { metric: 'BUSINESS_DIRECTION_REQUESTS',         label: '驕馴・Μ繧ｯ繧ｨ繧ｹ繝・,      color: '#8b5cf6', total: 31,   data: [] },
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
  { searchKeyword: '繧｢繝医Λ繧ｯ繧ｷ繝ｧ繝ｳ',    count: 474 },
  { searchKeyword: '縺医↓縺・,           count: 351 },
  { searchKeyword: '譬ｪ蠑丈ｼ夂､ｾenishi',   count: 145 },
  { searchKeyword: '蠕ｳ蟲ｶ 螟匁ｧ・,        count: 117 },
  { searchKeyword: '蠕ｳ蟲ｶ逵・螟匁ｧ・,      count: 64  },
  { searchKeyword: '繧ｨ繝九す',           count: 55  },
  { searchKeyword: '縺医↓縺・蠕ｳ蟲ｶ',      count: 38  },
  { searchKeyword: '譬ｪ蠑丈ｼ夂､ｾ enishi',  count: 18  },
]

// =============================================
// 繝倥Ν繝代・髢｢謨ｰ
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
// API 繝上Φ繝峨Λ
// =============================================

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const locationName = searchParams.get('location')
  const yearmonth    = searchParams.get('yearmonth')
  // mode: 'daily' (繝・ヵ繧ｩ繝ｫ繝・ | 'keywords'
  const mode         = searchParams.get('mode') ?? 'daily'

  if (!locationName) {
    return NextResponse.json({ error: 'location parameter is required' }, { status: 400 })
  }

  // ---- 繝・Δ繝｢繝ｼ繝・----
  if (DEMO_MODE || locationName.includes('demo')) {
    if (mode === 'keywords') {
      return NextResponse.json({ keywords: DEMO_KEYWORDS })
    }
    return NextResponse.json(generateDemoPerformance(yearmonth))
  }

  // ---- 讀懃ｴ｢繧ｭ繝ｼ繝ｯ繝ｼ繝峨Δ繝ｼ繝・----
  if (mode === 'keywords') {
    try {
      const keywords = await fetchSearchKeywords(session.accessToken, locationName)
      return NextResponse.json({ keywords })
    } catch (err) {
      console.error('searchKeywords error:', err)
      // 繧ｨ繝ｩ繝ｼ譎ゅ・繝・Δ繝・・繧ｿ繧定ｿ斐☆・郁｡ｨ遉ｺ繧帝泌・繧後＆縺帙↑縺・ｼ・
      return NextResponse.json({
        keywords: DEMO_KEYWORDS,
        warning: `讀懃ｴ｢繧ｭ繝ｼ繝ｯ繝ｼ繝陰PI繧ｨ繝ｩ繝ｼ: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  // ---- 譌･蛻･繝・・繧ｿ繝｢繝ｼ繝会ｼ医ョ繝輔か繝ｫ繝茨ｼ・----
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

    // 繧ｯ繧ｩ繝ｼ繧ｿ雜・℃譎ゅ・繝・Δ繝・・繧ｿ
    if (message.includes('429')) {
      return NextResponse.json({
        ...generateDemoPerformance(yearmonth),
        warning: 'Google Business Profile API縺ｮQuota縺・縺ｮ縺溘ａ縲√ョ繝｢繝・・繧ｿ繧定｡ｨ遉ｺ縺励※縺・∪縺吶・,
      })
    }

    // API譛ｪ譛牙柑蛹厄ｼ・04・峨・繝・Δ繝・・繧ｿ
    if (message.includes('404')) {
      return NextResponse.json({
        ...generateDemoPerformance(yearmonth),
        warning: 'Business Profile Performance API縺梧怏蜉ｹ蛹悶＆繧後※縺・∪縺帙ｓ縲・oogle Cloud Console縺ｧ縲沓usiness Profile Performance API縲阪ｒ譛牙柑縺ｫ縺励※縺上□縺輔＞縲・,
      })
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
