import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { fetchDailyMetrics, getMonthRange, METRIC_LABELS, METRIC_COLORS } from '@/lib/gbp-client'
import { MetricType, PerformanceData } from '@/types'
import { DEMO_PERFORMANCE, DEMO_SUMMARY } from '@/lib/demo-data'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const DEFAULT_METRICS: MetricType[] = [
  'QUERIES_DIRECT', 'QUERIES_INDIRECT', 'VIEWS_MAPS', 'VIEWS_SEARCH',
  'ACTIONS_WEBSITE', 'ACTIONS_PHONE', 'ACTIONS_DRIVING_DIRECTIONS',
]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const yearmonth = searchParams.get('yearmonth')

  if (DEMO_MODE) {
    return NextResponse.json({
      yearmonth: yearmonth ?? new Date().getFullYear() + '/' + (new Date().getMonth() + 1),
      metrics: DEMO_PERFORMANCE,
      summary: DEMO_SUMMARY,
      demo: true,
    })
  }

  const locationName = searchParams.get('location')
  if (!locationName) {
    return NextResponse.json({ error: 'location parameter is required' }, { status: 400 })
  }

  let year: number, month: number
  if (yearmonth) {
    const parts = yearmonth.split(/[\/\-]/)
    year = parseInt(parts[0]); month = parseInt(parts[1])
  } else {
    const now = new Date(); year = now.getFullYear(); month = now.getMonth() + 1
  }

  try {
    const { startDate, endDate } = getMonthRange(year, month)
    const rawMetrics = await fetchDailyMetrics(session.accessToken, {
      locationName, startDate, endDate, metrics: DEFAULT_METRICS,
    })
    const performanceData: PerformanceData[] = rawMetrics.map(m => {
      const metricType = m.dailyMetric as MetricType
      const dataPoints = m.timeSeries.datedValues.map(dv => ({
        date: `${dv.date.year}/${String(dv.date.month).padStart(2,'0')}/${String(dv.date.day).padStart(2,'0')}`,
        value: parseInt(dv.value ?? '0'),
      }))
      return {
        metric: metricType,
        label: METRIC_LABELS[metricType] ?? metricType,
        color: METRIC_COLORS[metricType] ?? '#888',
        total: dataPoints.reduce((s, d) => s + d.value, 0),
        data: dataPoints,
      }
    })
    const getTotal = (metric: MetricType) => performanceData.find(d => d.metric === metric)?.total ?? 0
    return NextResponse.json({
      yearmonth: `${year}/${month}`, metrics: performanceData,
      summary: {
        totalSearchViews: getTotal('VIEWS_SEARCH'), totalMapViews: getTotal('VIEWS_MAPS'),
        totalWebsiteClicks: getTotal('ACTIONS_WEBSITE'), totalCallClicks: getTotal('ACTIONS_PHONE'),
        totalDirectionRequests: getTotal('ACTIONS_DRIVING_DIRECTIONS'),
        totalDirectQueries: getTotal('QUERIES_DIRECT'), totalIndirectQueries: getTotal('QUERIES_INDIRECT'),
      },
    })
  } catch (err) {
    console.error('performance API error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
