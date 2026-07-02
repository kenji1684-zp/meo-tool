/**
 * デモモード用サンプルデータ
 * Google API申請審査中に全機能を確認できます
 */

import { GBPLocation, PerformanceData, KeywordRanking, Review } from '@/types'

export const DEMO_LOCATION: GBPLocation = {
  name: 'accounts/123456789/locations/987654321',
  locationName: '株式会社ZEROPLUS（徳島本店）',
  primaryCategory: { displayName: 'ITコンサルティング会社' },
  address: {
    addressLines: ['徳島市○○町1-2-3'],
    locality: '徳島市',
    administrativeArea: '徳島県',
  },
  websiteUri: 'https://zeroplus.co.jp',
  primaryPhone: '088-000-0000',
}

// 過去30日分の日別データを生成
function generateDailyData(base: number, variance: number, days = 30) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (days - 1 - i))
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const value = Math.max(0, Math.round(base + (Math.random() - 0.5) * variance))
    return { date: `${y}/${m}/${d}`, value }
  })
}

export const DEMO_PERFORMANCE: PerformanceData[] = [
  {
    metric: 'VIEWS_SEARCH',
    label: '検索表示',
    color: '#0ea5e9',
    total: 4823,
    data: generateDailyData(160, 80),
  },
  {
    metric: 'VIEWS_MAPS',
    label: 'マップ表示',
    color: '#f59e0b',
    total: 2341,
    data: generateDailyData(78, 40),
  },
  {
    metric: 'ACTIONS_WEBSITE',
    label: 'WEBクリック',
    color: '#10b981',
    total: 892,
    data: generateDailyData(30, 20),
  },
  {
    metric: 'ACTIONS_PHONE',
    label: '電話クリック',
    color: '#ef4444',
    total: 234,
    data: generateDailyData(8, 6),
  },
  {
    metric: 'ACTIONS_DRIVING_DIRECTIONS',
    label: '道順リクエスト',
    color: '#f97316',
    total: 178,
    data: generateDailyData(6, 4),
  },
  {
    metric: 'QUERIES_DIRECT',
    label: 'ダイレクト検索',
    color: '#8b5cf6',
    total: 1205,
    data: generateDailyData(40, 20),
  },
  {
    metric: 'QUERIES_INDIRECT',
    label: '間接検索',
    color: '#06b6d4',
    total: 3618,
    data: generateDailyData(120, 60),
  },
]

export const DEMO_SUMMARY = {
  totalSearchViews: 4823,
  totalMapViews: 2341,
  totalWebsiteClicks: 892,
  totalCallClicks: 234,
  totalDirectionRequests: 178,
  totalDirectQueries: 1205,
  totalIndirectQueries: 3618,
}

export const DEMO_KEYWORDS: KeywordRanking[] = [
  { keyword: 'ITコンサルティング 徳島', currentRank: 1,  previousRank: 2,  change: 1,  lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'ホームページ制作 徳島',   currentRank: 3,  previousRank: 3,  change: 0,  lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'SEO対策 徳島',           currentRank: 5,  previousRank: 8,  change: 3,  lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'MEO対策 徳島',           currentRank: 2,  previousRank: 1,  change: -1, lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'Web制作会社 徳島',        currentRank: 7,  previousRank: 5,  change: -2, lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'システム開発 徳島',       currentRank: 4,  previousRank: 6,  change: 2,  lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'マーケティング 徳島',     currentRank: 12, previousRank: 15, change: 3,  lastChecked: new Date().toISOString(), locationId: 'demo' },
  { keyword: 'DX支援 徳島',            currentRank: null, previousRank: null, change: null, lastChecked: new Date().toISOString(), locationId: 'demo' },
]

export const DEMO_REVIEWS: Review[] = [
  {
    name: 'accounts/123/locations/456/reviews/001',
    reviewId: '001',
    reviewer: { displayName: '田中 太郎', isAnonymous: false },
    starRating: 'FIVE',
    comment: 'とても丁寧なサポートで、ホームページのリニューアルがスムーズに進みました。デザインも想像以上の仕上がりで大満足です。また機会があればお願いしたいと思います。',
    createTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updateTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reviewReply: {
      comment: 'ありがとうございます！今後ともよろしくお願いいたします。',
      updateTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    name: 'accounts/123/locations/456/reviews/002',
    reviewId: '002',
    reviewer: { displayName: '山田 花子', isAnonymous: false },
    starRating: 'FIVE',
    comment: 'MEO対策をお願いしたところ、1ヶ月で検索順位が大幅に改善しました。担当者の方の説明も分かりやすく、安心してお任せできました。',
    createTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updateTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    name: 'accounts/123/locations/456/reviews/003',
    reviewId: '003',
    reviewer: { displayName: '佐藤 次郎', isAnonymous: false },
    starRating: 'FOUR',
    comment: 'システム開発の対応が早く、要望通りのものを作っていただきました。コスパも良く満足しています。',
    createTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    updateTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    reviewReply: {
      comment: 'ご利用いただきありがとうございました！引き続きサポートいたします。',
      updateTime: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    name: 'accounts/123/locations/456/reviews/004',
    reviewId: '004',
    reviewer: { displayName: '鈴木 美咲', isAnonymous: false },
    starRating: 'FIVE',
    comment: 'Googleビジネスプロフィールの設定から運用まで全てサポートしていただき、集客が改善しました。',
    createTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    updateTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    name: 'accounts/123/locations/456/reviews/005',
    reviewId: '005',
    reviewer: { displayName: '匿名ユーザー', isAnonymous: true },
    starRating: 'THREE',
    comment: '対応は良かったですが、納期が少し遅れました。品質は満足しています。',
    createTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updateTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export const DEMO_AVG_RATING = 4.4
export const DEMO_TOTAL_REVIEWS = 47
