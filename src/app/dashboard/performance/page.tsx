'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { format, subMonths, getDay } from 'date-fns'
import { RefreshCw, Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts'
import { PerformanceData } from '@/types'

// =============================================
// 型・定数
// =============================================

type TabType = '月別集計' | '日別推移' | '曜日平均' | '全社比較' | '使い方'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const REACH_METRICS = [
  { key: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', label: '検索（PC）',      color: '#10b981' },
  { key: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',  label: '検索（モバイル）', color: '#06b6d4' },
  { key: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',   label: 'マップ（PC）',     color: '#f59e0b' },
  { key: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',    label: 'マップ（モバイル）',color: '#f97316' },
]

const INTEREST_METRICS = [
  { key: 'BUSINESS_DIRECTION_REQUESTS', label: 'ルート',        color: '#3b82f6' },
  { key: 'WEBSITE_CLICKS',              label: 'ウェブサイト',  color: '#f97316' },
]

const ACTION_METRICS = [
  { key: 'CALL_CLICKS', label: '通話', color: '#3b82f6' },
]

const BIZ_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4',
]

const DAILY_METRICS = [
  { key: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', label: '検索（PC）',      color: '#10b981' },
  { key: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',  label: '検索（モバイル）', color: '#06b6d4' },
  { key: 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',   label: 'マップ（PC）',     color: '#f59e0b' },
  { key: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS',    label: 'マップ（モバイル）',color: '#f97316' },
  { key: 'WEBSITE_CLICKS',                      label: 'WEBクリック',      color: '#3b82f6' },
  { key: 'CALL_CLICKS',                         label: '電話',             color: '#ef4444' },
  { key: 'BUSINESS_DIRECTION_REQUESTS',         label: '道順',             color: '#8b5cf6' },
]

// =============================================
// 前年同月比較テーブル
// =============================================

function ComparisonTable({
  metrics, current, previous, curLabel, prevLabel,
}: {
  metrics:  { key: string; label: string; color: string }[]
  current:  Record<string, number>
  previous: Record<string, number>
  curLabel:  string
  prevLabel: string
}) {
  const totalCur  = metrics.reduce((s, m) => s + (current[m.key]  ?? 0), 0)
  const totalPrev = metrics.reduce((s, m) => s + (previous[m.key] ?? 0), 0)
  const totalDiff = totalCur - totalPrev
  const totalPct  = totalPrev > 0 ? Math.round((totalDiff / totalPrev) * 100) : null

  function diffClass(diff: number) {
    if (diff > 0) return 'text-blue-600'
    if (diff < 0) return 'text-red-500'
    return 'text-gray-400'
  }

  function fmt(n: number, diff: number, pct: number | null) {
    const sign = diff > 0 ? '+' : ''
    const pctStr = pct !== null ? ` (${sign}${pct}%)` : ''
    return `${sign}${n.toLocaleString()}${pctStr}`
  }

  return (
    <div className="overflow-x-auto mt-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-800 text-white text-center">
            <th className="text-left px-4 py-2 font-medium rounded-tl"></th>
            <th className="px-4 py-2 font-medium">{prevLabel}</th>
            <th className="px-4 py-2 font-medium">{curLabel}</th>
            <th className="px-4 py-2 font-medium rounded-tr">増減</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => {
            const cur  = current[m.key]  ?? 0
            const prev = previous[m.key] ?? 0
            const diff = cur - prev
            const pct  = prev > 0 ? Math.round((diff / prev) * 100) : null
            return (
              <tr key={m.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 text-gray-700">{m.label}</td>
                <td className="px-4 py-2 text-center tabular-nums">{prev.toLocaleString()}</td>
                <td className="px-4 py-2 text-center tabular-nums">{cur.toLocaleString()}</td>
                <td className={`px-4 py-2 text-center tabular-nums font-medium ${diffClass(diff)}`}>
                  {fmt(diff, diff, pct)}
                </td>
              </tr>
            )
          })}
          <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
            <td className="px-4 py-2">合計</td>
            <td className="px-4 py-2 text-center tabular-nums">{totalPrev.toLocaleString()}</td>
            <td className="px-4 py-2 text-center tabular-nums">{totalCur.toLocaleString()}</td>
            <td className={`px-4 py-2 text-center tabular-nums ${diffClass(totalDiff)}`}>
              {fmt(totalDiff, totalDiff, totalPct)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// =============================================
// メインコンポーネント
// =============================================

interface MonthlyCache {
  yearmonth: string
  totals: Record<string, number>
}

export default function PerformancePage() {
  const [tab, setTab]           = useState<TabType>('月別集計')
  const [yearmonth, setYearmonth] = useState(format(new Date(), 'yyyy/M'))
  const [metrics, setMetrics]   = useState<PerformanceData[]>([])
  const [prevMetrics, setPrevMetrics] = useState<PerformanceData[]>([])
  const [monthlyCache, setMonthlyCache] = useState<MonthlyCache[]>([])
  const [loading, setLoading]   = useState(false)
  const [loadingKw, setLoadingKw] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [locationName, setLocationName] = useState('')
  const [locations, setLocations]       = useState<{ name: string; title: string }[]>([])
  const [searchedKeywords, setSearchedKeywords] = useState<{ searchKeyword: string; count: number }[]>([])
  const [kwFetched, setKwFetched] = useState(false)
  // keyword-settings の7社リスト
  const [kwCompanies, setKwCompanies] = useState<{
    businessTitle: string; locationName?: string
  }[]>([])

  // 全社比較
  const [allBizData, setAllBizData]     = useState<{
    location: string; title: string
    months: { yearmonth: string; totals: Record<string, number> }[]
  }[]>([])
  const [allBizLoading, setAllBizLoading] = useState(false)
  const [allBizFetched, setAllBizFetched] = useState(false)
  const [allBizMetric, setAllBizMetric]   = useState<'reach' | 'route' | 'web' | 'call'>('reach')

  // locationName 変更時: localStorage からキャッシュ読込（ビジネスごとに別キー）
  useEffect(() => {
    if (!locationName) return
    const locKey = locationName.replace(/[^a-zA-Z0-9]/g, '_')
    const cache: MonthlyCache[] = []
    for (let i = 23; i >= 0; i--) {
      const ym  = format(subMonths(new Date(), i), 'yyyy/M')
      const raw = localStorage.getItem(`perf_${locKey}_${ym.replace('/', '-')}`)
      if (raw) {
        try { cache.push({ yearmonth: ym, totals: JSON.parse(raw) }) } catch {}
      }
    }
    setMonthlyCache(cache)
  }, [locationName])

  // locationName 変更時: 過去12ヶ月を自動取得（バックグラウンド）
  useEffect(() => {
    if (!locationName) return
    const locKey = locationName.replace(/[^a-zA-Z0-9]/g, '_')
    const last12 = Array.from({ length: 12 }, (_, i) =>
      format(subMonths(new Date(), 11 - i), 'yyyy/M')
    )
    const uncached = last12.filter(
      ym => !localStorage.getItem(`perf_${locKey}_${ym.replace('/', '-')}`)
    )
    if (!uncached.length) return
    Promise.all(uncached.map(async ym => {
      try {
        const res  = await fetch(`/api/performance?location=${encodeURIComponent(locationName)}&yearmonth=${ym}`)
        const data = await res.json()
        if (data.error) return
        const totals: Record<string, number> = {}
        ;(data.metrics ?? []).forEach((m: PerformanceData) => { totals[m.metric] = m.total })
        localStorage.setItem(`perf_${locKey}_${ym.replace('/', '-')}`, JSON.stringify(totals))
        setMonthlyCache(prev => {
          const filtered = prev.filter(c => c.yearmonth !== ym)
          return [...filtered, { yearmonth: ym, totals }]
            .sort((a, b) => {
              const [ay, am] = a.yearmonth.split('/').map(Number)
              const [by, bm] = b.yearmonth.split('/').map(Number)
              return (ay * 12 + am) - (by * 12 + bm)
            })
        })
      } catch { /* ignore */ }
    })).catch(() => {})
  }, [locationName])

  // keyword-settings の会社リスト取得（7社フィルタ用）
  useEffect(() => {
    fetch('/api/keywords/settings')
      .then(r => r.json())
      .then(d => setKwCompanies(d.companies ?? []))
      .catch(() => {})
  }, [])

  // ロケーション一覧取得
  useEffect(() => {
    fetch('/api/business')
      .then(r => r.json())
      .then(d => {
        const locs = (d.locations ?? []).map((l: { name: string; title?: string }) => ({
          name:  l.name,
          title: l.title ?? l.name,
        }))
        setLocations(locs)
        if (locs.length > 0) setLocationName(locs[0].name)
      })
      .catch(() => {})
  }, [])

  // ロケーション切り替え時に表示データをリセット
  function handleLocationChange(name: string) {
    setLocationName(name)
    setMonthlyCache([])
    setMetrics([])
    setPrevMetrics([])
    setSearchedKeywords([])
    setKwFetched(false)
  }

  // パフォーマンスデータ取得
  const fetchData = useCallback(async (ym: string) => {
    if (!locationName) return
    setLoading(true)
    setError(null)
    try {
      const [y, mo] = ym.split('/').map(Number)

      // 当月データ
      const res  = await fetch(`/api/performance?location=${encodeURIComponent(locationName)}&yearmonth=${ym}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMetrics(data.metrics ?? [])

      // 月別トータルをキャッシュ（ビジネスごとに別キー）
      const locKey = locationName.replace(/[^a-zA-Z0-9]/g, '_')
      const totals: Record<string, number> = {}
      ;(data.metrics ?? []).forEach((m: PerformanceData) => { totals[m.metric] = m.total })
      localStorage.setItem(`perf_${locKey}_${ym.replace('/', '-')}`, JSON.stringify(totals))
      setMonthlyCache(prev => {
        const filtered = prev.filter(c => c.yearmonth !== ym)
        return [...filtered, { yearmonth: ym, totals }]
          .sort((a, b) => {
            const [ay, am] = a.yearmonth.split('/').map(Number)
            const [by, bm] = b.yearmonth.split('/').map(Number)
            return (ay * 12 + am) - (by * 12 + bm)
          })
      })

      // 前年同月データ
      const prevYm  = `${y - 1}/${mo}`
      try {
        const prevRes  = await fetch(`/api/performance?location=${encodeURIComponent(locationName)}&yearmonth=${prevYm}`)
        const prevData = await prevRes.json()
        setPrevMetrics(prevData.metrics ?? [])
        // 前年分もキャッシュ
        const prevTotals: Record<string, number> = {}
        ;(prevData.metrics ?? []).forEach((m: PerformanceData) => { prevTotals[m.metric] = m.total })
        localStorage.setItem(`perf_${locKey}_${prevYm.replace('/', '-')}`, JSON.stringify(prevTotals))
        setMonthlyCache(prev => {
          const filtered = prev.filter(c => c.yearmonth !== prevYm)
          return [...filtered, { yearmonth: prevYm, totals: prevTotals }]
            .sort((a, b) => {
            const [ay, am] = a.yearmonth.split('/').map(Number)
            const [by, bm] = b.yearmonth.split('/').map(Number)
            return (ay * 12 + am) - (by * 12 + bm)
          })
        })
      } catch { /* 前年データなし = 無視 */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [locationName])

  // 検索キーワード取得
  const fetchKeywords = useCallback(async () => {
    if (!locationName) return
    setLoadingKw(true)
    try {
      const res  = await fetch(`/api/performance?location=${encodeURIComponent(locationName)}&mode=keywords`)
      const data = await res.json()
      setSearchedKeywords(data.keywords ?? [])
      setKwFetched(true)
    } catch { /* ignore */ } finally {
      setLoadingKw(false)
    }
  }, [locationName])

  useEffect(() => {
    if (locationName) fetchData(yearmonth)
  }, [locationName, yearmonth])

  // 月別集計タブに切り替わったら一度だけキーワードを取得
  useEffect(() => {
    if (tab === '月別集計' && locationName && !kwFetched) {
      fetchKeywords()
    }
  }, [tab, locationName, kwFetched])

  // keyword-settings の7社に絞ったロケーションリスト
  const allBizLocations = useMemo(() => {
    if (!locations.length) return []
    if (!kwCompanies.length) return locations
    return locations.filter(loc =>
      kwCompanies.some(c =>
        (c.locationName && c.locationName === loc.name) ||
        loc.title === c.businessTitle ||
        loc.title.includes(c.businessTitle) ||
        c.businessTitle.includes(loc.title)
      )
    )
  }, [locations, kwCompanies])

  // 全社比較データ取得
  const fetchAllBizData = useCallback(async () => {
    if (!allBizLocations.length || allBizFetched) return
    setAllBizLoading(true)
    const last12 = Array.from({ length: 12 }, (_, i) =>
      format(subMonths(new Date(), 11 - i), 'yyyy/M')
    )
    try {
      const results = await Promise.all(
        allBizLocations.map(async loc => {
          const months = await Promise.all(
            last12.map(async ym => {
              try {
                const res  = await fetch(
                  `/api/performance?location=${encodeURIComponent(loc.name)}&yearmonth=${ym}`
                )
                const data = await res.json()
                const totals: Record<string, number> = {}
                ;(data.metrics ?? []).forEach((m: PerformanceData) => { totals[m.metric] = m.total })
                return { yearmonth: ym, totals }
              } catch {
                return { yearmonth: ym, totals: {} }
              }
            })
          )
          return { location: loc.name, title: loc.title, months }
        })
      )
      setAllBizData(results)
      setAllBizFetched(true)
    } catch { /* ignore */ } finally {
      setAllBizLoading(false)
    }
  }, [allBizLocations, allBizFetched])

  useEffect(() => {
    if (tab === '全社比較' && allBizLocations.length > 0 && !allBizFetched) {
      fetchAllBizData()
    }
  }, [tab, allBizLocations, allBizFetched, fetchAllBizData])

  // =============================================
  // データ変換
  // =============================================

  // 月別棒グラフ用データ（キャッシュから・古い順にソート）
  const monthlyChartData = [...monthlyCache]
    .sort((a, b) => {
      const [ay, am] = a.yearmonth.split('/').map(Number)
      const [by, bm] = b.yearmonth.split('/').map(Number)
      return (ay * 12 + am) - (by * 12 + bm)
    })
    .map(c => ({
      month: (() => {
        const [y, mo] = c.yearmonth.split('/').map(Number)
        const yy = String(y).slice(2)  // "2025" → "25"
        return `${yy}/${mo}月`
      })(),
      yearmonth: c.yearmonth,
      ...c.totals,
    }))

  // 日別チャート用データ
  const dailyChartData = (() => {
    const dateMap = new Map<string, Record<string, number>>()
    metrics.forEach(m => {
      m.data.forEach(d => {
        if (!dateMap.has(d.date)) dateMap.set(d.date, {})
        dateMap.get(d.date)![m.metric] = d.value
      })
    })
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date: date.slice(5), ...values }))
  })()

  // 曜日平均データ
  const weekdayData = (() => {
    const buckets = Array.from({ length: 7 }, () => ({
      count: 0,
      sums:  {} as Record<string, number>,
    }))
    metrics.forEach(m => {
      m.data.forEach(d => {
        const dow = getDay(new Date(d.date.replace(/\//g, '-')))
        buckets[dow].count++
        buckets[dow].sums[m.metric] = (buckets[dow].sums[m.metric] ?? 0) + d.value
      })
    })
    return WEEKDAYS.map((label, i) => {
      const entry: Record<string, string | number> = { weekday: label }
      DAILY_METRICS.forEach(m => {
        entry[m.key] = buckets[i].count > 0
          ? Math.round((buckets[i].sums[m.key] ?? 0) / buckets[i].count)
          : 0
      })
      return entry
    })
  })()

  // totals
  const getTotals = (data: PerformanceData[]) => {
    const t: Record<string, number> = {}
    data.forEach(m => { t[m.metric] = m.total })
    return t
  }
  const curTotals  = getTotals(metrics)
  const prevTotals = getTotals(prevMetrics)

  const [curY, curMo] = yearmonth.split('/').map(Number)
  const curLabel  = `${curY}年${curMo}月`
  const prevLabel = `${curY - 1}年${curMo}月`

  const prevMonths = Array.from({ length: 12 }, (_, i) =>
    format(subMonths(new Date(), i), 'yyyy/M')
  )

  // CSV ダウンロード共通
  function downloadCSV(filename: string, rows: string[][]) {
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // 月別集計 CSV
  function exportMonthlyCSV() {
    const allMetrics = [...REACH_METRICS, ...INTEREST_METRICS, ...ACTION_METRICS]
    const headers = ['年月', ...allMetrics.map(m => m.label)]
    const rows = monthlyChartData.map(d => [
      d.yearmonth as string,
      ...allMetrics.map(m => String((d as Record<string, string | number>)[m.key] ?? 0)),
    ])
    downloadCSV('performance-monthly.csv', [headers, ...rows])
  }

  // 日別推移 CSV
  function exportDailyCSV() {
    const headers = ['日付', ...DAILY_METRICS.map(m => m.label)]
    const rows = dailyChartData.map(d => [
      d.date as string,
      ...DAILY_METRICS.map(m => String(d[m.key] ?? 0)),
    ])
    downloadCSV(`performance-daily-${yearmonth.replace('/', '-')}.csv`, [headers, ...rows])
  }

  // 曜日平均 CSV
  function exportWeekdayCSV() {
    const headers = ['曜日', ...DAILY_METRICS.map(m => m.label)]
    const rows = weekdayData.map(d => [
      d.weekday as string,
      ...DAILY_METRICS.map(m => String(d[m.key] ?? 0)),
    ])
    downloadCSV(`performance-weekday-${yearmonth.replace('/', '-')}.csv`, [headers, ...rows])
  }

  // 検索キーワード CSV
  function exportKwCSV() {
    downloadCSV(
      `searched-keywords-${yearmonth.replace('/', '-')}.csv`,
      [
        ['キーワード', '表示された回数'],
        ...searchedKeywords.map(k => [k.searchKeyword, String(k.count)]),
      ]
    )
  }

  // 全社比較 CSV
  function exportAllBizCSV() {
    if (!allBizData.length) return
    const last12 = Array.from({ length: 12 }, (_, i) =>
      format(subMonths(new Date(), 11 - i), 'yyyy/M')
    )
    const metricKey = METRIC_KEY_MAP[allBizMetric]
    const headers = ['年月', ...allBizData.map(b => b.title)]
    const rows = last12.map(ym => [
      ym,
      ...allBizData.map(biz => {
        const m = biz.months.find(x => x.yearmonth === ym)
        return String(m?.totals[metricKey] ?? 0)
      }),
    ])
    downloadCSV('performance-all-biz.csv', [headers, ...rows])
  }

  // タブに応じた CSV エクスポート
  function exportCSV() {
    if (tab === '月別集計') exportMonthlyCSV()
    else if (tab === '日別推移') exportDailyCSV()
    else if (tab === '曜日平均') exportWeekdayCSV()
    else if (tab === '全社比較') exportAllBizCSV()
    else exportKwCSV()
  }

  // 全社比較チャートデータ
  const METRIC_KEY_MAP: Record<string, string> = {
    reach: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    route: 'BUSINESS_DIRECTION_REQUESTS',
    web:   'WEBSITE_CLICKS',
    call:  'CALL_CLICKS',
  }
  const allBizChartData = (() => {
    const last12 = Array.from({ length: 12 }, (_, i) =>
      format(subMonths(new Date(), 11 - i), 'yyyy/M')
    )
    const metricKey = METRIC_KEY_MAP[allBizMetric]
    return last12.map(ym => {
      const [y, mo] = ym.split('/').map(Number)
      const yy = String(y).slice(2)
      const entry: Record<string, string | number> = { month: `${yy}/${mo}月`, yearmonth: ym }
      allBizData.forEach(biz => {
        const m = biz.months.find(x => x.yearmonth === ym)
        entry[biz.title] = m?.totals[metricKey] ?? 0
      })
      return entry
    })
  })()

  // =============================================
  // レンダリング
  // =============================================

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-surface-900">パフォーマンス</h1>
          <p className="text-surface-500 text-sm mt-1">Googleビジネスプロフィールのアクセス分析</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* ビジネス選択 */}
          {locations.length > 1 && (
            <select
              value={locationName}
              onChange={e => handleLocationChange(e.target.value)}
              className="border rounded px-3 py-2 text-sm bg-white max-w-[200px]"
            >
              {locations.map(l => (
                <option key={l.name} value={l.name}>{l.title}</option>
              ))}
            </select>
          )}
          <span className="text-xs text-gray-400">範囲変更</span>
          <select
            value={yearmonth}
            onChange={e => setYearmonth(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          >
            {prevMonths.map(ym => (
              <option key={ym} value={ym}>{ym.replace('/', '年')}月</option>
            ))}
          </select>
          <button
            onClick={() => fetchData(yearmonth)}
            disabled={loading}
            className="btn-secondary flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            更新
          </button>
          <button
            onClick={exportCSV}
            className="btn-secondary flex items-center gap-1.5"
          >
            <Download size={14} />
            CSV DL
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 gap-0">
        {(['月別集計', '日別推移', '曜日平均', '全社比較', '使い方'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ======== 月別集計 ======== */}
      {tab === '月別集計' && (
        <div className="space-y-6">
          <p className="text-xs text-gray-400">
            期間: {monthlyCache.length > 0
              ? `${monthlyCache[0].yearmonth.replace('/', '年')}月〜${monthlyCache[monthlyCache.length - 1].yearmonth.replace('/', '年')}月`
              : '—'}
          </p>

          {/* ユーザーへのリーチ */}
          <div className="card">
            <h2 className="font-bold text-surface-900 mb-4">ユーザーへのリーチ</h2>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyChartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {REACH_METRICS.map(m => (
                    <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color}
                         stackId="reach" radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                「更新」ボタンを押してデータを取得してください
              </div>
            )}
            <ComparisonTable
              metrics={REACH_METRICS}
              current={curTotals}
              previous={prevTotals}
              curLabel={curLabel}
              prevLabel={prevLabel}
            />
          </div>

          {/* ユーザーの興味 */}
          <div className="card">
            <h2 className="font-bold text-surface-900 mb-4">ユーザーの興味</h2>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyChartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {INTEREST_METRICS.map(m => (
                    <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color}
                         stackId="interest" radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-36 flex items-center justify-center text-gray-400 text-sm">データなし</div>
            )}
            <ComparisonTable
              metrics={INTEREST_METRICS}
              current={curTotals}
              previous={prevTotals}
              curLabel={curLabel}
              prevLabel={prevLabel}
            />
          </div>

          {/* ユーザーの行動 */}
          <div className="card">
            <h2 className="font-bold text-surface-900 mb-4">ユーザーの行動</h2>
            {monthlyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyChartData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {ACTION_METRICS.map(m => (
                    <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color}
                         radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-36 flex items-center justify-center text-gray-400 text-sm">データなし</div>
            )}
            <ComparisonTable
              metrics={ACTION_METRICS}
              current={curTotals}
              previous={prevTotals}
              curLabel={curLabel}
              prevLabel={prevLabel}
            />
          </div>

          {/* 検索されたキーワード */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-surface-900">検索されたキーワード</h2>
              <div className="flex gap-2">
                <button
                  onClick={fetchKeywords}
                  disabled={loadingKw}
                  className="btn-secondary text-sm flex items-center gap-1.5"
                >
                  <RefreshCw size={13} className={loadingKw ? 'animate-spin' : ''} />
                </button>
                {searchedKeywords.length > 0 && (
                  <button onClick={exportKwCSV} className="btn-secondary text-sm flex items-center gap-1.5">
                    <Download size={13} />CSV
                  </button>
                )}
              </div>
            </div>
            {searchedKeywords.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left px-4 py-2 font-medium rounded-tl">キーワード</th>
                    <th className="text-right px-4 py-2 font-medium rounded-tr">表示された回数</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedKeywords.map((kw, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{kw.searchKeyword}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {kw.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-gray-400 text-sm text-center py-8">
                {loadingKw ? '取得中...' : '右上の更新ボタンを押してください'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== 日別推移 ======== */}
      {tab === '日別推移' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-surface-900">日別推移 — {curLabel}</h2>
          </div>
          {loading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dailyChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={dailyChartData}>
                <defs>
                  {DAILY_METRICS.map(m => (
                    <linearGradient key={m.key} id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={m.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={m.color} stopOpacity={0}   />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {DAILY_METRICS.map(m => (
                  <Area
                    key={m.key}
                    type="monotone"
                    dataKey={m.key}
                    name={m.label}
                    stroke={m.color}
                    fill={`url(#grad-${m.key})`}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-surface-400 text-sm">
              データがありません
            </div>
          )}
        </div>
      )}

      {/* ======== 曜日平均 ======== */}
      {tab === '曜日平均' && (
        <div className="card">
          <h2 className="font-bold text-surface-900 mb-6">曜日別平均 — {curLabel}</h2>
          {loading ? (
            <div className="h-60 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : weekdayData.some(d => DAILY_METRICS.some(m => (d[m.key] as number) > 0)) ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={weekdayData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="weekday" tick={{ fontSize: 13 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {DAILY_METRICS.map(m => (
                  <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color}
                       radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-surface-400 text-sm">
              先に「更新」ボタンを押してデータを取得してください
            </div>
          )}
        </div>
      )}

      {/* ======== 全社比較 ======== */}
      {tab === '全社比較' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-bold text-surface-900">全社比較 — 過去12ヶ月</h2>
            <select
              value={allBizMetric}
              onChange={e => setAllBizMetric(e.target.value as typeof allBizMetric)}
              className="border rounded px-3 py-1.5 text-sm bg-white"
            >
              <option value="reach">リーチ（検索表示）</option>
              <option value="route">ルート</option>
              <option value="web">ウェブサイト</option>
              <option value="call">通話</option>
            </select>
          </div>
          {allBizLoading ? (
            <div className="h-80 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-gray-500">全ビジネスデータ取得中...</span>
            </div>
          ) : allBizData.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={allBizChartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {allBizData.map((biz, i) => (
                  <Bar
                    key={biz.location}
                    dataKey={biz.title}
                    fill={BIZ_COLORS[i % BIZ_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              GBP連携済みビジネスのデータを読み込みます
            </div>
          )}
          {allBizData.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              ※ GBPロケーションIDが設定されているビジネスのみ表示されます
            </div>
          )}
        </div>
      )}

      {/* ======== 使い方 ======== */}
      {tab === '使い方' && (
        <div className="card space-y-5 text-sm text-surface-700 leading-relaxed">
          <h2 className="font-bold text-surface-900 text-base">パフォーマンスの見方</h2>
          <div>
            <p className="font-semibold text-surface-800 mb-1">📊 月別集計</p>
            <p>月ごとの推移を棒グラフで確認できます。前年同月との比較テーブルで成長率を把握しましょう。「更新」ボタンを押すたびに月別キャッシュが蓄積され、長期グラフが自動的に伸びていきます。</p>
          </div>
          <div>
            <p className="font-semibold text-surface-800 mb-1">📈 日別推移</p>
            <p>選択月の日ごとの変化を面グラフで確認できます。特定日のイベントや施策の効果分析に役立ちます。</p>
          </div>
          <div>
            <p className="font-semibold text-surface-800 mb-1">📅 曜日平均</p>
            <p>曜日ごとの平均値を棒グラフで表示します。集客が多い曜日を把握してMEO施策の投稿タイミングの参考にしましょう。</p>
          </div>
          <div>
            <p className="font-semibold text-surface-800 mb-1">🔍 検索されたキーワード</p>
            <p>ユーザーがどのようなキーワードでビジネスを発見したかを確認できます。MEO対策のキーワード選定に活用してください。</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 text-blue-800">
            <p className="font-semibold mb-1">💡 ヒント</p>
            <p>月別集計グラフは定期的に「更新」を押すことで過去データが蓄積されます。毎月末に更新する習慣をつけると、長期トレンドが可視化されます。</p>
          </div>
        </div>
      )}
    </div>
  )
}
