'use client'

import { useState, useEffect } from 'react'
import { Star, MessageSquare, RefreshCw, Send, ThumbsUp } from 'lucide-react'
import { Review } from '@/types'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import Image from 'next/image'
import clsx from 'clsx'

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5
}

function StarRating({ rating }: { rating: string }) {
  const num = STAR_MAP[rating] ?? 0
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < num ? 'text-amber-400 fill-amber-400' : 'text-surface-200 fill-surface-200'}
        />
      ))}
    </div>
  )
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [locationName, setLocationName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const bizRes = await fetch('/api/business')
      const bizData = await bizRes.json()
      const locations = bizData.locations ?? []
      if (!locations.length) { setError('ロケーションが見つかりません'); return }

      const loc = locations[0]
      setLocationName(loc.name)

      const res = await fetch(`/api/reviews?location=${encodeURIComponent(loc.name)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      setReviews(data.reviews ?? [])
      setAvgRating(data.averageRating ?? 0)
      setTotalReviews(data.totalReviewCount ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'クチコミの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function submitReply(reviewName: string) {
    if (!replyText.trim()) return
    setSendingReply(true)
    try {
      const res = await fetch('/api/reviews/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewName, comment: replyText }),
      })
      if (!res.ok) throw new Error('返信の送信に失敗しました')
      setReplyingTo(null)
      setReplyText('')
      await fetchData() // 更新
    } catch (e) {
      alert(e instanceof Error ? e.message : '返信に失敗しました')
    } finally {
      setSendingReply(false)
    }
  }

  const ratingBreakdown = [5,4,3,2,1].map(star => {
    const count = reviews.filter(r => STAR_MAP[r.starRating] === star).length
    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0
    return { star, count, pct }
  })

  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <div>
        <h1 className="font-display text-2xl font-bold text-surface-900">クチコミ管理</h1>
        <p className="text-surface-500 text-sm mt-1">Googleマップのレビューを管理・返信</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* 評価サマリー */}
      {!loading && reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 平均評価 */}
          <div className="card flex items-center gap-6">
            <div className="text-center">
              <div className="font-display text-5xl font-bold text-surface-900 tabular-nums">
                {avgRating.toFixed(1)}
              </div>
              <div className="flex justify-center mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={18}
                    className={i < Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-surface-200 fill-surface-200'} />
                ))}
              </div>
              <div className="text-surface-500 text-sm mt-1">{totalReviews.toLocaleString()}件のレビュー</div>
            </div>

            {/* 星分布 */}
            <div className="flex-1 space-y-1.5">
              {ratingBreakdown.map(({ star, count, pct }) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-4 text-right text-surface-600 font-medium">{star}</span>
                  <Star size={12} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-surface-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-surface-400 tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 返信状況 */}
          <div className="card">
            <h3 className="font-bold text-surface-900 mb-3">返信状況</h3>
            <div className="space-y-3">
              {[
                { label: '返信済み', count: reviews.filter(r => r.reviewReply).length, color: 'bg-emerald-500' },
                { label: '未返信',   count: reviews.filter(r => !r.reviewReply).length, color: 'bg-rose-400' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-surface-700">{item.label}</span>
                  </div>
                  <span className="font-bold tabular-nums">{item.count}</span>
                </div>
              ))}
              <div className="mt-2 text-xs text-surface-400">
                返信率: {reviews.length > 0 ? Math.round(reviews.filter(r => r.reviewReply).length / reviews.length * 100) : 0}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* レビューリスト */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-surface-900">最近のレビュー</h2>
          <button onClick={fetchData} className="btn-secondary text-sm" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />更新
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card h-32 animate-pulse bg-surface-100" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="card text-center py-12 text-surface-400">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
            <p>レビューがありません</p>
          </div>
        ) : (
          reviews.map(review => (
            <div key={review.reviewId} className="card animate-slide-up">
              <div className="flex items-start gap-3">
                {/* アバター */}
                <div className="flex-shrink-0">
                  {review.reviewer.profilePhotoUrl ? (
                    <Image src={review.reviewer.profilePhotoUrl} alt="" width={40} height={40} className="rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-sm">
                      {review.reviewer.isAnonymous ? '?' : review.reviewer.displayName[0]}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-surface-900 text-sm">
                        {review.reviewer.isAnonymous ? '匿名ユーザー' : review.reviewer.displayName}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StarRating rating={review.starRating} />
                        <span className="text-xs text-surface-400">
                          {format(new Date(review.createTime), 'yyyy/MM/dd', { locale: ja })}
                        </span>
                      </div>
                    </div>
                    {!review.reviewReply && (
                      <span className="badge badge-red flex-shrink-0">未返信</span>
                    )}
                    {review.reviewReply && (
                      <span className="badge badge-green flex-shrink-0">返信済み</span>
                    )}
                  </div>

                  {review.comment && (
                    <p className="text-surface-700 text-sm mt-2 leading-relaxed">{review.comment}</p>
                  )}

                  {/* 返信表示 */}
                  {review.reviewReply && (
                    <div className="mt-3 p-3 rounded-lg bg-surface-50 border-l-2 border-brand-400">
                      <div className="text-xs font-medium text-brand-600 mb-1 flex items-center gap-1">
                        <ThumbsUp size={11} />オーナーからの返信
                      </div>
                      <p className="text-surface-700 text-sm">{review.reviewReply.comment}</p>
                    </div>
                  )}

                  {/* 返信フォーム */}
                  {replyingTo === review.reviewId ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="返信を入力..."
                        rows={3}
                        className="input resize-none text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitReply(review.name)}
                          disabled={sendingReply || !replyText.trim()}
                          className="btn-primary text-sm"
                        >
                          <Send size={13} />{sendingReply ? '送信中...' : '送信する'}
                        </button>
                        <button
                          onClick={() => { setReplyingTo(null); setReplyText('') }}
                          className="btn-secondary text-sm"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReplyingTo(review.reviewId)
                        setReplyText(review.reviewReply?.comment ?? '')
                      }}
                      className="mt-2 text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1 transition-colors"
                    >
                      <MessageSquare size={12} />
                      {review.reviewReply ? '返信を編集' : '返信する'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
