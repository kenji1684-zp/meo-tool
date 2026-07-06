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

// 複数社対応の企業設定
export interface CompanySettings {
  id:            string   // フォルダ名に使う識別子 (例: "asteru")
  businessTitle: string   // 表示名 (例: "アステル（株）")
  locationName?: string   // GBP ロケーション ID (手動チェック用、任意)
  keywords:      string[]
}

// 旧形式との後方互換
export interface KeywordSettings {
  locationName:   string
  keywords:       string[]
  businessTitle?: string
  lastUpdated?:   string
}

export interface DailyRankingEntry {
  keyword: string
  rank:    number | null
}

// =============================================
// 複数社設定
// =============================================

export function getAllCompanySettings(): CompanySettings[] {
  const file = path.join(DATA_DIR, 'keyword-settings.json')
  if (!fs.existsSync(file)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (raw.companies) return raw.companies as CompanySettings[]
    if (Array.isArray(raw)) return raw as CompanySettings[]
    // 旧形式（単一オブジェクト）
    if (raw.locationName) {
      return [{
        id:            raw.locationName.replace(/\//g, '_'),
        businessTitle: raw.businessTitle ?? raw.locationName,
        locationName:  raw.locationName,
        keywords:      raw.keywords ?? [],
      }]
    }
    return []
  } catch { return [] }
}

export function updateCompanyKeywords(id: string, keywords: string[]): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  const companies = getAllCompanySettings()
  const idx = companies.findIndex(c => c.id === id)
  if (idx >= 0) {
    companies[idx].keywords = keywords
  }
  const file = path.join(DATA_DIR, 'keyword-settings.json')
  fs.writeFileSync(file, JSON.stringify({ companies }, null, 2))
}

// =============================================
// 旧形式（後方互換）
// =============================================

export function getKeywordSettings(): KeywordSettings {
  const companies = getAllCompanySettings()
  if (companies.length === 0) return { locationName: '', keywords: [] }
  const first = companies[0]
  return {
    locationName:  first.locationName ?? first.id,
    keywords:      first.keywords,
    businessTitle: first.businessTitle,
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

// 会社 ID (フォルダ名) で月データを読み込む（GitHub Actions 保存形式）
export function loadMonthRankingsById(
  id: string,
  year: number,
  month: number,
): Record<number, DailyRankingEntry[]> {
  const dir = path.join(DATA_DIR, 'rankings', id)
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

// 旧形式（locationName ベース、後方互換）
export function loadMonthRankings(
  locationName: string,
  year: number,
  month: number,
): Record<number, DailyRankingEntry[]> {
  return loadMonthRankingsById(locationToId(locationName), year, month)
}
