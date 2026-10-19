/**
 * クライアント画面：最新情報（投稿）の一覧・作成
 * GET  /api/client/<token>/posts   … 最近の投稿（最大10件）
 * POST /api/client/<token>/posts   … multipart: summary, file(任意), ctaType(任意), ctaUrl(任意)
 *
 * ※ 投稿はすぐ Google に公開される（Google 側の審査で数分〜数時間「保留」になることはある）
 */

import { NextRequest, NextResponse } from 'next/server'
import { listLocalPosts, createLocalPost, CallToActionType } from '@/lib/gbp-client'
import {
  validateImage, putImageToBlob, checkDailyLimit, countDaily, resolveClientParent, friendlyError,
} from '@/lib/client-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SUMMARY_MAX = 1500
const CTA_TYPES: CallToActionType[] = ['LEARN_MORE', 'BOOK', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL']

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const r = await resolveClientParent(params.token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
    const posts = await listLocalPosts(r.accessToken, r.parent, 10)
    return NextResponse.json({
      posts: posts.map((p) => ({
        name: p.name,
        summary: p.summary,
        state: p.state,
        createTime: p.createTime,
        searchUrl: p.searchUrl,
        photo: p.media?.[0]?.googleUrl ?? p.media?.[0]?.sourceUrl,
      })),
    })
  } catch (err) {
    console.error('client posts GET error:', err)
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

  const summary = String(form.get('summary') ?? '').trim()
  if (!summary) return NextResponse.json({ error: '本文を入力してください' }, { status: 400 })
  if (summary.length > SUMMARY_MAX) {
    return NextResponse.json({ error: `本文は${SUMMARY_MAX}文字以内にしてください（現在${summary.length}文字）` }, { status: 400 })
  }

  const file = form.get('file')
  const hasFile = file instanceof File && file.size > 0
  if (hasFile) {
    const invalid = validateImage(file)
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  }

  const ctaTypeRaw = String(form.get('ctaType') ?? '')
  const ctaUrl = String(form.get('ctaUrl') ?? '').trim()
  let callToAction: { actionType: CallToActionType; url?: string } | undefined
  if ((CTA_TYPES as string[]).includes(ctaTypeRaw)) {
    const actionType = ctaTypeRaw as CallToActionType
    if (actionType === 'CALL') {
      callToAction = { actionType }
    } else {
      if (!/^https?:\/\/\S+$/.test(ctaUrl)) {
        return NextResponse.json({ error: 'ボタンのリンク先URLを http:// または https:// から入力してください' }, { status: 400 })
      }
      callToAction = { actionType, url: ctaUrl }
    }
  }

  try {
    const r = await resolveClientParent(params.token)
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })

    const limited = checkDailyLimit(r.company.id, 'post')
    if (limited) return NextResponse.json({ error: limited }, { status: 429 })

    const photoUrl = hasFile ? await putImageToBlob(file as File, r.company.id) : undefined
    const post = await createLocalPost(r.accessToken, r.parent, { summary, photoUrl, callToAction })
    countDaily(r.company.id, 'post')
    console.log(`[client-upload] post company=${r.company.id} post=${post.name}`)
    return NextResponse.json({ ok: true, searchUrl: post.searchUrl })
  } catch (err) {
    console.error('client posts POST error:', err)
    return NextResponse.json({ error: friendlyError(err) }, { status: 502 })
  }
}
