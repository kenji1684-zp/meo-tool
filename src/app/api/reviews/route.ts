import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listReviews } from '@/lib/gbp-client'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const locationName = searchParams.get('location')
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20')

  if (!locationName) {
    return NextResponse.json(
      { error: 'location parameter is required' },
      { status: 400 }
    )
  }

  if (DEMO_MODE || locationName.includes('demo')) {
    return NextResponse.json({
      reviews: [
        {
          reviewId: 'demo-review-1',
          reviewer: { displayName: '山田太郎' },
          starRating: 'FIVE',
          comment: '対応が非常に早く、丁寧でした。また利用したいと思います。',
          createTime: '2026-06-01T10:00:00Z',
          updateTime: '2026-06-01T10:00:00Z',
        },
        {
          reviewId: 'demo-review-2',
          reviewer: { displayName: '佐藤花子' },
          starRating: 'FOUR',
          comment: '電話対応がスムーズで安心して依頼できました。',
          createTime: '2026-06-03T14:30:00Z',
          updateTime: '2026-06-03T14:30:00Z',
        },
      ],
      averageRating: 4.5,
      totalReviewCount: 2,
    })
  }

  try {
    const data = await listReviews(session.accessToken, locationName, pageSize)
    return NextResponse.json(data)
  } catch (err) {
    console.error('reviews API error:', err)

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


