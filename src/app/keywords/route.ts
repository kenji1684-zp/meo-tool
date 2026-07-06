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
      locationName: '譬ｪ蠑丈ｼ夂､ｾZEROPLUS・亥ｾｳ蟲ｶ譛ｬ蠎暦ｼ・,
      rankings: DEMO_KEYWORDS,
      checkedAt: new Date().toISOString(),
      demo: true,
    })
  }

  return NextResponse.json({ error: 'API逕ｳ隲句ｯｩ譟ｻ荳ｭ縺ｧ縺・ }, { status: 503 })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json()
  return NextResponse.json({ success: true, ...body })
}
