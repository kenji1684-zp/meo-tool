import { NextRequest, NextResponse } from 'next/server'
import { loadMonthRankingsById, loadMonthRankings } from '@/lib/keyword-store'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id        = searchParams.get('id')
  const location  = searchParams.get('location') ?? ''
  const yearmonth = searchParams.get('yearmonth') ?? ''

  if (!yearmonth) return NextResponse.json({ rankings: {} })

  const [y, m] = yearmonth.split('/').map(Number)

  // 新形式: ?id= パラメータ（GitHub Actions 保存先と一致）
  if (id) {
    const rankings = loadMonthRankingsById(id, y, m)
    return NextResponse.json({ rankings })
  }

  // 旧形式: ?location= パラメータ（後方互換）
  if (location) {
    const rankings = loadMonthRankings(location, y, m)
    return NextResponse.json({ rankings })
  }

  return NextResponse.json({ rankings: {} })
}
