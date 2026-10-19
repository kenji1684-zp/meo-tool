/**
 * クライアント画面：写真の一覧・追加
 * GET  /api/client/<token>/media        … 最近の写真（最大30枚）
 * POST /api/client/<token>/media        … multipart: file, category, description
 *
 * ※ 追加した写真はすぐ Google に公開される。削除はクライアント画面からはできない（管理画面で対応）
 */

import { NextRequest, NextResponse } from 'next/server'
import { listMedia, createMediaFromUrl, MediaCategory } from '@/lib/gbp-client'
import {
  validateImage, putImageToBlob, checkDailyLimit, countDaily, resolveClientParent, friendlyError,
} from '@/lib/client-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// クライアントに選ばせるカテゴリ（カバー・ロゴ・プロフィールは見た目への影響が大きいので管理者のみ）
const CLIENT_CATEGORIES: MediaCategory[] = ['ADDITIONAL', 'EXTERIOR', 'INTERIOR', 'PRODUCT', 'AT_WORK', 'FOOD_AND_DRINK', 'MENU', 'TEAMS']

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await resolveClientParent(params.token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    const items = await listMedia(r.accessToken, r.parent, 30)
    return NextResponse.json({
      mediaItems: items.map((m) => ({
        name: m.name,
        thumbnailUrl: m.thumbnailUrl ?? m.googleUrl,
        createTime: m.createTime,
        category: m.locationAssociation?.category,
      })),
    })
  } catch (err) {
    console.error('client media GET error:', err)
    return NextResponse.json({ error: friendlyError(err) }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: '送信形式が正しくありません' }, { status: 400 })
  }

  const file = form.get('file')
  const invalid = validateImage(file)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const categoryRaw = String(form.get('category') ?? 'ADDITIONAL')
  const category = (CLIENT_CATEGORIES as string[]).includes(categoryRaw) ? (categoryRaw as MediaCategory) : 'ADDITIONAL'
  const description = String(form.get('description') ?? '').trim().slice(0, 200)

  try {
    const r = await resolveClientParent(params.token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })

    const limited = checkDailyLimit(r.company.id, 'photo')
    if (limited) return NextResponse.json({ error: limited }, { status: 429 })

    const url = await putImageToBlob(file as File, r.company.id)
    const item = await createMediaFromUrl(r.accessToken, r.parent, url, category, description || undefined)
    countDaily(r.company.id, 'photo')
    console.log(`[client-upload] photo company=${r.company.id} category=${category} media=${item.name}`)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('client media POST error:', err)
    return NextResponse.json({ error: friendlyError(err) }, { status: 502 })
  }
}
