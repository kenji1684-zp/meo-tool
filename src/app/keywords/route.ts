import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DEMO_KEYWORDS } from '@/lib/demo-data'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      locationName: '株式会社ZEROPLUS（徳島本店）',
      rankings: DEMO_KEYWORDS,
      checkedAt: new Date().toISOString(),
      demo: true,
    })
  }

  return NextResponse.json({ error: 'API申請審査中です' }, { status: 503 })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  return NextResponse.json({ success: true, ...body })
}
