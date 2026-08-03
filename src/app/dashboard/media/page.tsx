'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, Trash2, RefreshCw, AlertTriangle, ImageIcon } from 'lucide-react'

// =============================================
// 型・定数
// =============================================

interface MediaItem {
  name: string
  mediaFormat?: string
  googleUrl?: string
  thumbnailUrl?: string
  createTime?: string
  description?: string
  locationAssociation?: { category?: string }
  dimensions?: { widthPixels?: number; heightPixels?: number }
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'ADDITIONAL',     label: 'その他の写真' },
  { value: 'EXTERIOR',       label: '外観' },
  { value: 'INTERIOR',       label: '内観' },
  { value: 'PRODUCT',        label: '商品' },
  { value: 'AT_WORK',        label: '作業中' },
  { value: 'FOOD_AND_DRINK', label: '料理・ドリンク' },
  { value: 'MENU',           label: 'メニュー' },
  { value: 'COMMON_AREA',    label: '共用エリア' },
  { value: 'TEAMS',          label: 'チーム' },
]

const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries(CATEGORIES.map(c => [c.value, c.label])),
  COVER:   'カバー写真',
  PROFILE: 'プロフィール写真',
  LOGO:    'ロゴ',
  ROOMS:   '客室',
}

// 長辺をこのサイズに収めてから送る（Vercelの4.5MB制限対策）
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.85

// =============================================
// 画像リサイズ（ブラウザ側）
// =============================================

async function resizeImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width  = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像の変換に失敗しました')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  )
  if (!blob) throw new Error('画像の変換に失敗しました')
  return { blob, width, height }
}

// =============================================
// メインコンポーネント
// =============================================

export default function MediaPage() {
  const [locations, setLocations] = useState<{ name: string; title: string }[]>([])
  const [locationName, setLocationName] = useState('')
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [category, setCategory] = useState('ADDITIONAL')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmUpload, setConfirmUpload] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ---- 店舗一覧 ----
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/business')
        const data = await res.json()
        const list = (data.locations ?? []) as { name: string; title: string }[]
        setLocations(list)
        if (list.length) setLocationName(list[0].name)
      } catch {
        setError('店舗一覧の取得に失敗しました')
      }
    })()
  }, [])

  // ---- 写真一覧 ----
  const fetchMedia = useCallback(async () => {
    if (!locationName) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/media?location=${encodeURIComponent(locationName)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setItems(data.mediaItems ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '写真の取得に失敗しました')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [locationName])

  useEffect(() => { fetchMedia() }, [fetchMedia])

  // ---- ファイル選択 ----
  function handleFileChange(f: File | null) {
    setError(null)
    setNotice(null)
    if (!f) { setFile(null); setPreview(null); return }
    if (!['image/jpeg', 'image/png'].includes(f.type)) {
      setError('JPEGまたはPNGの画像を選んでください')
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  // ---- アップロード実行 ----
  async function doUpload() {
    if (!file || !locationName) return
    setConfirmUpload(false)
    setUploading(true)
    setError(null)
    setNotice(null)
    try {
      const { blob, width, height } = await resizeImage(file)
      if (Math.min(width, height) < 250) {
        throw new Error('画像が小さすぎます（250×250px以上が必要です）')
      }

      const form = new FormData()
      form.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }))
      form.append('location', locationName)
      form.append('category', category)
      if (description.trim()) form.append('description', description.trim())

      const res = await fetch('/api/media', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'アップロードに失敗しました')

      setNotice('写真を追加しました。Googleマップへの反映には数分かかることがあります。')
      handleFileChange(null)
      setDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchMedia()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'アップロードに失敗しました')
    } finally {
      setUploading(false)
    }
  }

  // ---- 削除 ----
  async function doDelete(name: string) {
    setDeleting(null)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/media?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? '削除に失敗しました')
      setNotice('写真を削除しました。')
      setItems(prev => prev.filter(i => i.name !== name))
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  const currentTitle = locations.find(l => l.name === locationName)?.title ?? ''

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">写真管理</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Googleビジネスプロフィールの写真を追加・削除します
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input max-w-xs"
            value={locationName}
            onChange={e => setLocationName(e.target.value)}
          >
            {locations.map(l => (
              <option key={l.name} value={l.name}>{l.title}</option>
            ))}
          </select>
          <button onClick={fetchMedia} disabled={loading} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            更新
          </button>
        </div>
      </div>

      {error && (
        <div className="card border border-red-200 bg-red-50 text-sm text-red-700">
          <span className="font-medium">エラー:</span> {error}
        </div>
      )}
      {notice && (
        <div className="card border border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {/* アップロード */}
      <div className="card space-y-4">
        <h2 className="font-bold text-surface-900">写真を追加</h2>

        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            アップロードすると<strong>すぐにGoogleマップ上に公開されます</strong>（下書き保存はできません）。
            JPEG / PNG、250×250px以上。長辺{MAX_EDGE}pxに自動縮小して送信します。
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">画像ファイル</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">写真の種別</label>
              <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">説明（任意）</label>
              <input
                className="input"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="例: 店舗外観（2026年8月撮影）"
              />
            </div>

            <button
              onClick={() => setConfirmUpload(true)}
              disabled={!file || !locationName || uploading}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading
                ? <><RefreshCw size={14} className="animate-spin" />アップロード中...</>
                : <><Upload size={14} />この写真を公開する</>}
            </button>
          </div>

          <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 min-h-[180px] overflow-hidden">
            {preview
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview} alt="プレビュー" className="max-h-56 object-contain" />
              : <span className="text-xs text-gray-400">プレビュー</span>}
          </div>
        </div>
      </div>

      {/* 既存の写真 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-surface-900">
            登録済みの写真
            {items.length > 0 && <span className="ml-2 text-xs font-normal text-gray-500">{items.length}件</span>}
          </h2>
          {currentTitle && <span className="text-xs text-gray-500">{currentTitle}</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm gap-2">
            <ImageIcon size={24} />
            登録されている写真はありません
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map(item => (
              <div key={item.name} className="group relative overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailUrl ?? item.googleUrl ?? ''}
                  alt={item.description ?? '写真'}
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[11px] text-white">
                  {CATEGORY_LABELS[item.locationAssociation?.category ?? ''] ?? 'その他'}
                  {item.createTime && (
                    <span className="ml-1 opacity-70">
                      {item.createTime.slice(0, 10).replace(/-/g, '/')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setDeleting(item.name)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-red-600 opacity-0 transition group-hover:opacity-100 hover:bg-white"
                  title="この写真を削除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* アップロード確認 */}
      {confirmUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm space-y-4">
            <h3 className="font-bold text-surface-900">この写真を公開しますか？</h3>
            <p className="text-sm text-gray-600">
              {currentTitle} のプロフィールに
              「{CATEGORY_LABELS[category]}」として追加され、すぐにGoogleマップ上に公開されます。
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmUpload(false)} className="btn-secondary">キャンセル</button>
              <button onClick={doUpload} className="btn-primary">公開する</button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認 */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm space-y-4">
            <h3 className="font-bold text-surface-900">この写真を削除しますか？</h3>
            <p className="text-sm text-gray-600">
              Googleビジネスプロフィールから削除されます。この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="btn-secondary">キャンセル</button>
              <button
                onClick={() => doDelete(deleting)}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
