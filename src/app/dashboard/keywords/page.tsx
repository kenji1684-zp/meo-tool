'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, getDaysInMonth, startOfMonth, getDay, subMonths } from 'date-fns'
import { RefreshCw, Download, Plus, X, Save, List } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'

// =============================================
// 定数
// =============================================

const KEYWORD_COLORS = [
  '#ef4444', '#8b5cf6', '#10b981', '#f59e0b',
  '#f97316', '#ec4899', '#059669', '#3b82f6',
  '#06b6d4', '#84cc16',
]

const MAX_RANK = 20  // これより下は「圏外」扱い
const KAIGAI_VALUE = MAX_RANK + 1  // グラフ上の圏外の値

const DEFAULT_KEYWORDS = [
  '徳島 肉通販',
  '北島町 精肉店',
  '徳島市 切り落とし',
  '徳島市 国産タン',
  '徳島市 国産ハラミ',
  '徳島市 肉セール',
]

// =============================================
// 型
// =============================================

interface DailyRanking {
  keyword: string
  rank: number | null  // null = 圏外
}

// =============================================
// ランクバッジスタイル
// =============================================

function rankBadgeStyle(rank: number | null, color: string) {
  if (rank === null) return { bg: '#9ca3af', text: '圏外' }
  return { bg: color, text: `${rank}位` }
}

// =============================================
// メインコンポーネント
// =============================================

export default function KeywordsPage() {
  const [yearmonth, setYearmonth]   = useState(format(new Date(), 'yyyy/M'))
  const [keywords, setKeywords]     = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [locations, setLocations]   = useState<{ name: string; title: string }[]>([])
  const [locationName, setLocationName] = useState('')
  const [showBulk, setShowBulk]     = useState(false)
  const [bulkText, setBulkText]     = useState('')
  // date (YYYY-M-D の数値 key) → DailyRanking[]
  const [dailyData, setDailyData]   = useState<Record<number, DailyRanking[]>>({})

  // 選択中のビジネスタイトル
  const locationTitle = locations.find(l => l.name === locationName)?.title ?? locationName

  // キーワード読込（サーバー設定を優先、なければlocalStorage）
  useEffect(() => {
    fetch('/api/keywords/settings')
      .then(r => r.json())
      .then(d => {
        if (d.keywords?.length > 0) {
          setKeywords(d.keywords)
          if (d.locationName) setLocationName(d.locationName)
        } else {
          const ls = localStorage.getItem('meo_keywords')
          setKeywords(ls ? JSON.parse(ls) : DEFAULT_KEYWORDS)
        }
      })
      .catch(() => {
        const ls = localStorage.getItem('meo_keywords')
        setKeywords(ls ? JSON.parse(ls) : DEFAULT_KEYWORDS)
      })
  }, [])

  useEffect(() => {
    localStorage.setItem('meo_keywords', JSON.stringify(keywords))
  }, [keywords])

  // 選択月の日別データ読込（localStorage + サーバーファイルをマージ）
  useEffect(() => {
    if (!locationName) return
    const [y, m] = yearmonth.split('/').map(Number)
    const days   = getDaysInMonth(new Date(y, m - 1))
    const data: Record<number, DailyRanking[]> = {}

    // localStorageから読込
    for (let d = 1; d <= days; d++) {
      const key    = `rankings_daily_${locationName}_${y}-${m}-${d}`
      const stored = localStorage.getItem(key)
      if (stored) {
        try { data[d] = JSON.parse(stored) } catch {}
      }
    }

    // サーバーファイルからも読込してマージ（自動チェックのデータを反映）
    fetch(`/api/keywords/rankings?location=${encodeURIComponent(locationName)}&yearmonth=${encodeURIComponent(yearmonth)}`)
      .then(r => r.json())
      .then(res => {
        const merged = { ...data }
        Object.entries(res.rankings ?? {}).forEach(([d, rankings]) => {
          if (!merged[Number(d)]) merged[Number(d)] = rankings as DailyRanking[]
        })
        setDailyData(merged)
      })
      .catch(() => setDailyData(data))
  }, [yearmonth, locationName])

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
        if (locs.length > 0 && !locationName) setLocationName(locs[0].name)
      })
      .catch(() => {})
  }, [])

  // =============================================
  // 順位確認
  // =============================================

  async function checkRankings() {
    if (!locationName || keywords.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(
        `/api/keywords?location=${encodeURIComponent(locationName)}&keywords=${encodeURIComponent(keywords.join(','))}`
      )
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      const rankings: DailyRanking[] = (data.rankings ?? []).map((r: { keyword: string; currentRank: number | null }) => ({
        keyword: r.keyword,
        rank:    r.currentRank,
      }))

      const today = new Date()
      const y     = today.getFullYear()
      const m     = today.getMonth() + 1
      const d     = today.getDate()
      const ym    = `${y}/${m}`
      const key   = `rankings_daily_${locationName}_${y}-${m}-${d}`

      localStorage.setItem(key, JSON.stringify(rankings))

      // 常に今月に切り替えてデータを表示
      setYearmonth(ym)
      setDailyData(prev => ({ ...prev, [d]: rankings }))
    } catch (e) {
      setError(e instanceof Error ? e.message : '順位取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function addKeyword() {
    const kw = newKeyword.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
      setNewKeyword('')
    }
  }

  function removeKeyword(kw: string) {
    setKeywords(keywords.filter(k => k !== kw))
  }

  function addBulkKeywords() {
    const newKws = bulkText
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0 && !keywords.includes(k))
    if (newKws.length > 0) setKeywords([...keywords, ...newKws])
    setBulkText('')
    setShowBulk(false)
  }

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/keywords/settings', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          locationName,
          keywords,
          businessTitle: locations.find(l => l.name === locationName)?.title ?? locationName,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // =============================================
  // グラフデータ生成
  // =============================================

  const [year, month] = yearmonth.split('/').map(Number)
  const daysInMonth   = getDaysInMonth(new Date(year, month - 1))

  const lineChartData = Array.from({ length: daysInMonth }, (_, i) => {
    const day     = i + 1
    const dayData = dailyData[day] ?? []
    const entry: Record<string, number | string | null> = { day: `${day}日` }
    keywords.forEach(kw => {
      const r = dayData.find(d => d.keyword === kw)
      if (r === undefined) {
        entry[kw] = null             // データなし（線を切る）
      } else if (r.rank === null) {
        entry[kw] = KAIGAI_VALUE     // 圏外
      } else {
        entry[kw] = r.rank
      }
    })
    return entry
  })

  const hasData = Object.keys(dailyData).length > 0

  // =============================================
  // カレンダーデータ
  // =============================================

  const firstDow = getDay(startOfMonth(new Date(year, month - 1)))

  // =============================================
  // CSV エクスポート
  // =============================================

  function exportCSV() {
    const headers = ['日付', ...keywords]
    const rows    = Array.from({ length: daysInMonth }, (_, i) => {
      const day     = i + 1
      const dayData = dailyData[day] ?? []
      return [
        `${yearmonth}/${day}`,
        ...keywords.map(kw => {
          const r = dayData.find(d => d.keyword === kw)
          if (!r) return ''
          return r.rank === null ? '圏外' : String(r.rank)
        }),
      ]
    })
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `keyword-rankings-${yearmonth.replace('/', '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const prevMonths = Array.from({ length: 12 }, (_, i) =>
    format(subMonths(new Date(), i), 'yyyy/M')
  )

  // =============================================
  // カスタム Tooltip
  // =============================================

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean
    payload?: { name: string; value: number | null; color: string }[]
    label?: string
  }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
        <p className="font-bold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {p.value === null ? '—' : p.value >= KAIGAI_VALUE ? '圏外' : `${p.value}位`}
          </p>
        ))}
      </div>
    )
  }

  // =============================================
  // レンダリング
  // =============================================

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-surface-900">キーワード表示順位</h1>
          <p className="text-surface-500 text-sm mt-1">Google マップ検索でのキーワード別表示順位</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* ビジネス選択 */}
          {locations.length > 1 ? (
            <select
              value={locationName}
              onChange={e => setLocationName(e.target.value)}
              className="border rounded px-3 py-2 text-sm bg-white max-w-[200px]"
            >
              {locations.map(l => (
                <option key={l.name} value={l.name}>{l.title}</option>
              ))}
            </select>
          ) : locationTitle ? (
            <span className="text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 rounded px-3 py-2">
              📍 {locationTitle}
            </span>
          ) : null}
          {/* 月選択 */}
          <select
            value={yearmonth}
            onChange={e => setYearmonth(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white"
          >
            {prevMonths.map(ym => (
              <option key={ym} value={ym}>{ym.replace('/', '年')}月</option>
            ))}
          </select>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} />CSVエクスポート
          </button>
        </div>
      </div>

      {/* キーワード管理 */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-surface-900">モニタリングキーワード</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulk(v => !v)}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <List size={13} />一括追加
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors ${
                saved
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'btn-secondary'
              }`}
            >
              <Save size={13} />
              {saved ? '保存済み ✓' : saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>

        {/* 一括追加パネル */}
        {showBulk && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs text-blue-700 mb-2 font-medium">キーワードを1行1つで入力してください</p>
            <textarea
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={'徳島 建築\n徳島 外構\n徳島 リフォーム\n...'}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            />
            <div className="flex gap-2 mt-2">
              <button onClick={addBulkKeywords} className="btn-primary text-sm flex items-center gap-1.5">
                <Plus size={14} />追加する
              </button>
              <button onClick={() => { setShowBulk(false); setBulkText('') }} className="btn-secondary text-sm">
                キャンセル
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newKeyword}
            onChange={e => setNewKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="キーワードを入力して Enter"
            className="input flex-1"
          />
          <button onClick={addKeyword} className="btn-primary flex items-center gap-1.5">
            <Plus size={15} />追加
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {keywords.map((kw, i) => (
            <span
              key={kw}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: KEYWORD_COLORS[i % KEYWORD_COLORS.length] }}
            >
              {kw}
              <button onClick={() => removeKeyword(kw)} className="opacity-70 hover:opacity-100">
                <X size={12} />
              </button>
            </span>
          ))}
          {keywords.length === 0 && (
            <span className="text-surface-400 text-sm">キーワードを追加してください</span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={checkRankings}
            disabled={loading || keywords.length === 0 || !locationName}
            className="btn-primary flex items-center gap-1.5"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            {loading ? '順位確認中...' : '順位を確認する'}
          </button>
          <p className="text-xs text-gray-400">
            ※「設定を保存」後、次回アプリ起動時に当日未チェックなら自動チェックされます
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ======== 折れ線グラフ ======== */}
      <div className="card">
        <h2 className="font-bold text-surface-900 mb-4">
          キーワード表示順位（{yearmonth.replace('/', '年')}月）
        </h2>

        {hasData ? (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart
                data={lineChartData}
                margin={{ top: 10, right: 20, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  domain={[1, KAIGAI_VALUE]}
                  reversed={true}
                  tickFormatter={v => v >= KAIGAI_VALUE ? '圏外' : `${v}位`}
                  ticks={[1, 5, 10, 15, 20, KAIGAI_VALUE]}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* 20位ラインを引く */}
                <ReferenceLine y={MAX_RANK} stroke="#e5e7eb" strokeDasharray="4 2" label={{ value: '20位', fontSize: 9, fill: '#9ca3af', position: 'right' }} />
                {keywords.map((kw, i) => (
                  <Line
                    key={kw}
                    type="monotone"
                    dataKey={kw}
                    name={kw}
                    stroke={KEYWORD_COLORS[i % KEYWORD_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: KEYWORD_COLORS[i % KEYWORD_COLORS.length] }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>

            {/* 凡例（色付きボックス） */}
            <div className="flex flex-wrap gap-3 mt-3 px-2">
              {keywords.map((kw, i) => (
                <span key={kw} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className="w-4 h-3 rounded-sm inline-block flex-shrink-0"
                    style={{ backgroundColor: KEYWORD_COLORS[i % KEYWORD_COLORS.length] }}
                  />
                  {kw}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
            <p>「順位を確認する」ボタンを押してデータを取得してください</p>
            <p className="text-xs text-gray-300">毎日確認することで順位の推移グラフが作成されます</p>
          </div>
        )}
      </div>

      {/* ======== カレンダービュー ======== */}
      <div className="card">
        <h2 className="font-bold text-surface-900 mb-4">日別順位カレンダー</h2>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div
              key={d}
              className={`text-center text-xs font-semibold py-1 ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* カレンダーセル */}
        <div className="grid grid-cols-7 gap-1">
          {/* 月初めの空白 */}
          {Array.from({ length: firstDow }, (_, i) => (
            <div key={`blank-${i}`} className="min-h-16 rounded-lg bg-gray-50" />
          ))}

          {/* 日付セル */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day     = i + 1
            const dayData = dailyData[day]
            const hasRank = !!dayData

            return (
              <div
                key={day}
                className={`min-h-16 rounded-lg border p-1 ${
                  hasRank
                    ? 'border-gray-200 bg-white'
                    : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="text-xs text-gray-400 mb-0.5 leading-none">{day}</div>
                {hasRank && (
                  <div className="flex flex-col gap-0.5">
                    {keywords.map((kw, ki) => {
                      const r     = dayData.find(d => d.keyword === kw)
                      if (!r) return null
                      const color = KEYWORD_COLORS[ki % KEYWORD_COLORS.length]
                      const bg    = r.rank === null ? '#9ca3af' : color
                      const text  = r.rank === null ? '圏外' : `${r.rank}位`
                      return (
                        <div
                          key={kw}
                          title={kw}
                          className="text-white text-center rounded leading-tight px-0.5"
                          style={{ backgroundColor: bg, fontSize: '9px', padding: '1px 2px' }}
                        >
                          {text}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* カレンダー凡例 */}
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
            {keywords.map((kw, i) => (
              <span key={kw} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span
                  className="w-3 h-3 rounded-sm inline-block flex-shrink-0"
                  style={{ backgroundColor: KEYWORD_COLORS[i % KEYWORD_COLORS.length] }}
                />
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
