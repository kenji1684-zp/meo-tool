/**
 * キーワード順位自動チェック スタンドアロンスクリプト（複数社対応）
 *
 * 使い方:
 *   node scripts/check-rankings.mjs
 *
 * 必要な環境変数:
 *   GOOGLE_PLACES_API_KEY  (GitHub Secrets または .env.local から)
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
// キーワード設定の読み込み（複数社対応）
// ─────────────────────────────────────────────
function getSettings() {
  const file = path.join(DATA_DIR, 'keyword-settings.json')
  if (!fs.existsSync(file)) return []
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'))
    // 旧形式（単一オブジェクト）にも対応
    if (Array.isArray(raw)) return raw
    if (raw.companies) return raw.companies
    // 旧形式: { locationName, businessTitle, keywords }
    return [{
      id:            raw.locationName?.replace(/\//g, '_') ?? 'default',
      businessTitle: raw.businessTitle ?? raw.locationName ?? '',
      locationName:  raw.locationName ?? '',
      keywords:      raw.keywords ?? [],
    }]
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────
// 今日のデータが既にあるか確認
// ─────────────────────────────────────────────
function alreadyCheckedToday(companyId, dateStr) {
  const file = path.join(DATA_DIR, 'rankings', companyId, `${dateStr}.json`)
  return fs.existsSync(file)
}

// ─────────────────────────────────────────────
// 順位データの保存
// ─────────────────────────────────────────────
function saveRankings(companyId, dateStr, rankings) {
  const dir = path.join(DATA_DIR, 'rankings', companyId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${dateStr}.json`)
  fs.writeFileSync(file, JSON.stringify(rankings, null, 2))
  console.log(`  💾 保存: data/rankings/${companyId}/${dateStr}.json`)
}

// ─────────────────────────────────────────────
// Google Places API でキーワード順位を取得
// ─────────────────────────────────────────────
async function getKeywordRank(keyword, businessTitle, apiKey) {
  const url = 'https://places.googleapis.com/v1/places:searchText'
  const body = JSON.stringify({
    textQuery:    keyword,
    languageCode: 'ja',
    regionCode:   'JP',
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

  const data   = await res.json()
  const places = data.places ?? []

  // ビジネス名で部分一致検索
  const normalizedBiz = businessTitle.replace(/[（）()　\s株式会社有限会社]/g, '').toLowerCase()
  const idx = places.findIndex(p => {
    const name = (p.displayName?.text ?? '').replace(/[（）()　\s株式会社有限会社]/g, '').toLowerCase()
    return name.includes(normalizedBiz) || normalizedBiz.includes(name)
  })

  return idx === -1 ? null : idx + 1
}

// ─────────────────────────────────────────────
// 1社分の順位チェック
// ─────────────────────────────────────────────
async function checkCompany(company, dateStr, apiKey) {
  const { id, businessTitle, keywords } = company

  if (!id || !businessTitle || !keywords?.length) {
    console.log(`  ⚠️  設定不足のためスキップ: ${JSON.stringify(company)}`)
    return
  }

  if (alreadyCheckedToday(id, dateStr)) {
    console.log(`  ✅ 本日(${dateStr})のデータは取得済みのためスキップ`)
    return
  }

  console.log(`  🏪 ビジネス名: ${businessTitle}`)
  console.log(`  🔑 キーワード数: ${keywords.length}`)

  const rankings = []
  for (const keyword of keywords) {
    try {
      const rank = await getKeywordRank(keyword, businessTitle, apiKey)
      rankings.push({ keyword, rank })
      console.log(`    "${keyword}" → ${rank === null ? '圏外' : `${rank}位`}`)
      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.error(`    "${keyword}" エラー: ${err.message}`)
      rankings.push({ keyword, rank: null })
    }
  }

  saveRankings(id, dateStr, rankings)
  console.log(`  ✅ 完了: ${rankings.length}件保存`)
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

  const companies = getSettings()
  if (companies.length === 0) {
    console.error('❌ data/keyword-settings.json に会社設定がありません')
    process.exit(1)
  }

  // 日本時間で今日の日付
  const jstNow  = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const dateStr = jstNow.toISOString().slice(0, 10)

  console.log(`📅 チェック日: ${dateStr}`)
  console.log(`🏢 対象会社数: ${companies.length}社`)
  console.log('═══════════════════════════')

  for (const company of companies) {
    console.log(`\n▶ ${company.businessTitle ?? company.id}`)
    await checkCompany(company, dateStr, apiKey)
  }

  console.log('\n═══════════════════════════')
  console.log('✅ 全社チェック完了')
}

main().catch(err => {
  console.error('❌ 予期しないエラー:', err)
  process.exit(1)
})
