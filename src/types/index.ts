// =============================================
// Google Business Profile 関連の型定義
// =============================================

export interface GBPLocation {
  name: string          // "accounts/{accountId}/locations/{locationId}"
  locationName: string  // 店舗名
  primaryCategory?: { displayName: string }
  address?: {
    addressLines: string[]
    locality: string
    administrativeArea: string
  }
  websiteUri?: string
  primaryPhone?: string
  regularHours?: BusinessHours
  metadata?: {
    mapsUri?: string
    newReviewUri?: string
  }
}

export interface BusinessHours {
  periods: {
    openDay: string
    openTime: string
    closeDay: string
    closeTime: string
  }[]
}

// =============================================
// パフォーマンスデータの型定義
// =============================================

export type MetricType =
  | 'QUERIES_DIRECT'
  | 'QUERIES_INDIRECT'
  | 'QUERIES_CHAIN'
  | 'VIEWS_MAPS'
  | 'VIEWS_SEARCH'
  | 'ACTIONS_WEBSITE'
  | 'ACTIONS_PHONE'
  | 'ACTIONS_DRIVING_DIRECTIONS'
  | 'PHOTOS_VIEWS_MERCHANT'
  | 'PHOTOS_COUNT_MERCHANT'

export interface DailyMetricTimeSeries {
  dailyMetric: MetricType
  dailySubEntityType?: string
  timeSeries: {
    datedValues: {
      date: { year: number; month: number; day: number }
      value?: string
    }[]
  }
}

export interface PerformanceData {
  metric: MetricType
  label: string
  color: string
  total: number
  data: { date: string; value: number }[]
}

export interface PerformanceSummary {
  period: string
  metrics: PerformanceData[]
  totalSearchViews: number
  totalMapViews: number
  totalWebsiteClicks: number
  totalCallClicks: number
  totalDirectionRequests: number
}

// =============================================
// キーワード順位の型定義
// =============================================

export interface KeywordRanking {
  keyword: string
  currentRank: number | null
  previousRank: number | null
  change: number | null
  searchVolume?: number
  lastChecked: string
  locationId: string
}

export interface KeywordRankingHistory {
  keyword: string
  history: {
    date: string
    rank: number | null
  }[]
}

// =============================================
// レビューの型定義
// =============================================

export interface Review {
  name: string
  reviewId: string
  reviewer: {
    profilePhotoUrl?: string
    displayName: string
    isAnonymous: boolean
  }
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment?: string
  createTime: string
  updateTime: string
  reviewReply?: {
    comment: string
    updateTime: string
  }
}

// =============================================
// ダッシュボード全体のサマリー
// =============================================

export interface DashboardSummary {
  location: GBPLocation
  performance: PerformanceSummary
  recentReviews: Review[]
  averageRating: number
  totalReviews: number
  keywordRankings: KeywordRanking[]
}
