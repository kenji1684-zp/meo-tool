import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAdminAccessToken } from '@/lib/admin-token'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'
import {
  listMedia,
  createMediaFromUrl,
  deleteMedia,
  resolveLocationParent,
  MediaCategory,
} from '@/lib/gbp-client'

export const runtime = 'nodejs'
export const maxDuration = 60

// Googleの上限は5MB。Vercelのリクエスト上限(4.5MB)の方が厳しいので4MBで止める
const MAX_BYTES = 4 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

const VALID_CATEGORIES: MediaCategory[] = [
  'COVER', 'PROFILE', 'LOGO', 'EXTERIOR', 'INTERIOR', 'PRODUCT', 'AT_WORK',
  'FOOD_AND_DRINK', 'MENU', 'COMMON_AREA', 'ROOMS', 'TEAMS', 'ADDITIONAL',
]

function errorResponse(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback
  console.error('media API error:', err)
  return NextResponse.json({ error: message }, { status: 500 })
}

// ---- 写真一覧 ----
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const locationName = new URL(req.url).searchParams.get('location')
  if (!locationName) {
    return NextResponse.json({ error: 'location parameter is required' }, { status: 400 })
  }

  try {
    const accessToken = await getAdminAccessToken()
    const parent = await resolveLocationParent(accessToken, locationName)
    const mediaItems = await listMedia(accessToken, parent)
    return NextResponse.json({ parent, mediaItems })
  } catch (err) {
    return errorResponse(err, '写真の取得に失敗しました')
  }
}

// ---- 写真アップロード ----
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'multipart/form-data で送信してください' }, { status: 400 })
  }

  const file = form.get('file')
  const locationName = String(form.get('location') ?? '')
  const categoryRaw = String(form.get('category') ?? 'ADDITIONAL')
  const description = String(form.get('description') ?? '').trim()
  const sourceUrlInput = String(form.get('sourceUrl') ?? '').trim()

  if (!locationName) {
    return NextResponse.json({ error: 'location が指定されていません' }, { status: 400 })
  }

  const category = (VALID_CATEGORIES as string[]).includes(categoryRaw)
    ? (categoryRaw as MediaCategory)
    : 'ADDITIONAL'

  // ---- 公開URLを直接指定するモード ----
  if (!file && sourceUrlInput) {
    if (!/^https:\/\//.test(sourceUrlInput)) {
      return NextResponse.json({ error: '画像URLは https:// で始まる必要があります' }, { status: 400 })
    }
    try {
      const accessToken = await getAdminAccessToken()
      const parent = await resolveLocationParent(accessToken, locationName)
      const mediaItem = await createMediaFromUrl(
        accessToken, parent, sourceUrlInput, category, description || undefined
      )
      return NextResponse.json({ mediaItem })
    } catch (err) {
      return errorResponse(err, '写真のアップロードに失敗しました')
    }
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file が指定されていません' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'JPEGまたはPNGの画像を指定してください' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `画像サイズが大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB / 上限4MB）` },
      { status: 400 }
    )
  }
  if (file.size < 10 * 1024) {
    return NextResponse.json({ error: '画像サイズが小さすぎます（10KB以上）' }, { status: 400 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: 'Vercel Blobが未設定です。Vercelの Storage で Blob ストアを作成し、meo-tool プロジェクトに接続してください。' },
      { status: 500 }
    )
  }

  try {
    const accessToken = await getAdminAccessToken()
    const parent = await resolveLocationParent(accessToken, locationName)

    // Googleは公開URLからしか画像を取り込めない（バイト送信はGoogle側のバグ）ため、
    // 一旦 Vercel Blob に公開保存してそのURLを渡す
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const blob = await put(`gbp-media/${Date.now()}.${ext}`, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true,
    })

    const mediaItem = await createMediaFromUrl(
      accessToken, parent, blob.url, category, description || undefined
    )

    // Blob は削除しない：Googleが後から画像を取得し直す場合に備えるため。
    // 溜まってきたら Vercel の Storage 画面から古いものを消してください。
    return NextResponse.json({ mediaItem, blobUrl: blob.url })
  } catch (err) {
    return errorResponse(err, '写真のアップロードに失敗しました')
  }
}

// ---- 写真削除 ----
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const name = new URL(req.url).searchParams.get('name')
  if (!name || !name.includes('/media/')) {
    return NextResponse.json({ error: 'name parameter が不正です' }, { status: 400 })
  }

  try {
    const accessToken = await getAdminAccessToken()
    await deleteMedia(accessToken, name)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorResponse(err, '写真の削除に失敗しました')
  }
}
