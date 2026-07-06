import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DEMO_KEYWORDS } from '@/lib/demo-data'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      locationName: '株式会社ZEROPLUS�E�徳島本店！E,
      rankings: DEMO_KEYWORDS,
      checkedAt: new Date().toISOString(),
      demo: true,
    })
  }

  return NextResponse.json({ error: 'API申請審査中でぁE }, { status: 503 })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  return NextResponse.json({ success: true, ...body })
}
