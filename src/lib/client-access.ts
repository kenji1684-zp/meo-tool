/**
 * クライアント向け閲覧専用URLの認証
 *
 * Vercel の環境変数 CLIENT_ACCESS に「会社ID:トークン」をカンマ区切りで登録する。
 *   例) CLIENT_ACCESS=ecolease:Xk3...q9,asteru:Pz8...m2
 *
 * 会社ID は data/keyword-settings.json の companies[].id と一致させる。
 * URL は https://<ドメイン>/c/<トークン> になる。
 * 解約・URL漏えい時は該当ペアを削除（または新トークンに差し替え）して再デプロイする。
 */

import crypto from 'crypto'
import { getAllCompanySettings, CompanySettings } from '@/lib/keyword-store'
import { listAccounts, listLocations } from '@/lib/gbp-client'

const MIN_TOKEN_LENGTH = 16

function parseClientAccess(): { id: string; token: string }[] {
  const raw = process.env.CLIENT_ACCESS ?? ''
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':')
      if (idx < 0) return null
      return { id: pair.slice(0, idx).trim(), token: pair.slice(idx + 1).trim() }
    })
    .filter((p): p is { id: string; token: string } => !!p && !!p.id && p.token.length >= MIN_TOKEN_LENGTH)
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

/** トークンから会社設定を取得（無効なら null） */
export function resolveClientByToken(token: string | undefined | null): CompanySettings | null {
  if (!token || token.length < MIN_TOKEN_LENGTH || token.length > 128) return null
  const entry = parseClientAccess().find((p) => safeEqual(p.token, token))
  if (!entry) return null
  return getAllCompanySettings().find((c) => c.id === entry.id) ?? null
}

// ---------------------------------------------
// 会社 → GBP ロケーションの解決（30分キャッシュ）
// ---------------------------------------------

const locationCache = new Map<string, { name: string; title: string; expiresAt: number }>()

/**
 * 会社設定に対応する GBP ロケーションを返す。
 * locationName が設定されていればそれを優先し、
 * 無ければ管理画面と同じく店舗名（title）の一致で探す。
 */
export async function resolveClientLocation(
  company: CompanySettings,
  adminToken: string,
): Promise<{ name: string; title: string } | null> {
  const cached = locationCache.get(company.id)
  if (cached && cached.expiresAt > Date.now()) return cached

  if (company.locationName) {
    const v = { name: company.locationName, title: company.businessTitle, expiresAt: Date.now() + 30 * 60_000 }
    locationCache.set(company.id, v)
    return v
  }

  const accounts = await listAccounts(adminToken)
  const all = (await Promise.all(accounts.map((a) => listLocations(adminToken, a.name)))).flat() as unknown as {
    name: string
    title?: string
  }[]

  const norm = (s: string) => s.replace(/[\s　]/g, '').replace(/[（(]株[）)]|株式会社/g, '')
  const target = norm(company.businessTitle)
  const hit =
    all.find((l) => l.title === company.businessTitle) ??
    all.find((l) => l.title && norm(l.title) === target) ??
    // 部分一致は名前の長さが最も近いものを採用（「渡辺塗料」と「渡辺塗料リフォーム」の取り違え防止）
    all
      .filter((l) => l.title && (norm(l.title).includes(target) || target.includes(norm(l.title))))
      .sort((a, b) => Math.abs(norm(a.title!).length - target.length) - Math.abs(norm(b.title!).length - target.length))[0]

  if (!hit) return null
  const v = { name: hit.name, title: hit.title ?? company.businessTitle, expiresAt: Date.now() + 30 * 60_000 }
  locationCache.set(company.id, v)
  return v
}
