import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { replyToReview } from '@/lib/gbp-client'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { reviewName, comment } = await req.json()

  if (!reviewName || !comment) {
    return NextResponse.json({ error: 'reviewName and comment are required' }, { status: 400 })
  }

  try {
    await replyToReview(session.accessToken, reviewName, comment)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('reply API error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
