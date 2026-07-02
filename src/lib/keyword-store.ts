/**
 * キーワード設定・順位データのサーバーサイドファイル保存
 * data/ ディレクトリに JSON で保存
 */

import fs   from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')

// =============================================
// 型定義
// =============================================

export interface KeywordSettings {
  locationName:   string
  keywords:       string[]
  businessTitle?: string  // Places API 検索用ビジネス表示名
  lastUpdated?:   string
}

export interface DailyRankingEntry {
  keyword: string
  rank:    number | null
}

// =============================================
// 設定 (キーワード + ロケーション)
// =============================================

export function getKeywordSettings(): KeywordSettings {
  const file = path.join(DATA_DIR, 'keyword-settings.json')
  if (!fs.existsSync(file)) return { locationName: '', keywords: [] }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as KeywordSettings
  } catch {
    return { locationName: '', keywords: [] }
  }
}

export function saveKeywordSettings(settings: KeywordSettings): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const file = path.join(DATA_DIR, 'keyword-settings.json')
  fs.writeFileSync(
    file,
    JSON.stringify({ ...settings, lastUpdated: new Date().toISOString() }, null, 2),
  )
}

// =============================================
// 順位データ (日別)
// =============================================

function locationToId(locationName: string) {
  return locationName.replace(/\//g, '_')
}

export function saveRankings(locationName: string, date: string, rankings: DailyRankingEntry[]): void {
  const dir = path.join(DATA_DIR, 'rankings', locationToId(locationName))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${date}.json`)
  fs.writeFileSync(file, JSON.stringify(rankings, null, 2))
}

export function loadMonthRankings(
  locationName: string,
  year: number,
  month: number,
): Record<number, DailyRankingEntry[]> {
  const dir = path.join(DATA_DIR, 'rankings', locationToId(locationName))
  if (!fs.existsSync(dir)) return {}

  const result: Record<number, DailyRankingEntry[]> = {}
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const file    = path.join(dir, `${dateStr}.json`)
    if (fs.existsSync(file)) {
      try { result[d] = JSON.parse(fs.readFileSync(file, 'utf-8')) } catch {}
    }
  }
  return result
}
