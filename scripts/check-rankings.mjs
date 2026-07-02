/**
 * キーワード順位自動チェック スタンドアロンスクリプト
 *
 * 使い方:
 *   node scripts/check-rankings.mjs
 *
 * 必要な環境変数:
 *   GOOGLE_PLACES_API_KEY  (GitHub Secrets または .env.local から)
 *
 * GitHub Actions から毎日 AM9:00 JST に自動実行される。
 * Next.js サーバーが起動していなくても動作する。
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR  = path.join(__dirname, '..')
const DATA_DIR  = path.join(ROOT_DIR, 'data')

// ─────────────────────────────────────────────
// .env.local の読み込み（ローカル実行時用）
// ─────────────────────────────────────────────
function loadEnv() {
  const envFile = path.join(ROOT_DIR, '.env.local')
  if (!fs.existsSync(envFile)) return
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

// ─────────────────────────────────────────────
// キーワード設定の読み込み
// ─────────────────────────────────────────────
function getSettings() {
  const file = path.join(DATA_DIR, 'keyword-settings.json')
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────
// 今日のデータが既にあるか確認
// ─────────────────────────────────────────────
function alreadyCheckedToday(locationName, dateStr) {
  const id   = locationName.replace(/\//g, '_')
  const file = path.join(DATA_DIR, 'rankings', id, `${dateStr}.json`)
  return fs.existsSync(file)
}

// ─────────────────────────────────────────────
// 順位データの保存
// ─────────────────────────────────────────────
function saveRankings(locationName, dateStr, rankings) {
  const id  = locationName.replace(/\//g, '_')
  const dir = path.join(DATA_DIR, 'rankings', id)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${dateStr}.json`)
  fs.writeFileSync(file, JSON.stringify(rankings, null, 2))
  console.log(`💾 保存: ${file}`)
}

// ─────────────────────────────────────────────
// Google Places API でキーワード順位を取得
// ─────────────────────────────────────────────
async function getKeywordRank(keyword, businessName, apiKey) {
  // Places API v1 Text Search
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const body = JSON.stringify({
    textQuery:   keyword,
    languageCode: 'ja',
    regionCode:  'JP',
    maxResultCount: 20,
  })

  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'X-Goog-Api-Key':   apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.id',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Places API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  const places = data.places ?? []

  // ビジネス名で部分一致検索
  const normalizedBiz = businessName.replace(/[（）()　\s]/g, '').toLowerCase()
  const idx = places.findIndex(p => {
    const name = (p.displayName?.text ?? '').replace(/[（）()　\s]/g, '').toLowerCase()
    return name.includes(normalizedBiz) || normalizedBiz.includes(name)
  })

  return idx === -1 ? null : idx + 1  // 1始まり、見つからなければ null（圏外）
}

// ─────────────────────────────────────────────
// ビジネス名をロケーション名から取得
// （例: "accounts/123/locations/456" → settings に title がなければ locationName そのまま）
// ─────────────────────────────────────────────
function getBusinessTitle(settings) {
  return settings.businessTitle ?? settings.locationName
}

// ─────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────
async function main() {
  loadEnv()

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error('❌ GOOGLE_PLACES_API_KEY が設定されていません')
    process.exit(1)
  }

  const settings = getSettings()
  if (!settings || !settings.locationName || !settings.keywords?.length) {
    console.error('❌ data/keyword-settings.json が見つからないか設定が空です')
    process.exit(1)
  }

  // 日本時間で今日の日付を取得
  const jstNow  = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const dateStr = jstNow.toISOString().slice(0, 10) // "YYYY-MM-DD"

  console.log(`📅 チェック日: ${dateStr}`)
  console.log(`📍 ロケーション: ${settings.locationName}`)
  console.log(`🔑 キーワード数: ${settings.keywords.length}`)

  // 今日のデータが既にある場合はスキップ
  if (alreadyCheckedToday(settings.locationName, dateStr)) {
    console.log(`✅ 本日(${dateStr})のデータは取得済みのためスキップ`)
    process.exit(0)
  }

  const businessTitle = getBusinessTitle(settings)
  console.log(`🏪 ビジネス名: ${businessTitle}`)
  console.log('---')

  const rankings = []
  for (const keyword of settings.keywords) {
    try {
      const rank = await getKeywordRank(keyword, businessTitle, apiKey)
      rankings.push({ keyword, rank })
      console.log(`  "${keyword}" → ${rank === null ? '圏外' : `${rank}位`}`)
      // API レート制限を避けるため少し待機
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error(`  "${keyword}" エラー: ${err.message}`)
      rankings.push({ keyword, rank: null })
    }
  }

  saveRankings(settings.locationName, dateStr, rankings)
  console.log('---')
  console.log(`✅ 完了: ${rankings.length}件のキーワード順位を保存しました`)
}

main().catch(err => {
  console.error('❌ 予期しないエラー:', err)
  process.exit(1)
})
