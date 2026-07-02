'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  TrendingUp, TrendingDown, Eye, Phone, Navigation,
  Globe, Search, MapPin, Star, RefreshCw, ChevronRight
} from 'lucide-react'
import clsx from 'clsx'
import Link from 'next/link'
import { format, subMonths } from 'date-fns'
import { ja } from 'date-fns/locale'

interface SummaryData {
  totalSearchViews: number
  totalMapViews: number
  totalWebsiteClicks: number
  totalCallClicks: number
  totalDirectionRequests: number
  totalDirectQueries: number
  totalIndirectQueries: number
}

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  change?: number | null
}

function StatCard({ label, value, icon, color, change }: StatCardProps) {
  return (
    <div className="stat-card card-hover animate-slide-up">
      <div className="flex items-start justify-between">
        <span className="stat-label">{label}</span>
        <span className={clsx('flex items-center justify-center w-9 h-9 rounded-lg', color)}>
          {icon}
        </span>
      </div>
      <div className="stat-value">{value.toLocaleString()}</div>
      {change != null && (
        <div className={change >= 0 ? 'stat-change-up' : 'stat-change-down'}>
          {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(change)}% 先月比
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [yearmonth, setYearmonth] = useState(format(new Date(), 'yyyy/M'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

    async function loadData() {
  setLoading(true)
  setError(null)

  try {
    const bizRes = await fetch('/api/business')
    const bizData = await bizRes.json()
    const locationList = bizData.locations ?? []
    setLocations(locationList)

    if (!locationList.length) {
      setError('ビジネスプロフィールが見つかりません')
      return
    }

    const loc =
      locationList.find((l: any) => l.name === selectedLocation) ??
      locationList[0]

    const perfRes = await fetch(
      `/api/performance?location=${encodeURIComponent(loc.name)}&yearmonth=${yearmonth}`
    )
    const perfData = await perfRes.json()

    if (perfData.error) throw new Error(perfData.error)

    setSummary(perfData.summary)
  } catch (e) {
    setError(e instanceof Error ? e.message : 'データの取得に失敗しました')
  } finally {
    setLoading(false)
  }
}

useEffect(() => {
  loadData()
}, [yearmonth, selectedLocation])

const prevMonths = Array.from({ length: 6 }, (_, i) => {
  const d = subMonths(new Date(), i)
  return format(d, 'yyyy/M')
})

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-surface-900">
            ダッシュボード
          </h1>

          {locations.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <MapPin size={14} />

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="input text-sm w-auto"
              >
                {locations.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* 月選択 */}
          <select
            value={yearmonth}
            onChange={(e) => setYearmonth(e.target.value)}
            className="input w-auto text-sm"
          >
            {prevMonths.map((ym) => (
              <option key={ym} value={ym}>
                {ym.replace('/', '年')}月
              </option>
            ))}
          </select>

          <button onClick={loadData} className="btn-secondary" disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            更新
          </button>
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <span className="font-medium">エラー:</span> {error}
          <p className="mt-1 text-red-600 text-xs">
            Google Cloud ConsoleでBusiness Profile APIが有効化されているか確認してください。
          </p>
        </div>
      )}

      {/* ローディング */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse bg-surface-100" />
          ))}
        </div>
      )}

      {/* 統計カード */}
      {summary && !loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="検索表示回数"
              value={summary.totalSearchViews}
              icon={<Search size={18} className="text-brand-600" />}
              color="bg-brand-50"
            />
            <StatCard
              label="マップ表示回数"
              value={summary.totalMapViews}
              icon={<MapPin size={18} className="text-amber-600" />}
              color="bg-amber-50"
            />
            <StatCard
              label="Webサイトクリック"
              value={summary.totalWebsiteClicks}
              icon={<Globe size={18} className="text-emerald-600" />}
              color="bg-emerald-50"
            />
            <StatCard
              label="電話クリック"
              value={summary.totalCallClicks}
              icon={<Phone size={18} className="text-rose-600" />}
              color="bg-rose-50"
            />
            <StatCard
              label="道順リクエスト"
              value={summary.totalDirectionRequests}
              icon={<Navigation size={18} className="text-orange-600" />}
              color="bg-orange-50"
            />
            <StatCard
              label="ダイレクト検索"
              value={summary.totalDirectQueries}
              icon={<Eye size={18} className="text-purple-600" />}
              color="bg-purple-50"
            />
            <StatCard
              label="間接検索"
              value={summary.totalIndirectQueries}
              icon={<Search size={18} className="text-cyan-600" />}
              color="bg-cyan-50"
            />
          </div>

          {/* クイックリンク */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { href: '/dashboard/performance', label: 'パフォーマンス詳細', desc: '日別グラフ・トレンド分析', icon: <TrendingUp size={20} className="text-brand-600" /> },
              { href: '/dashboard/keywords',    label: 'キーワード順位',     desc: '検索順位のモニタリング',  icon: <Search size={20} className="text-purple-600" /> },
              { href: '/dashboard/reviews',     label: 'クチコミ管理',       desc: 'レビューへの返信・管理',  icon: <Star size={20} className="text-amber-500" /> },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="card card-hover flex items-center gap-4 cursor-pointer animate-slide-up">
                <div className="w-10 h-10 rounded-xl bg-surface-50 flex items-center justify-center flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-surface-900 text-sm">{item.label}</div>
                  <div className="text-surface-500 text-xs mt-0.5">{item.desc}</div>
                </div>
                <ChevronRight size={16} className="text-surface-400 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
