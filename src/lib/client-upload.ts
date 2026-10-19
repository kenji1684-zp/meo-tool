/**
 * クライアント画面からの写真追加・投稿で共通の処理
 */

import { put } from '@vercel/blob'
import { getAdminAccessToken } from '@/lib/admin-token'
import { resolveClientByToken, resolveClientLocation } from '@/lib/client-access'
import { resolveLocationParent } from '@/lib/gbp-client'
import type { CompanySettings } from '@/lib/keyword-store'

// Googleの上限は5MB。Vercelのリクエスト上限(4.5MB)の方が厳しいので4MBで止める
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

/** 画像ファイルを検査。問題があればエラーメッセージを返す */
export function validateImage(file: unknown): string | null {
  if (!(file instanceof File)) return '画像が選択されていません'
  if (!ALLOWED_TYPES.includes(file.type)) return 'JPEG または PNG の画像を選んでください'
  if (file.size > MAX_IMAGE_BYTES) return `画像サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB / 上限4MB）`
  if (file.size < 10 * 1024) return '画像サイズが小さすぎます（10KB以上の画像を選んでください）'
  return null
}

/** Google は公開URLからしか画像を取り込めないため、Vercel Blob に公開保存してURLを返す */
export async function putImageToBlob(file: File, companyId: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Vercel Blob が未設定です')
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const blob = await put(`client-uploads/${companyId}/${Date.now()}.${ext}`, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: true,
  })
  return blob.url
}

// ---------------------------------------------
// 1社あたりの1日の上限（いたずら・誤操作の連投防止）
// ※ サーバーのメモリで数えるため厳密ではない（目安の歯止め）
// ---------------------------------------------
const DAILY_LIMIT = { photo: 20, post: 5 } as const
const counters = new Map<string, number>()

function limitKey(companyId: string, kind: keyof typeof DAILY_LIMIT) {
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })
  return `${kind}:${companyId}:${today}`
}

/** 上限に達していればエラーメッセージを返す */
export function checkDailyLimit(companyId: string, kind: keyof typeof DAILY_LIMIT): string | null {
  if ((counters.get(limitKey(companyId, kind)) ?? 0) >= DAILY_LIMIT[kind]) {
    return `本日の上限（${DAILY_LIMIT[kind]}件）に達しました。明日以降にお試しください。`
  }
  return null
}

/** 成功したときだけ数える */
export function countDaily(companyId: string, kind: keyof typeof DAILY_LIMIT) {
  const key = limitKey(companyId, kind)
  counters.set(key, (counters.get(key) ?? 0) + 1)
}

/** トークン → 会社 → GBP の parent（accounts/x/locations/y）まで解決 */
export async function resolveClientParent(
  token: string,
): Promise<{ company: CompanySettings; accessToken: string; parent: string } | { error: string; status: number }> {
  const company = resolveClientByToken(token)
  if (!company) return { error: 'Not found', status: 404 }
  const accessToken = await getAdminAccessToken()
  const location = await resolveClientLocation(company, accessToken)
  if (!location) return { error: 'Googleビジネスプロフィールの店舗が見つかりません。担当者にお問い合わせください。', status: 404 }
  const parent = await resolveLocationParent(accessToken, location.name)
  return { company, accessToken, parent }
}

/** Google API のエラーをクライアント向けの文章に変換 */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('429')) return 'Googleが混み合っています。少し時間をおいてお試しください。'
  if (msg.includes('Blob')) return '画像の保存先が未設定です。担当者にお問い合わせください。'
  if (msg.includes('400')) return 'Googleに受け付けられませんでした。画像や文章の内容をご確認ください。'
  return '送信に失敗しました。時間をおいて再度お試しください。'
}
