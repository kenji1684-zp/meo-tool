'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, Send, CheckCircle2, AlertCircle, X, ExternalLink, Loader2 } from 'lucide-react'

// =============================================
// 共通
// =============================================

/** スマホ写真（5〜10MB）でも送れるよう、長辺2048px・JPEGに縮小する */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('画像を読み込めませんでした（HEIC形式の場合はJPEGで保存し直してください）'))
    i.src = URL.createObjectURL(file)
  })
  const MAX = 2048
  const scale = Math.min(1, MAX / Math.max(img.width, img.height))
  // 小さすぎる画像は Google に拒否されるので警告
  if (Math.min(img.width, img.height) < 250) throw new Error('画像が小さすぎます（縦横250px以上の画像を選んでください）')
  if (scale === 1 && file.size < 3.5 * 1024 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/png')) return file

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob) throw new Error('画像の変換に失敗しました')
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

type Status = { kind: 'ok' | 'error'; text: string } | null

function StatusBox({ status, onClose }: { status: Status; onClose: () => void }) {
  if (!status) return null
  const ok = status.kind === 'ok'
  return (
    <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
      {ok ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" />}
      <span className="flex-1">{status.text}</span>
      <button onClick={onClose} aria-label="閉じる" className="opacity-60 hover:opacity-100"><X size={16} /></button>
    </div>
  )
}

function ImagePicker({ file, onChange, label }: { file: File | null; onChange: (f: File | null) => void; label: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/*" className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="選択した画像" className="max-h-64 rounded-xl border border-slate-200" />
          <button type="button" onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = '' }}
            className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow" aria-label="画像を外す"><X size={16} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-slate-200 hover:border-sky-400 hover:bg-sky-50 rounded-xl py-10 flex flex-col items-center gap-2 text-slate-500 transition-colors">
          <ImagePlus size={28} />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-slate-400">JPEG / PNG（スマホの写真もそのまま選べます）</span>
        </button>
      )}
    </div>
  )
}

function formatDate(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// =============================================
// 写真の追加
// =============================================

const PHOTO_CATEGORIES = [
  { value: 'ADDITIONAL', label: 'その他' },
  { value: 'EXTERIOR', label: '外観' },
  { value: 'INTERIOR', label: '店内・社内' },
  { value: 'PRODUCT', label: '商品・施工事例' },
  { value: 'AT_WORK', label: '作業風景' },
  { value: 'TEAMS', label: 'スタッフ' },
  { value: 'FOOD_AND_DRINK', label: '料理・ドリンク' },
  { value: 'MENU', label: 'メニュー' },
]

interface MediaRow { name: string; thumbnailUrl?: string; createTime?: string }

export function PhotoPanel({ token }: { token: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState('ADDITIONAL')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [items, setItems] = useState<MediaRow[] | null>(null)

  const load = useCallback(() => {
    fetch(`/api/client/${encodeURIComponent(token)}/media`).then((r) => r.json())
      .then((d) => setItems(d.mediaItems ?? [])).catch(() => setItems([]))
  }, [token])
  useEffect(load, [load])

  const submit = async () => {
    if (!file) return
    if (!confirm('この写真をGoogleビジネスプロフィールに公開します。よろしいですか？')) return
    setSending(true); setStatus(null)
    try {
      const fd = new FormData()
      fd.append('file', await compressImage(file))
      fd.append('category', category)
      const res = await fetch(`/api/client/${encodeURIComponent(token)}/media`, { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? '送信に失敗しました')
      setStatus({ kind: 'ok', text: '写真を追加しました。Googleマップに反映されるまで数分〜数時間かかることがあります。' })
      setFile(null)
      setTimeout(load, 3000)
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : '送信に失敗しました' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="font-bold text-slate-800">写真を追加</h2>
          <p className="text-xs text-slate-400 mt-1">Googleマップのお店の「写真」に追加されます。定期的に新しい写真を載せると、お店の様子が伝わりやすくなります。</p>
        </div>
        <ImagePicker file={file} onChange={setFile} label="写真を選ぶ" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">写真の種類</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input !w-auto">
              {PHOTO_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <button onClick={submit} disabled={!file || sending} className="btn-primary">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? '送信中…' : 'Googleに公開する'}
          </button>
        </div>
        <StatusBox status={status} onClose={() => setStatus(null)} />
        <p className="text-xs text-slate-400">※ 人の顔が写る写真は本人の了承を得てください。公開した写真の削除は担当者までご連絡ください。</p>
      </section>

      <section className="card">
        <h2 className="font-bold text-slate-800 mb-4">掲載中の写真</h2>
        {items == null ? (
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">まだ写真がありません</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            {items.map((m) => (
              <figure key={m.name} className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.thumbnailUrl && <img src={m.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />}
                <figcaption className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[10px] px-1.5 py-0.5">{formatDate(m.createTime)}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// =============================================
// 最新情報の投稿
// =============================================

const CTA_OPTIONS = [
  { value: '', label: 'ボタンなし' },
  { value: 'LEARN_MORE', label: '詳細' },
  { value: 'BOOK', label: '予約' },
  { value: 'ORDER', label: 'オンライン注文' },
  { value: 'SHOP', label: '購入' },
  { value: 'SIGN_UP', label: '登録' },
  { value: 'CALL', label: '今すぐ電話' },
]

const STATE_LABEL: Record<string, string> = { LIVE: '公開中', PROCESSING: '審査中', REJECTED: '却下' }

interface PostRow { name: string; summary?: string; state?: string; createTime?: string; searchUrl?: string; photo?: string }

export function PostPanel({ token }: { token: string }) {
  const [summary, setSummary] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [ctaType, setCtaType] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [posts, setPosts] = useState<PostRow[] | null>(null)

  const load = useCallback(() => {
    fetch(`/api/client/${encodeURIComponent(token)}/posts`).then((r) => r.json())
      .then((d) => setPosts(d.posts ?? [])).catch(() => setPosts([]))
  }, [token])
  useEffect(load, [load])

  const needsUrl = ctaType !== '' && ctaType !== 'CALL'

  const submit = async () => {
    if (!summary.trim()) return
    if (!confirm('この内容をGoogleビジネスプロフィールの「最新情報」に公開します。よろしいですか？')) return
    setSending(true); setStatus(null)
    try {
      const fd = new FormData()
      fd.append('summary', summary.trim())
      if (file) fd.append('file', await compressImage(file))
      if (ctaType) { fd.append('ctaType', ctaType); fd.append('ctaUrl', ctaUrl) }
      const res = await fetch(`/api/client/${encodeURIComponent(token)}/posts`, { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? '送信に失敗しました')
      setStatus({ kind: 'ok', text: '投稿しました。Googleの確認後に表示されます（通常数分、長いと数時間）。' })
      setSummary(''); setFile(null); setCtaType(''); setCtaUrl('')
      setTimeout(load, 3000)
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : '送信に失敗しました' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <div>
          <h2 className="font-bold text-slate-800">最新情報を投稿</h2>
          <p className="text-xs text-slate-400 mt-1">お知らせ・キャンペーン・施工事例などを、Googleマップのお店のページに掲載します。週1回程度の投稿がおすすめです。</p>
        </div>
        <label className="block text-sm">
          <span className="block text-slate-500 mb-1">本文 <span className="text-rose-500">*</span></span>
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={6} maxLength={1500}
            placeholder={'例）10月限定！エアコンリースのご相談で、設置前点検を無料で実施しています。\nお気軽にお問い合わせください。'}
            className="input resize-y" />
          <span className={`block text-right text-xs mt-1 ${summary.length > 1400 ? 'text-rose-500' : 'text-slate-400'}`}>{summary.length} / 1500</span>
        </label>
        <div>
          <span className="block text-sm text-slate-500 mb-1">写真（任意・あると目に留まりやすくなります）</span>
          <ImagePicker file={file} onChange={setFile} label="写真を選ぶ" />
        </div>
        <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-end">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">ボタン（任意）</span>
            <select value={ctaType} onChange={(e) => setCtaType(e.target.value)} className="input !w-auto">
              {CTA_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          {needsUrl && (
            <label className="text-sm">
              <span className="block text-slate-500 mb-1">ボタンのリンク先URL</span>
              <input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" className="input" inputMode="url" />
            </label>
          )}
        </div>
        <div className="flex justify-end">
          <button onClick={submit} disabled={!summary.trim() || (needsUrl && !ctaUrl) || sending} className="btn-primary">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? '送信中…' : 'Googleに投稿する'}
          </button>
        </div>
        <StatusBox status={status} onClose={() => setStatus(null)} />
        <p className="text-xs text-slate-400">※ 電話番号やURLを本文に書くと、Googleに却下されることがあります（ボタン機能をご利用ください）。投稿の削除は担当者までご連絡ください。</p>
      </section>

      <section className="card">
        <h2 className="font-bold text-slate-800 mb-4">これまでの投稿</h2>
        {posts == null ? (
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" />
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">まだ投稿がありません</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {posts.map((p) => (
              <li key={p.name} className="py-3 flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.photo ? <img src={p.photo} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" /> : <div className="w-16 h-16 rounded-lg bg-slate-100 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatDate(p.createTime)}</span>
                    {p.state && <span className={p.state === 'LIVE' ? 'badge-green' : p.state === 'REJECTED' ? 'badge-red' : 'badge-yellow'}>{STATE_LABEL[p.state] ?? p.state}</span>}
                    {p.searchUrl && <a href={p.searchUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-600 hover:underline">Googleで見る<ExternalLink size={11} /></a>}
                  </div>
                  <p className="text-sm text-slate-700 mt-1 line-clamp-3 whitespace-pre-wrap">{p.summary}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
