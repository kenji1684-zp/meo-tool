import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getAdminAccessToken } from '@/lib/admin-token'
import { authOptions } from '@/lib/auth'
import { listReviews } from '@/lib/gbp-client'
import { DEMO_REVIEWS, DEMO_AVG_RATING, DEMO_TOTAL_REVIEWS } from '@/lib/demo-data'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      reviews: DEMO_REVIEWS,
      averageRating: DEMO_AVG_RATING,
      totalReviewCount: DEMO_TOTAL_REVIEWS,
      demo: true,
    })
  }

  const { searchParams } = new URL(req.url)
  const locationName = searchParams.get('location')
  if (!locationName) {
    return NextResponse.json({ error: 'location parameter is required' }, { status: 400 })
  }

  const adminToken = adminToken
  try {
    const data = await listReviews(adminToken, locationName)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
