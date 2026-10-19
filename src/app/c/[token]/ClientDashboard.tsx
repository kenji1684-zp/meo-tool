'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Search, MapPin, Globe, Phone, Navigation } from 'lucide-react'

// =============================================
// 型
// =============================================

interface MetricSeries {
  metric: string
  label: string
  total: number
  data: { day: number; value: number }[]
}
interface PerfResponse { yearmonth?: string; metrics?: MetricSeries[]; error?: string }
interface KwResponse { keywords?: { searchKeyword: string; count: number }[]; keywordsMonth?: string; error?: string }
interface RankResponse { keywords: string[]; rankings: Record<string, { keyword: string; rank: number | null }[]> }

// =============================================
// ユーティリティ
// =============================================

function ymString(d: Date) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`
}
function shiftMonth(ym: string, diff: number) {
  const [y, m] = ym.split('/').map(Number)
  return ymString(new Date(y, m - 1 + diff, 1))
}
function ymLabel(ym: string) {
  const [y, m] = ym.split('/').map(Number)
  return `${y}年${m}月`
}
function sumOf(metrics: MetricSeries[] | undefined, keys: string[]) {
  return (metrics ?? []).filter((m) => keys.includes(m.metric)).reduce((s, m) => s + m.total, 0)
}

const KPI_DEFS = [
  { label: '検索での表示', keys: ['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'], icon: Search, color: 'text-emerald-600 bg-emerald-50' },
  { label: 'マップでの表示', keys: ['BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'], icon: MapPin, color: 'text-amber-600 bg-amber-50' },
  { label: 'Webサイトクリック', keys: ['WEBSITE_CLICKS'], icon: Globe, color: 'text-sky-600 bg-sky-50' },
  { label: '電話', keys: ['CALL_CLICKS'], icon: Phone, color: 'text-rose-600 bg-rose-50' },
  { label: 'ルート検索', keys: ['BUSINESS_DIRECTION_REQUESTS'], icon: Navigation, color: 'text-violet-600 bg-violet-50' },
]

function rankClass(rank: number | null | undefined) {
  if (rank == null) return 'bg-slate-50 text-slate-300'
  if (rank <= 3) return 'bg-emerald-500 text-white'
  if (rank <= 10) return 'bg-emerald-100 text-emerald-800'
  if (rank <= 20) return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-500'
}

// =============================================
// コンポーネント
// =============================================

export default function ClientDashboard({ token, companyName }: { token: string; companyName: string }) {
  const thisMonth = ymString(new Date())
  const [ym, setYm] = useState(thisMonth)
  const [perf, setPerf] = useState<PerfResponse | null>(null)
  const [prevPerf, setPrevPerf] = useState<PerfResponse | null>(null)
  const [kw, setKw] = useState<KwResponse | null>(null)
  const [rank, setRank] = useState<RankResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const monthOptions = useMemo(() => Array.from({ length: 13 }, (_, i) => shiftMonth(thisMonth, -i)), [thisMonth])
  const api = (type: string, month: string) =>
    fetch(`/api/client/${encodeURIComponent(token)}?type=${type}&yearmonth=${encodeURIComponent(month)}`)
      .then((r) => r.json())
      .catch(() => ({ error: '通信エラーが発生しました' }))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // 検索キーワードは Google の公開が遅れるため、当月選択時は前月分を表示
    const kwMonth = ym === thisMonth ? shiftMonth(ym, -1) : ym
    Promise.all([
      api('performance', ym),
      api('performance', shiftMonth(ym, -1)),
      api('keywords', kwMonth),
      api('rankings', ym),
    ]).then(([p, pp, k, r]) => {
      if (cancelled) return
      setPerf(p); setPrevPerf(pp); setKw(k); setRank(r); setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym])

  // ---- グラフ用データ ----
  const daysInMonth = useMemo(() => {
    const [y, m] = ym.split('/').map(Number)
    return new Date(y, m, 0).getDate()
  }, [ym])

  const dailyRows = useMemo(() => {
    const get = (key: string, day: number) =>
      perf?.metrics?.find((m) => m.metric === key)?.data.find((d) => d.day === day)?.value ?? 0
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1
      return {
        day: `${day}日`,
        検索: get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', day) + get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH', day),
        マップ: get('BUSINESS_IMPRESSIONS_DESKTOP_MAPS', day) + get('BUSINESS_IMPRESSIONS_MOBILE_MAPS', day),
        Webサイト: get('WEBSITE_CLICKS', day),
        電話: get('CALL_CLICKS', day),
        ルート: get('BUSINESS_DIRECTION_REQUESTS', day),
      }
    })
  }, [perf, daysInMonth])

  const rankDays = useMemo(
    () => Object.keys(rank?.rankings ?? {}).map(Number).sort((a, b) => a - b),
    [rank],
  )
  const latestDay = rankDays[rankDays.length - 1]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-sky-600 tracking-wide">Googleビジネスプロフィール 月次レポート</p>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{companyName} 様</h1>
          </div>
          <select
            value={ym}
            onChange={(e) => setYm(e.target.value)}
            className="input !w-auto font-medium"
            aria-label="表示する月"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{ymLabel(m)}{m === thisMonth ? '（今月・途中経過）' : ''}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {perf?.error && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">{perf.error}</div>
        )}

        {/* KPI */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {KPI_DEFS.map(({ label, keys, icon: Icon, color }) => {
            const cur = sumOf(perf?.metrics, keys)
            const prev = sumOf(prevPerf?.metrics, keys)
            const diff = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
            return (
              <div key={label} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}><Icon size={16} /></span>
                  <span className="text-xs sm:text-sm text-slate-500 font-medium">{label}</span>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-3">
                  {loading ? <span className="inline-block w-16 h-7 bg-slate-100 rounded animate-pulse" /> : cur.toLocaleString()}
                </p>
                {!loading && (
                  <div className="text-xs mt-1">
                    <p className={`flex items-center gap-1 whitespace-nowrap ${diff == null ? 'text-slate-400' : diff >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {diff == null ? <Minus size={12} /> : diff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {diff == null ? '前月データなし' : `前月比 ${diff >= 0 ? '+' : ''}${diff}%`}
                    </p>
                    <p className="text-slate-400 whitespace-nowrap">前月 {prev.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* グラフ */}
        <section className="grid lg:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="font-bold text-slate-800">日別の表示回数</h2>
            <p className="text-xs text-slate-400 mb-4">Google検索・Googleマップでお店が表示された回数</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} width={36} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="検索" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                  <Area type="monotone" dataKey="マップ" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.25} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h2 className="font-bold text-slate-800">日別のお客様の行動</h2>
            <p className="text-xs text-slate-400 mb-4">プロフィールから Webサイト・電話・ルート検索された回数</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Webサイト" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="電話" stackId="a" fill="#ef4444" />
                  <Bar dataKey="ルート" stackId="a" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* キーワード順位 */}
        {rank && rank.keywords.length > 0 && (
          <section className="card">
            <h2 className="font-bold text-slate-800">対策キーワードのマップ順位</h2>
            <p className="text-xs text-slate-400 mb-4">Googleマップで各キーワードを検索したときの表示順位（毎日自動チェック・「-」は20位圏外）</p>
            {rankDays.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">この月の順位データはまだありません</p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="text-xs border-separate border-spacing-0.5">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white text-left font-medium text-slate-500 pr-3">キーワード</th>
                      <th className="font-medium text-slate-500 px-2 whitespace-nowrap">最新</th>
                      {rankDays.map((d) => <th key={d} className="font-normal text-slate-400 min-w-[28px]">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rank.keywords.map((k) => {
                      const latest = rank.rankings[latestDay]?.find((r) => r.keyword === k)?.rank
                      return (
                        <tr key={k}>
                          <td className="sticky left-0 z-10 bg-white text-slate-700 pr-3 whitespace-nowrap max-w-[140px] sm:max-w-none truncate" title={k}>{k}</td>
                          <td className="px-1 min-w-[36px]">
                            <span className={`block text-center rounded-md py-1 font-bold ${rankClass(latest)}`}>{latest ?? '-'}</span>
                          </td>
                          {rankDays.map((d) => {
                            const r = rank.rankings[d]?.find((x) => x.keyword === k)?.rank
                            return <td key={d} className="min-w-[28px]"><span className={`block text-center rounded py-1 tabular-nums ${rankClass(r)}`}>{r ?? '-'}</span></td>
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 検索キーワード */}
        <section className="card">
          <h2 className="font-bold text-slate-800">お店が表示された検索キーワード</h2>
          <p className="text-xs text-slate-400 mb-4">
            {kw?.keywordsMonth ? `${ymLabel(kw.keywordsMonth)}分` : ''}（Googleの公開は2〜3週間遅れのため、今月を選んだ場合は前月以前の値を表示）
          </p>
          {loading ? (
            <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
          ) : !kw?.keywords?.length ? (
            <p className="text-sm text-slate-400 py-6 text-center">{kw?.error ?? 'データがありません'}</p>
          ) : (
            <ol className="grid sm:grid-cols-2 gap-x-8">
              {kw.keywords.slice(0, 20).map((k, i) => {
                const max = kw.keywords![0].count || 1
                return (
                  <li key={k.searchKeyword} className="flex items-center gap-3 py-2 border-b border-slate-50 text-sm">
                    <span className="w-5 text-right text-slate-400 tabular-nums">{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-slate-700">{k.searchKeyword}</span>
                      <span className="block h-1 mt-1 rounded bg-sky-100">
                        <span className="block h-1 rounded bg-sky-500" style={{ width: `${(k.count / max) * 100}%` }} />
                      </span>
                    </span>
                    <span className="tabular-nums text-slate-600 font-medium">{k.count.toLocaleString()}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <footer className="text-center text-xs text-slate-400 py-6 space-y-1">
          <p>データ出典：Googleビジネスプロフィール。直近2〜3日分はGoogle側の集計待ちで少なく表示されることがあります。</p>
          <p>このページは {companyName} 様専用です。URLの共有にご注意ください。</p>
          <p className="pt-2">Provided by 株式会社ZERO PLUS</p>
        </footer>
      </main>
    </div>
  )
}
